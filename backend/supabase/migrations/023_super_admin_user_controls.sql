-- Add admin control columns for user lifecycle actions

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_flagged ON public.users(is_flagged);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
