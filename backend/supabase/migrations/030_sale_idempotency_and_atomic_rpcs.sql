-- Idempotency for sales + atomic stock/credit RPCs
-- Run this in Supabase SQL Editor or via migration.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(512);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_shop_idempotency
  ON public.sales (shop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.decrement_stock_safe(
  p_product_id UUID,
  p_shop_id UUID,
  p_quantity DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old DECIMAL(15,3);
  v_new DECIMAL(15,3);
  v_updated INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity');
  END IF;
  UPDATE public.products
  SET stock_quantity = stock_quantity - p_quantity, updated_at = NOW()
  WHERE id = p_product_id AND shop_id = p_shop_id AND stock_quantity >= p_quantity
  RETURNING (stock_quantity + p_quantity), stock_quantity INTO v_old, v_new;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient stock or product not found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'old_quantity', v_old, 'new_quantity', v_new);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.increment_credit_balance(
  p_customer_id UUID,
  p_shop_id UUID,
  p_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  UPDATE public.customers
  SET credit_balance = credit_balance + p_amount, updated_at = NOW()
  WHERE id = p_customer_id AND shop_id = p_shop_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.decrement_credit_balance(
  p_customer_id UUID,
  p_shop_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  UPDATE public.customers
  SET credit_balance = GREATEST(0, credit_balance - p_amount), updated_at = NOW()
  WHERE id = p_customer_id AND shop_id = p_shop_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Customer not found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.increment_stock_safe(
  p_product_id UUID,
  p_shop_id UUID,
  p_quantity DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old DECIMAL(15,3);
  v_new DECIMAL(15,3);
  v_updated INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity');
  END IF;
  UPDATE public.products
  SET stock_quantity = stock_quantity + p_quantity, updated_at = NOW()
  WHERE id = p_product_id AND shop_id = p_shop_id
  RETURNING stock_quantity - p_quantity, stock_quantity INTO v_old, v_new;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'old_quantity', v_old, 'new_quantity', v_new);
END;
$fn$;

-- Single-transaction create sale: idempotency + sale + items + FIFO cost + stock + credit
CREATE OR REPLACE FUNCTION public.create_sale_atomic(
  p_shop_id UUID,
  p_user_id TEXT,
  p_customer_id UUID,
  p_payment_method TEXT,
  p_discount_amount DECIMAL DEFAULT 0,
  p_tax_amount DECIMAL DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sale_id UUID;
  v_sale_number TEXT;
  v_total_amount DECIMAL(15,2) := 0;
  v_final_amount DECIMAL(15,2);
  v_item JSONB;
  v_product_id UUID;
  v_qty DECIMAL(15,3);
  v_unit_price DECIMAL(15,2);
  v_discount DECIMAL(15,2);
  v_item_total DECIMAL(15,2);
  v_cost_total DECIMAL(15,2);
  v_avg_cost DECIMAL(15,4);
  v_basis JSONB := '[]'::JSONB;
  v_layer RECORD;
  v_remaining DECIMAL(15,3);
  v_take DECIMAL(15,3);
  v_fallback_cost DECIMAL(15,4);
  v_old_qty DECIMAL(15,3);
  v_new_qty DECIMAL(15,3);
  v_stock_updated INTEGER;
  i INT;
BEGIN
  IF p_payment_method = 'credit' AND (p_customer_id IS NULL OR p_customer_id = '00000000-0000-0000-0000-000000000000'::UUID) THEN
    RAISE EXCEPTION 'Credit sale requires customer_id';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_sale_id FROM public.sales
    WHERE shop_id = p_shop_id AND idempotency_key = trim(p_idempotency_key) LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('sale_id', v_sale_id, 'existing', true);
    END IF;
  END IF;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1) LOOP
    v_item := p_items->i;
    v_qty := (v_item->>'quantity')::DECIMAL;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_discount := COALESCE((v_item->>'discount_amount')::DECIMAL, 0);
    v_item_total := v_qty * v_unit_price - v_discount;
    v_total_amount := v_total_amount + v_item_total;
  END LOOP;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) + COALESCE(p_tax_amount, 0);
  v_sale_number := 'SALE-' || (extract(epoch from now()) * 1000)::bigint::text || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.sales (
    shop_id, customer_id, sale_number, total_amount, discount_amount, tax_amount, final_amount,
    payment_method, status, notes, created_by, idempotency_key
  ) VALUES (
    p_shop_id, NULLIF(p_customer_id, '00000000-0000-0000-0000-000000000000'::UUID), v_sale_number,
    v_total_amount, COALESCE(p_discount_amount, 0), COALESCE(p_tax_amount, 0), v_final_amount,
    COALESCE(p_payment_method, 'cash'), 'completed', p_notes, p_user_id, NULLIF(trim(p_idempotency_key), '')
  )
  RETURNING id INTO v_sale_id;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1) LOOP
    v_item := p_items->i;
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::DECIMAL;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_discount := COALESCE((v_item->>'discount_amount')::DECIMAL, 0);
    v_item_total := v_qty * v_unit_price - v_discount;

    v_cost_total := 0;
    v_basis := '[]'::JSONB;
    v_remaining := v_qty;

    FOR v_layer IN
      SELECT id, remaining_quantity, unit_cost FROM public.stock_cost_layers
      WHERE shop_id = p_shop_id AND product_id = v_product_id AND remaining_quantity > 0
      ORDER BY received_at ASC, created_at ASC FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_layer.remaining_quantity);
      v_remaining := v_remaining - v_take;
      UPDATE public.stock_cost_layers SET remaining_quantity = remaining_quantity - v_take WHERE id = v_layer.id;
      v_cost_total := v_cost_total + v_take * v_layer.unit_cost;
      v_basis := v_basis || jsonb_build_array(jsonb_build_object('quantity', v_take, 'unitCost', v_layer.unit_cost));
    END LOOP;

    IF v_remaining > 0.0001 THEN
      SELECT cost_price INTO v_fallback_cost FROM public.products WHERE id = v_product_id AND shop_id = p_shop_id;
      v_fallback_cost := COALESCE(v_fallback_cost, 0);
      v_cost_total := v_cost_total + v_remaining * v_fallback_cost;
      v_basis := v_basis || jsonb_build_array(jsonb_build_object('quantity', v_remaining, 'unitCost', v_fallback_cost));
    END IF;

    v_avg_cost := CASE WHEN v_qty > 0 THEN v_cost_total / v_qty ELSE 0 END;

    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, discount_amount, total_price, cost_total, avg_cost, cost_basis_json)
    VALUES (v_sale_id, v_product_id, v_qty, v_unit_price, v_discount, v_item_total, v_cost_total, v_avg_cost, v_basis);

    UPDATE public.products SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
    WHERE id = v_product_id AND shop_id = p_shop_id AND stock_quantity >= v_qty
    RETURNING (stock_quantity + v_qty), stock_quantity INTO v_old_qty, v_new_qty;
    GET DIAGNOSTICS v_stock_updated = ROW_COUNT;
    IF v_stock_updated = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    INSERT INTO public.stock_movements (shop_id, product_id, action, quantity, previous_quantity, new_quantity, notes, created_by)
    VALUES (p_shop_id, v_product_id, 'sale', v_qty, v_old_qty, v_new_qty, 'Sale ' || v_sale_number, p_user_id);
  END LOOP;

  IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL AND p_customer_id <> '00000000-0000-0000-0000-000000000000'::UUID THEN
    UPDATE public.customers SET credit_balance = credit_balance + v_final_amount, updated_at = NOW()
    WHERE id = p_customer_id AND shop_id = p_shop_id;
  END IF;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'existing', false);
END;
$fn$;
