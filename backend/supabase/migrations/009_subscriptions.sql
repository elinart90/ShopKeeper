-- Monthly subscriptions (user-level) for mandatory plan access
-- Run in Supabase SQL Editor after migration 008

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    plan_code VARCHAR(50) NOT NULL CHECK (plan_code IN ('small', 'medium', 'big', 'enterprise')),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    status VARCHAR(50) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'expired', 'cancelled')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    last_payment_reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON public.user_subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS public.subscription_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_code VARCHAR(50) NOT NULL CHECK (plan_code IN ('small', 'medium', 'big', 'enterprise')),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    paystack_reference VARCHAR(255) NOT NULL UNIQUE,
    paystack_response JSONB NOT NULL DEFAULT '{}',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_id ON public.subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_status ON public.subscription_transactions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_reference ON public.subscription_transactions(paystack_reference);
