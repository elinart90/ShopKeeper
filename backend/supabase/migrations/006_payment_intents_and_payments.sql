-- Paystack: payment intents (initiated) and payments (confirmed)
-- Run in Supabase Dashboard → SQL Editor after 005

-- Your record of "someone is trying to pay"
CREATE TABLE IF NOT EXISTS public.payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    purpose VARCHAR(50) NOT NULL DEFAULT 'order' CHECK (purpose IN ('subscription', 'topup', 'invoice', 'order')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    paystack_reference VARCHAR(255) UNIQUE,
    metadata JSONB DEFAULT '{}',
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_shop_id ON public.payment_intents(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_paystack_reference ON public.payment_intents(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON public.payment_intents(status);

-- Confirmed payments (after Paystack verify or webhook)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    purpose VARCHAR(50) NOT NULL DEFAULT 'order' CHECK (purpose IN ('subscription', 'topup', 'invoice', 'order')),
    status VARCHAR(50) NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    paystack_reference VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_paystack_reference ON public.payments(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
