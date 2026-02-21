-- Purchase plan drafts generated from Inventory & Stock Intelligence

CREATE TABLE IF NOT EXISTS public.purchase_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'weekly',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  source VARCHAR(40) NOT NULL DEFAULT 'inventory_intelligence',
  notes TEXT,
  total_items INT NOT NULL DEFAULT 0,
  total_estimated_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_plans_shop_created
  ON public.purchase_plans(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.purchase_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.purchase_plans(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  supplier_name VARCHAR(255),
  suggested_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  days_of_cover DECIMAL(10, 2),
  avg_daily_sold DECIMAL(15, 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_plan_items_plan
  ON public.purchase_plan_items(plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_plan_items_shop_supplier
  ON public.purchase_plan_items(shop_id, supplier_name, created_at DESC);
