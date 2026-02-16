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
    listPlans() {
        return PLAN_DEFINITIONS.map((plan) => ({
            code: plan.code,
            name: plan.name,
            amount: Number((plan.amountMinor / 100).toFixed(2)),
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
    addOneCalendarMonth(now) {
        const result = new Date(now.getTime());
        result.setMonth(result.getMonth() + 1);
        return result;
    }
    async getStatus(userId) {
        const { data: sub, error } = await supabase_1.supabase
            .from('user_subscriptions')
            .select('plan_code, amount, currency, status, current_period_start, current_period_end')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) {
            logger_1.logger.error('user_subscriptions status read error', error);
            throw new Error('Failed to read subscription status');
        }
        if (!sub) {
            return { hasPlan: false, status: 'inactive', isActive: false };
        }
        const nowIso = new Date().toISOString();
        const periodEnd = sub.current_period_end ? String(sub.current_period_end) : null;
        const isExpiredByDate = !!periodEnd && periodEnd <= nowIso;
        let status = sub.status || 'inactive';
        if (status === 'active' && isExpiredByDate) {
            status = 'expired';
            await supabase_1.supabase
                .from('user_subscriptions')
                .update({ status: 'expired', updated_at: nowIso })
                .eq('user_id', userId);
        }
        const isActive = status === 'active' && !isExpiredByDate;
        const planCode = sub.plan_code;
        const plan = PLAN_MAP.get(planCode);
        return {
            hasPlan: true,
            status,
            isActive,
            planCode,
            planName: plan?.name,
            amount: Number(sub.amount ?? 0),
            currency: String(sub.currency ?? 'GHS'),
            currentPeriodStart: sub.current_period_start ? String(sub.current_period_start) : null,
            currentPeriodEnd: periodEnd,
        };
    }
    async initialize(userId, email, planCode) {
        const plan = this.getPlan(planCode);
        const reference = this.createReference();
        const nowIso = new Date().toISOString();
        const { data: tx, error: txError } = await supabase_1.supabase
            .from('subscription_transactions')
            .insert({
            user_id: userId,
            plan_code: plan.code,
            amount: plan.amountMinor / 100,
            currency: plan.currency,
            status: 'pending',
            paystack_reference: reference,
        })
            .select('id')
            .single();
        if (txError || !tx) {
            logger_1.logger.error('subscription_transactions insert error', txError);
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
                amount: plan.amountMinor,
                reference,
                callback_url: callbackUrl,
                channels,
                metadata: {
                    purpose: 'subscription',
                    user_id: userId,
                    plan_code: plan.code,
                },
            }),
        });
        const json = (await res.json());
        if (!res.ok || !json.status || !json.data?.authorization_url) {
            await supabase_1.supabase
                .from('subscription_transactions')
                .update({ status: 'failed', updated_at: nowIso, paystack_response: json ?? {} })
                .eq('id', tx.id);
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
            .select('id, plan_code, amount, status')
            .eq('user_id', userId)
            .eq('paystack_reference', reference)
            .maybeSingle();
        if (txErr || !tx) {
            return { success: false, status: await this.getStatus(userId) };
        }
        if (tx.status === 'success') {
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
                .eq('id', tx.id);
            return { success: false, status: await this.getStatus(userId) };
        }
        const now = new Date();
        const periodStart = now.toISOString();
        const periodEnd = this.addOneCalendarMonth(now).toISOString();
        const amountMajor = Number((this.getPlan(tx.plan_code).amountMinor / 100).toFixed(2));
        const { data: existing } = await supabase_1.supabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
        if (existing?.id) {
            await supabase_1.supabase.from('user_subscriptions').update({
                plan_code: tx.plan_code,
                amount: amountMajor,
                currency: 'GHS',
                status: 'active',
                current_period_start: periodStart,
                current_period_end: periodEnd,
                cancelled_at: null,
                last_payment_reference: reference,
                updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
        }
        else {
            await supabase_1.supabase.from('user_subscriptions').insert({
                user_id: userId,
                plan_code: tx.plan_code,
                amount: amountMajor,
                currency: 'GHS',
                status: 'active',
                current_period_start: periodStart,
                current_period_end: periodEnd,
                last_payment_reference: reference,
            });
        }
        await supabase_1.supabase.from('subscription_transactions').update({
            status: 'success',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            paystack_response: json,
        }).eq('id', tx.id);
        return { success: true, status: await this.getStatus(userId) };
    }
}
exports.SubscriptionsService = SubscriptionsService;
//# sourceMappingURL=subscriptions.service.js.map