"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const supabase_1 = require("../../config/supabase");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const PAYSTACK_BASE = 'https://api.paystack.co';
const PURPOSES = ['subscription', 'topup', 'invoice', 'order'];
class PaymentsService {
    getSecretKey() {
        const key = env_1.env.paystackSecretKey;
        if (!key)
            throw new Error('PAYSTACK_SECRET_KEY is not configured');
        return key;
    }
    async initialize(input) {
        const purpose = (input.purpose && PURPOSES.includes(input.purpose))
            ? input.purpose
            : 'order';
        const currency = (input.currency || 'GHS').toUpperCase();
        const amountMinor = Math.round(Number(input.amount));
        if (amountMinor <= 0)
            throw new Error('Amount must be positive');
        const reference = `sk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const { data: intent, error: intentErr } = await supabase_1.supabase
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
            logger_1.logger.error('payment_intents insert error', intentErr);
            throw new Error('Failed to create payment intent');
        }
        const callbackUrl = `${env_1.env.frontendUrl}/payments/callback`;
        // Channels: card + mobile_money (MTN MoMo, Vodafone Cash, AirtelTigo/Telecel etc).
        // Customer chooses on Paystack page; MoMo triggers PIN prompt on their phone.
        const channels = ['card', 'mobile_money'];
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
        const json = (await res.json());
        if (!res.ok || !json.status || !json.data?.authorization_url) {
            await supabase_1.supabase
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
    async verify(reference) {
        const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${this.getSecretKey()}` },
        });
        const json = (await res.json());
        if (!res.ok || !json.status || json.data?.status !== 'success') {
            return { success: false };
        }
        const data = json.data;
        const ref = data.reference;
        const { data: existingPayment } = await supabase_1.supabase
            .from('payments')
            .select('id')
            .eq('paystack_reference', ref)
            .maybeSingle();
        if (existingPayment) {
            return { success: true, payment: { id: existingPayment.id, paystack_reference: ref } };
        }
        const { data: intent } = await supabase_1.supabase
            .from('payment_intents')
            .select('id, shop_id, purpose, metadata')
            .eq('paystack_reference', ref)
            .single();
        const shopId = (intent?.shop_id ?? data.metadata?.shop_id);
        const purpose = (intent?.purpose ?? data.metadata?.purpose ?? 'order');
        const metadata = (intent?.metadata ?? data.metadata ?? {});
        const amount = (data.amount ?? 0) / 100;
        const currency = (data.currency ?? 'GHS');
        if (!shopId) {
            logger_1.logger.error('Verify: no shop_id for reference', ref);
            return { success: false };
        }
        await supabase_1.supabase.from('payment_intents').update({
            status: 'success',
            updated_at: new Date().toISOString(),
        }).eq('paystack_reference', ref);
        const { data: payment, error: payErr } = await supabase_1.supabase
            .from('payments')
            .insert({
            shop_id: shopId,
            payment_intent_id: intent?.id ?? null,
            amount,
            currency,
            purpose: PURPOSES.includes(purpose) ? purpose : 'order',
            status: 'success',
            paystack_reference: ref,
            metadata,
        })
            .select()
            .single();
        if (payErr) {
            logger_1.logger.error('payments insert error', payErr);
            return { success: true, payment: { paystack_reference: ref } };
        }
        return { success: true, payment: payment };
    }
    getWebhookSecret() {
        const secret = env_1.env.paystackWebhookSecret;
        if (!secret)
            throw new Error('PAYSTACK_WEBHOOK_SECRET is not configured');
        return secret;
    }
    async processWebhook(rawBody, signature) {
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const computed = crypto
            .createHmac('sha512', this.getWebhookSecret())
            .update(rawBody)
            .digest('hex');
        if (computed !== signature) {
            throw new Error('Invalid webhook signature');
        }
        const payload = JSON.parse(rawBody.toString());
        if (payload.event === 'charge.success' && payload.data?.reference) {
            const ref = payload.data.reference;
            const { data: existing } = await supabase_1.supabase
                .from('payments')
                .select('id')
                .eq('paystack_reference', ref)
                .maybeSingle();
            if (existing)
                return;
            await this.verify(ref);
        }
    }
}
exports.PaymentsService = PaymentsService;
//# sourceMappingURL=payments.service.js.map