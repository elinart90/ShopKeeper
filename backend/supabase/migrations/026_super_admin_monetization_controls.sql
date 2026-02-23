-- Advanced monetization controls foundation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(60) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  trial_extension_days INTEGER NOT NULL DEFAULT 0,
  max_redemptions INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_promo_codes_active ON public.admin_promo_codes(is_active, valid_to);

CREATE TABLE IF NOT EXISTS public.admin_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES public.admin_promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  applied_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  trial_days_granted INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_promo_redemptions_user ON public.admin_promo_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_promo_redemptions_code ON public.admin_promo_redemptions(promo_code_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_monetization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_rate_percent DECIMAL(8, 4) NOT NULL DEFAULT 0,
  overdue_suspend_after_days INTEGER NOT NULL DEFAULT 7,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.admin_monetization_settings (commission_rate_percent, overdue_suspend_after_days)
SELECT 0, 7
WHERE NOT EXISTS (SELECT 1 FROM public.admin_monetization_settings);
