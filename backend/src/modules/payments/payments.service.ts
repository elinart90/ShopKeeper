import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { BillingCycle, SubscriptionsService } from '../subscriptions/subscriptions.service';

const PAYSTACK_BASE = 'https://api.paystack.co';
const PURPOSES = ['subscription', 'topup', 'invoice', 'order'] as const;
type Purpose = (typeof PURPOSES)[number];

export interface InitializeInput {
  shop_id: string;
  amount: number; // in kobo/pesewas (minor units)
  currency?: string;
  email: string;
  purpose?: Purpose;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export class PaymentsService {
  private readonly subscriptionsService = new SubscriptionsService();

  private getSecretKey(): string {
    const key = env.paystackSecretKey;
    if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
    return key;
  }

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    const purpose = (input.purpose && PURPOSES.includes(input.purpose as Purpose))
      ? (input.purpose as Purpose)
      : 'order';
    const currency = (input.currency || 'GHS').toUpperCase();
    const amountMinor = Math.round(Number(input.amount));
    if (amountMinor <= 0) throw new Error('Amount must be positive');

    const reference = `sk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const { data: intent, error: intentErr } = await supabase
      .from('payment_intents')
      .insert({
        shop_id: input.shop_id,
        amount: amountMinor / 100,
        currency,
        purpose,
        status: 'pending',
        paystack_reference: reference,
        metadata: input.metadata || {},
        customer_email: input.email,
      })
      .select('id')
      .single();

    if (intentErr || !intent) {
      logger.error('payment_intents insert error', intentErr);
      throw new Error('Failed to create payment intent');
    }

    const callbackUrl = `${env.frontendUrl}/payments/callback`;
    // Channels: card + mobile_money (MTN MoMo, Vodafone Cash, AirtelTigo/Telecel etc).
    // Customer chooses on Paystack page; MoMo triggers PIN prompt on their phone.
    const channels = ['card', 'mobile_money', 'bank_transfer'];
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: amountMinor,
        reference,
        callback_url: callbackUrl,
        channels,
        metadata: {
          shop_id: input.shop_id,
          purpose,
          ...input.metadata,
        },
      }),
    });

    const json = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    };

    if (!res.ok || !json.status || !json.data?.authorization_url) {
      await supabase
        .from('payment_intents')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', intent.id);
      throw new Error(json.message || 'Paystack initialize failed');
    }

    return {
      authorization_url: json.data.authorization_url,
      access_code: json.data.access_code || '',
      reference: json.data.reference || reference,
    };
  }

  async verify(reference: string): Promise<{ success: boolean; payment?: Record<string, unknown> }> {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.getSecretKey()}` },
    });

    const json = (await res.json()) as {
      status?: boolean;
      data?: {
        status?: string;
        reference?: string;
        amount?: number;
        currency?: string;
        metadata?: Record<string, unknown>;
      };
    };

    if (!res.ok || !json.status || json.data?.status !== 'success') {
      return { success: false };
    }

    const data = json.data!;
    const ref = data.reference as string;

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('paystack_reference', ref)
      .maybeSingle();

    if (existingPayment) {
      return { success: true, payment: { id: existingPayment.id, paystack_reference: ref } };
    }

    const { data: intent } = await supabase
      .from('payment_intents')
      .select('id, shop_id, purpose, metadata')
      .eq('paystack_reference', ref)
      .single();

    const shopId = (intent?.shop_id ?? data.metadata?.shop_id) as string;
    const purpose = (intent?.purpose ?? data.metadata?.purpose ?? 'order') as string;
    const metadata = (intent?.metadata ?? data.metadata ?? {}) as Record<string, unknown>;
    const amount = (data.amount ?? 0) / 100;
    const currency = (data.currency ?? 'GHS') as string;

    if (!shopId) {
      logger.error('Verify: no shop_id for reference', ref);
      return { success: false };
    }

    await supabase.from('payment_intents').update({
      status: 'success',
      updated_at: new Date().toISOString(),
    }).eq('paystack_reference', ref);

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        shop_id: shopId,
        payment_intent_id: intent?.id ?? null,
        amount,
        currency,
        purpose: PURPOSES.includes(purpose as Purpose) ? purpose : 'order',
        status: 'success',
        paystack_reference: ref,
        metadata,
      })
      .select()
      .single();

    if (payErr) {
      logger.error('payments insert error', payErr);
      return { success: true, payment: { paystack_reference: ref } };
    }

    return { success: true, payment: payment as Record<string, unknown> };
  }

  getWebhookSecret(): string {
    const secret = env.paystackWebhookSecret;
    if (!secret) throw new Error('PAYSTACK_WEBHOOK_SECRET is not configured');
    return secret;
  }

  async processWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const crypto = await import('crypto');
    const computed = crypto
      .createHmac('sha512', this.getWebhookSecret())
      .update(rawBody)
      .digest('hex');

    if (computed !== signature) {
      throw new Error('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString()) as {
      event?: string;
      data?: {
        reference?: string;
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        metadata?: Record<string, unknown>;
        customer?: { email?: string };
        plan?: { plan_code?: string; interval?: string };
        subscription?: { subscription_code?: string };
      };
    };

    if (payload.event === 'charge.success' && payload.data?.reference) {
      const ref = payload.data.reference;
      const wasSubscription = await this.tryProcessSubscriptionChargeSuccess(payload.data);
      if (wasSubscription) return;

      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('paystack_reference', ref)
        .maybeSingle();

      if (existing) return;

      await this.verify(ref);
    }

    if (payload.event === 'charge.failed' && payload.data) {
      await this.tryProcessSubscriptionChargeFailed(payload.data);
    }
  }

  private async resolveUserIdFromSubscriptionWebhook(data: {
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
  }): Promise<string | null> {
    const fromMetadata = data.metadata?.user_id;
    if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
      return fromMetadata.trim();
    }

    const email = data.customer?.email ? String(data.customer.email).trim().toLowerCase() : '';
    if (!email) return null;
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return user?.id ? String(user.id) : null;
  }

  private async tryProcessSubscriptionChargeSuccess(data: {
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
    plan?: { plan_code?: string; interval?: string };
    subscription?: { subscription_code?: string };
  }): Promise<boolean> {
    const metadataPurpose = String(data.metadata?.purpose || '').toLowerCase();
    const looksLikeSubscription =
      metadataPurpose === 'subscription' ||
      !!data.subscription?.subscription_code ||
      String(data.plan?.interval || '').toLowerCase() === 'monthly';

    if (!looksLikeSubscription) return false;
    if (!data.reference) return true;

    const userId = await this.resolveUserIdFromSubscriptionWebhook(data);
    if (!userId) {
      logger.warn('Subscription webhook received but user could not be resolved', data.reference);
      return true;
    }

    const planCodeFromMetadata = data.metadata?.plan_code;
    const planCodeFromPlan = data.plan?.plan_code;
    const planCode =
      (typeof planCodeFromMetadata === 'string' && planCodeFromMetadata) ||
      (typeof planCodeFromPlan === 'string' && planCodeFromPlan) ||
      undefined;
    const billingCycleFromMetadata = data.metadata?.billing_cycle;
    const billingCycleFromPlanInterval = data.plan?.interval;
    const billingCycle: BillingCycle =
      (typeof billingCycleFromMetadata === 'string' && billingCycleFromMetadata.toLowerCase() === 'yearly')
        ? 'yearly'
        : (typeof billingCycleFromPlanInterval === 'string' && billingCycleFromPlanInterval.toLowerCase() === 'yearly')
          ? 'yearly'
          : 'monthly';

    const amountMinor = Number(data.amount ?? 0);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      logger.warn('Subscription webhook missing valid amount', data.reference);
      return true;
    }

    await this.subscriptionsService.activateFromSuccessfulCharge({
      userId,
      reference: data.reference,
      amountMinor,
      currency: data.currency || 'GHS',
      paidAtIso: data.paid_at,
      planCode,
      billingCycle,
      rawPayload: data as unknown as Record<string, unknown>,
    });

    return true;
  }

  private async tryProcessSubscriptionChargeFailed(data: {
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
    plan?: { interval?: string };
    subscription?: { subscription_code?: string };
  }): Promise<void> {
    const metadataPurpose = String(data.metadata?.purpose || '').toLowerCase();
    const looksLikeSubscription =
      metadataPurpose === 'subscription' ||
      !!data.subscription?.subscription_code ||
      String(data.plan?.interval || '').toLowerCase() === 'monthly';
    if (!looksLikeSubscription) return;

    const userId = await this.resolveUserIdFromSubscriptionWebhook(data);
    if (!userId) return;
    await this.subscriptionsService.markPastDue(userId);
  }
}
