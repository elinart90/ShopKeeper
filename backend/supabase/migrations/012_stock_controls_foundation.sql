-- Stock controls foundation (M1)
-- Snapshots, movement audit trail, and variance workflow.

CREATE TABLE IF NOT EXISTS public.stock_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_key VARCHAR(20) NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_shop_created
  ON public.stock_snapshots(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_snapshot_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES public.stock_snapshots(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  stock_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  stock_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_snapshot_items_snapshot
  ON public.stock_snapshot_items(snapshot_id);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  quantity_before DECIMAL(15, 3),
  quantity_change DECIMAL(15, 3) NOT NULL DEFAULT 0,
  quantity_after DECIMAL(15, 3),
  reason_code VARCHAR(80),
  reason_note TEXT,
  reference_type VARCHAR(60),
  reference_id VARCHAR(255),
  location_name VARCHAR(120),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_created
  ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON public.stock_movements(shop_id, product_id, created_at DESC);

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS movement_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS quantity_before DECIMAL(15, 3),
  ADD COLUMN IF NOT EXISTS quantity_change DECIMAL(15, 3),
  ADD COLUMN IF NOT EXISTS quantity_after DECIMAL(15, 3),
  ADD COLUMN IF NOT EXISTS reason_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS reason_note TEXT,
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(60),
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(120);

CREATE TABLE IF NOT EXISTS public.stock_variances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  expected_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
  counted_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
  variance_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  variance_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  variance_percent DECIMAL(8, 2) NOT NULL DEFAULT 0,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'moderate', 'critical', 'severe')),
  reason_code VARCHAR(80) NOT NULL,
  reason_note TEXT,
  evidence_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  approval_level VARCHAR(30) NOT NULL CHECK (approval_level IN ('auto', 'supervisor', 'owner')),
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_variances_shop_created
  ON public.stock_variances(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_variances_status
  ON public.stock_variances(shop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_variances_severity
  ON public.stock_variances(shop_id, severity, created_at DESC);

