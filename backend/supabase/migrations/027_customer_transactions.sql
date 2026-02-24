-- Customer transactions (for credit tracking and reminder logs)
CREATE TABLE IF NOT EXISTS public.customer_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_id ON public.customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_shop_id ON public.customer_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_created_at ON public.customer_transactions(created_at);

ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;
