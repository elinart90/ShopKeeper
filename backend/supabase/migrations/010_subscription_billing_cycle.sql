-- Add billing cycle support for subscriptions (monthly/yearly)

ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly'
CHECK (billing_cycle IN ('monthly', 'yearly'));

ALTER TABLE public.subscription_transactions
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly'
CHECK (billing_cycle IN ('monthly', 'yearly'));
