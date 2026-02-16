"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const supabase_1 = require("../../config/supabase");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const PAYSTACK_BASE = 'https://api.paystack.co';
const PLAN_DEFINITIONS = [
    { code: 'small', name: 'Small Shop', amountMinor: 3000, currency: 'GHS' },
    { code: 'medium', name: 'Medium Shop', amountMinor: 4500, currency: 'GHS' },
    { code: 'big', name: 'Big Shop', amountMinor: 6000, currency: 'GHS' },
    { code: 'enterprise', name: 'Enterprise / Mall', amountMinor: 10000, currency: 'GHS' },
];
const PLAN_MAP = new Map(PLAN_DEFINITIONS.map((p) => [p.code, p]));
class SubscriptionsService {
    constructor() {
        this.yearlyDiscountPercent = 15;
    }
    isMissingBillingCycleColumn(error) {
        const e = error;
        return e?.code === '42703' && String(e?.message || '').includes('billing_cycle');
    }
    listPlans() {
        return PLAN_DEFINITIONS.map((plan) => ({
            code: plan.code,
            name: plan.name,
            monthlyAmount: Number((plan.amountMinor / 100).toFixed(2)),
            yearlyAmount: Number((this.getAmountMinorForCycle(plan, 'yearly') / 100).toFixed(2)),
            yearlyDiscountPercent: this.yearlyDiscountPercent,
            currency: plan.currency,
            interval: 'monthly',
        }));
    }
    getSecretKey() {
        const key = env_1.env.paystackSecretKey;
        if (!key)
            throw new Error('PAYSTACK_SECRET_KEY is not configured');
        return key;
    }
    getPlan(planCode) {
        const plan = PLAN_MAP.get(planCode);
        if (!plan)
            throw new Error('Invalid subscription plan');
        return plan;
    }
    createReference() {
        return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    addByBillingCycle(now, billingCycle) {
        const result = new Date(now.getTime());
        result.setMonth(result.getMonth() + (billingCycle === 'yearly' ? 12 : 1));
        return result;
    }
    getAmountMinorForCycle(plan, billingCycle) {
        if (billingCycle === 'monthly')
            return plan.amountMinor;
        const yearly = Math.round(plan.amountMinor * 12 * (1 - this.yearlyDiscountPercent / 100));
        return yearly;
    }
    getPlanAndCycleByAmountMinor(amountMinor) {
        for (const plan of PLAN_DEFINITIONS) {
            if (this.getAmountMinorForCycle(plan, 'monthly') === amountMinor) {
                return { plan, billingCycle: 'monthly' };
            }
            if (this.getAmountMinorForCycle(plan, 'yearly') === amountMinor) {
                return { plan, billingCycle: 'yearly' };
            }
        }
        return null;
    }
    async readSubscriptionRow(userId) {
        const { data: sub, error } = await supabase_1.supabase
            .from('user_subscriptions')
            .select('plan_code, amount, currency, status, billing_cycle, current_period_start, current_period_end')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) {
            if (!this.isMissingBillingCycleColumn(error)) {
                logger_1.logger.error('user_subscriptions status read error', error);
                throw new Error('Failed to read subscription status');
            }
            const legacy = await supabase_1.supabase
                .from('user_subscriptions')
                .select('plan_code, amount, currency, status, current_period_start, current_period_end')
                .eq('user_id', userId)
                .maybeSingle();
            if (legacy.error) {
                logger_1.logger.error('user_subscriptions legacy status read error', legacy.error);
                throw new Error('Failed to read subscription status');
            }
            return legacy.data ?? null;
        }
        return sub ?? null;
    }
    async buildStatusFromRow(subscribedUserId, row) {
        if (!row)
            return { hasPlan: false, status: 'inactive', isActive: false };
        const nowIso = new Date().toISOString();
        const periodEnd = row.current_period_end ? String(row.current_period_end) : null;
        const isExpiredByDate = !!periodEnd && periodEnd <= nowIso;
        let status = row.status || 'inactive';
        if (status === 'active' && isExpiredByDate) {
            status = 'expired';
            await supabase_1.supabase
                .from('user_subscriptions')
                .update({ status: 'expired', updated_at: nowIso })
                .eq('user_id', subscribedUserId);
        }
        const isActive = status === 'active' && !isExpiredByDate;
        const planCode = row.plan_code;
        const plan = PLAN_MAP.get(planCode);
        return {
            hasPlan: true,
            status,
            isActive,
            planCode,
            planName: plan?.name,
            amount: Number(row.amount ?? 0),
            currency: String(row.currency ?? 'GHS'),
            billingCycle: row.billing_cycle || 'monthly',
            currentPeriodStart: row.current_period_start ? String(row.current_period_start) : null,
            currentPeriodEnd: periodEnd,
        };
    }
    async getStatus(userId, shopId) {
        if (shopId) {
            const { data: shop, error: shopErr } = await supabase_1.supabase
                .from('shops')
                .select('owner_id')
                .eq('id', shopId)
                .maybeSingle();
            if (!shopErr && shop?.owner_id && String(shop.owner_id) !== userId) {
                const ownerId = String(shop.owner_id);
                const ownerRow = await this.readSubscriptionRow(ownerId);
                return this.buildStatusFromRow(ownerId, ownerRow);
            }
        }
        const ownRow = await this.readSubscriptionRow(userId);
        const ownStatus = await this.buildStatusFromRow(userId, ownRow);
        if (ownStatus.isActive)
            return ownStatus;
        const { data: memberships, error: memberErr } = await supabase_1.supabase
            .from('shop_members')
            .select('shop_id')
            .eq('user_id', userId);
        if (memberErr || !memberships || memberships.length === 0) {
            return ownStatus;
        }
        const shopIds = memberships
            .map((m) => (m?.shop_id ? String(m.shop_id) : ''))
            .filter(Boolean);
        if (shopIds.length === 0)
            return ownStatus;
        const { data: shops, error: shopsErr } = await supabase_1.supabase
            .from('shops')
            .select('id, owner_id')
            .in('id', shopIds);
        if (shopsErr || !shops || shops.length === 0)
            return ownStatus;
        const ownerIds = Array.from(new Set(shops
            .map((s) => (s?.owner_id ? String(s.owner_id) : ''))
            .filter((id) => !!id && id !== userId)));
        for (const ownerId of ownerIds) {
            const ownerRow = await this.readSubscriptionRow(ownerId);
            const ownerStatus = await this.buildStatusFromRow(ownerId, ownerRow);
            if (ownerStatus.isActive)
                return ownerStatus;
        }
        return ownStatus;
    }
    async initialize(userId, email, planCode, billingCycle = 'monthly') {
        const plan = this.getPlan(planCode);
        const normalizedCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
        const amountMinor = this.getAmountMinorForCycle(plan, normalizedCycle);
        const reference = this.createReference();
        const nowIso = new Date().toISOString();
        const { data: tx, error: txError } = await supabase_1.supabase
            .from('subscription_transactions')
            .insert({
            user_id: userId,
            plan_code: plan.code,
            amount: amountMinor / 100,
            currency: plan.currency,
            billing_cycle: normalizedCycle,
            status: 'pending',
            paystack_reference: reference,
        })
            .select('id')
            .single();
        let txRow = tx;
        if (txError || !tx) {
            if (!this.isMissingBillingCycleColumn(txError)) {
                logger_1.logger.error('subscription_transactions insert error', txError);
                throw new Error('Failed to start subscription payment');
            }
            const legacyTx = await supabase_1.supabase
                .from('subscription_transactions')
                .insert({
                user_id: userId,
                plan_code: plan.code,
                amount: amountMinor / 100,
                currency: plan.currency,
                status: 'pending',
                paystack_reference: reference,
            })
                .select('id')
                .single();
            if (legacyTx.error || !legacyTx.data) {
                logger_1.logger.error('subscription_transactions legacy insert error', legacyTx.error);
                throw new Error('Failed to start subscription payment');
            }
            txRow = legacyTx.data;
        }
        if (!txRow) {
            throw new Error('Failed to start subscription payment');
        }
        const callbackUrl = `${env_1.env.frontendUrl}/subscription/callback`;
        const channels = ['card', 'mobile_money'];
        const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.getSecretKey()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: amountMinor,
                reference,
                callback_url: callbackUrl,
                channels,
                metadata: {
                    purpose: 'subscription',
                    user_id: userId,
                    plan_code: plan.code,
                    billing_cycle: normalizedCycle,
                },
            }),
        });
        const json = (await res.json());
        if (!res.ok || !json.status || !json.data?.authorization_url) {
            await supabase_1.supabase
                .from('subscription_transactions')
                .update({ status: 'failed', updated_at: nowIso, paystack_response: json ?? {} })
                .eq('id', txRow.id);
            throw new Error(json.message || 'Paystack initialize failed');
        }
        return {
            authorization_url: json.data.authorization_url,
            reference: json.data.reference || reference,
        };
    }
    async verify(userId, reference) {
        const { data: tx, error: txErr } = await supabase_1.supabase
            .from('subscription_transactions')
            .select('id, plan_code, amount, status, billing_cycle')
            .eq('user_id', userId)
            .eq('paystack_reference', reference)
            .maybeSingle();
        let txRow = tx;
        if (txErr || !tx) {
            if (!this.isMissingBillingCycleColumn(txErr)) {
                return { success: false, status: await this.getStatus(userId) };
            }
            const legacyTx = await supabase_1.supabase
                .from('subscription_transactions')
                .select('id, plan_code, amount, status')
                .eq('user_id', userId)
                .eq('paystack_reference', reference)
                .maybeSingle();
            if (legacyTx.error || !legacyTx.data) {
                return { success: false, status: await this.getStatus(userId) };
            }
            txRow = legacyTx.data;
        }
        if (!txRow) {
            return { success: false, status: await this.getStatus(userId) };
        }
        if (txRow.status === 'success') {
            return { success: true, status: await this.getStatus(userId) };
        }
        const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.getSecretKey()}`,
            },
        });
        const json = (await res.json());
        const isSuccess = !!res.ok && !!json.status && json.data?.status === 'success';
        if (!isSuccess || !json.data) {
            await supabase_1.supabase
                .from('subscription_transactions')
                .update({ status: 'failed', updated_at: new Date().toISOString(), paystack_response: json ?? {} })
                .eq('id', txRow.id);
            return { success: false, status: await this.getStatus(userId) };
        }
        await this.activateFromSuccessfulCharge({
            userId,
            reference,
            amountMinor: Number(json.data.amount ?? 0),
            currency: json.data.currency || 'GHS',
            paidAtIso: new Date().toISOString(),
            planCode: txRow.plan_code,
            billingCycle: txRow.billing_cycle || 'monthly',
            rawPayload: json,
        });
        return { success: true, status: await this.getStatus(userId) };
    }
    async activateFromSuccessfulCharge(input) {
        const amountMinor = Number(input.amountMinor || 0);
        if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
            throw new Error('Invalid amount for subscription activation');
        }
        const explicitPlan = input.planCode ? PLAN_MAP.get(input.planCode) : null;
        const inferred = this.getPlanAndCycleByAmountMinor(amountMinor);
        const plan = explicitPlan || inferred?.plan || null;
        if (!plan) {
            throw new Error('Could not determine subscription plan from payment amount');
        }
        const billingCycle = input.billingCycle || inferred?.billingCycle || 'monthly';
        const paidAt = input.paidAtIso ? new Date(input.paidAtIso) : new Date();
        const nowIso = new Date().toISOString();
        const paidAtIso = paidAt.toISOString();
        const chargedAmountMinor = this.getAmountMinorForCycle(plan, billingCycle);
        const amountMajor = Number((chargedAmountMinor / 100).toFixed(2));
        const { data: existing } = await supabase_1.supabase
            .from('user_subscriptions')
            .select('id, status, current_period_end')
            .eq('user_id', input.userId)
            .maybeSingle();
        let periodStartDate = paidAt;
        if (existing?.current_period_end && String(existing.current_period_end) > paidAtIso) {
            // If renewed early, extend from the existing period end.
            periodStartDate = new Date(String(existing.current_period_end));
        }
        const periodStartIso = periodStartDate.toISOString();
        const periodEndIso = this.addByBillingCycle(periodStartDate, billingCycle).toISOString();
        if (existing?.id) {
            const withCycle = await supabase_1.supabase.from('user_subscriptions').update({
                plan_code: plan.code,
                amount: amountMajor,
                currency: 'GHS',
                billing_cycle: billingCycle,
                status: 'active',
                current_period_start: periodStartIso,
                current_period_end: periodEndIso,
                cancelled_at: null,
                last_payment_reference: input.reference,
                updated_at: nowIso,
            }).eq('id', existing.id);
            if (withCycle.error && this.isMissingBillingCycleColumn(withCycle.error)) {
                await supabase_1.supabase.from('user_subscriptions').update({
                    plan_code: plan.code,
                    amount: amountMajor,
                    currency: 'GHS',
                    status: 'active',
                    current_period_start: periodStartIso,
                    current_period_end: periodEndIso,
                    cancelled_at: null,
                    last_payment_reference: input.reference,
                    updated_at: nowIso,
                }).eq('id', existing.id);
            }
        }
        else {
            const withCycle = await supabase_1.supabase.from('user_subscriptions').insert({
                user_id: input.userId,
                plan_code: plan.code,
                amount: amountMajor,
                currency: 'GHS',
                billing_cycle: billingCycle,
                status: 'active',
                current_period_start: periodStartIso,
                current_period_end: periodEndIso,
                last_payment_reference: input.reference,
            });
            if (withCycle.error && this.isMissingBillingCycleColumn(withCycle.error)) {
                await supabase_1.supabase.from('user_subscriptions').insert({
                    user_id: input.userId,
                    plan_code: plan.code,
                    amount: amountMajor,
                    currency: 'GHS',
                    status: 'active',
                    current_period_start: periodStartIso,
                    current_period_end: periodEndIso,
                    last_payment_reference: input.reference,
                });
            }
        }
        const { data: existingTx } = await supabase_1.supabase
            .from('subscription_transactions')
            .select('id')
            .eq('paystack_reference', input.reference)
            .maybeSingle();
        const txPayload = {
            user_id: input.userId,
            plan_code: plan.code,
            amount: amountMajor,
            currency: (input.currency || 'GHS').toUpperCase(),
            billing_cycle: billingCycle,
            status: 'success',
            paystack_reference: input.reference,
            paystack_response: input.rawPayload || {},
            paid_at: paidAtIso,
            updated_at: nowIso,
        };
        if (existingTx?.id) {
            const updateTx = await supabase_1.supabase.from('subscription_transactions').update(txPayload).eq('id', existingTx.id);
            if (updateTx.error && this.isMissingBillingCycleColumn(updateTx.error)) {
                const { billing_cycle, ...legacyTxPayload } = txPayload;
                await supabase_1.supabase.from('subscription_transactions').update(legacyTxPayload).eq('id', existingTx.id);
            }
        }
        else {
            const insertTx = await supabase_1.supabase.from('subscription_transactions').insert(txPayload);
            if (insertTx.error && this.isMissingBillingCycleColumn(insertTx.error)) {
                const { billing_cycle, ...legacyTxPayload } = txPayload;
                await supabase_1.supabase.from('subscription_transactions').insert(legacyTxPayload);
            }
        }
    }
    async markPastDue(userId) {
        await supabase_1.supabase
            .from('user_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .neq('status', 'cancelled');
    }
}
exports.SubscriptionsService = SubscriptionsService;
//# sourceMappingURL=subscriptions.service.js.map