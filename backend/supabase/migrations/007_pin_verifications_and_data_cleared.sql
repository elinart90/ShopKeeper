-- PIN verifications for sensitive actions (e.g. clear dashboard data)
-- and shops.data_cleared_at so dashboard only shows data after that date

CREATE TABLE IF NOT EXISTS public.pin_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    pin VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_verifications_user_shop_purpose ON public.pin_verifications(user_id, shop_id, purpose);
CREATE INDEX IF NOT EXISTS idx_pin_verifications_expires ON public.pin_verifications(expires_at);

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS data_cleared_at TIMESTAMPTZ;

COMMENT ON COLUMN public.shops.data_cleared_at IS 'When set, dashboard and reports only include sales/expenses after this timestamp.';
