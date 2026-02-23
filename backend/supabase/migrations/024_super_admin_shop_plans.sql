-- Shop-level plan mapping for super admin controls

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.shop_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
  plan_code VARCHAR(20) NOT NULL CHECK (plan_code IN ('free', 'basic', 'premium')),
  plan_rank INT NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_plans_plan_code
  ON public.shop_plans(plan_code, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_plans_shop_id
  ON public.shop_plans(shop_id);
