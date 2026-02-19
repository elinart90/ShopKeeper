-- FIFO cost basis + returns/refunds foundation (M3 part A/B)

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cost_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_basis_json JSONB,
  ADD COLUMN IF NOT EXISTS returned_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.stock_cost_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL DEFAULT 'purchase',
  source_id VARCHAR(255),
  unit_cost DECIMAL(15, 4) NOT NULL,
  initial_quantity DECIMAL(15, 3) NOT NULL,
  remaining_quantity DECIMAL(15, 3) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_cost_layers_fifo
  ON public.stock_cost_layers(shop_id, product_id, received_at, created_at);

CREATE TABLE IF NOT EXISTS public.sale_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(15, 3) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale
  ON public.sale_returns(shop_id, sale_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sale_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  affects_stock BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale
  ON public.sale_refunds(shop_id, sale_id, created_at DESC);

