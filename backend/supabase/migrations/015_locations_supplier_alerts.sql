-- Multi-location stock, supplier delivery verification, and pattern alerts foundation.

CREATE TABLE IF NOT EXISTS public.stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  location_type VARCHAR(40) NOT NULL DEFAULT 'store',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_shop
  ON public.stock_locations(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_location_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, location_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_location_balances_location
  ON public.stock_location_balances(shop_id, location_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  from_location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  to_location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(15, 3) NOT NULL,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  created_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_shop
  ON public.stock_transfers(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.supplier_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(120),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  expected_quantity DECIMAL(15, 3) NOT NULL,
  received_quantity DECIMAL(15, 3) NOT NULL,
  shortage_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
  delivery_person_name VARCHAR(255),
  delivery_signature TEXT,
  photo_url TEXT,
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_deliveries_shop_supplier
  ON public.supplier_deliveries(shop_id, supplier_name, created_at DESC);

