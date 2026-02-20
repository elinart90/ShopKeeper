-- Prevent duplicate active products with same barcode in a shop.
-- Keeps empty/null barcode allowed for manual products.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_shop_barcode_active
  ON public.products (shop_id, barcode)
  WHERE is_active = true
    AND barcode IS NOT NULL
    AND btrim(barcode) <> '';

