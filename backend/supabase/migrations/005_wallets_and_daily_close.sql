-- Wallets (Business, Personal, Savings) and Daily Close Summary
-- Run in Supabase Dashboard → SQL Editor after 001, 002, 003

-- Wallets per shop
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('business', 'personal', 'savings')),
    name VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, type)
);
CREATE INDEX IF NOT EXISTS idx_wallets_shop_id ON public.wallets(shop_id);

-- Wallet transactions (inflows, outflows, transfers)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('inflow', 'outflow', 'transfer_in', 'transfer_out', 'sale', 'expense', 'adjustment')),
    amount DECIMAL(15, 2) NOT NULL,
    from_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_shop_id ON public.wallet_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at);

-- Daily close (expected vs actual cash, approval)
CREATE TABLE IF NOT EXISTS public.daily_close (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    close_date DATE NOT NULL,
    expected_cash DECIMAL(15, 2) NOT NULL DEFAULT 0,
    actual_cash DECIMAL(15, 2) NOT NULL,
    difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    closed_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, close_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_close_shop_id ON public.daily_close(shop_id);
CREATE INDEX IF NOT EXISTS idx_daily_close_close_date ON public.daily_close(close_date);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_close ENABLE ROW LEVEL SECURITY;
