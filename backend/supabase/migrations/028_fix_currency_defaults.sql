-- Migration 028: Fix currency defaults
-- Changes the default currency for shops from USD to GHS.

-- 1. Change column default on shops table
ALTER TABLE public.shops
  ALTER COLUMN currency SET DEFAULT 'GHS';

-- 2. Update existing shops that still have the old USD default
UPDATE public.shops
SET currency = 'GHS', updated_at = NOW()
WHERE currency = 'USD';

-- 3. Update wallets that still have USD to match their shop currency
UPDATE public.wallets w
SET currency = s.currency, updated_at = NOW()
FROM public.shops s
WHERE w.shop_id = s.id
  AND w.currency = 'USD';
