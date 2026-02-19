-- Stock count workflow (M2)
-- Supports mobile count sessions, partial counts, and two-person verification.

CREATE TABLE IF NOT EXISTS public.stock_count_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('all', 'category', 'section', 'product_list')),
  scope_value VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'submitted', 'reconciliation_required', 'completed', 'cancelled')),
  started_by VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_shop_started
  ON public.stock_count_sessions(shop_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  expected_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
  counted_qty_primary DECIMAL(15, 3),
  counted_qty_secondary DECIMAL(15, 3),
  requires_verification BOOLEAN NOT NULL DEFAULT false,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'not_required'
    CHECK (verification_status IN ('not_required', 'pending_second_count', 'matched', 'mismatch')),
  counted_by_primary VARCHAR(255),
  counted_by_secondary VARCHAR(255),
  counted_at_primary TIMESTAMPTZ,
  counted_at_secondary TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  last_counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_shop_session
  ON public.stock_count_items(shop_id, session_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_product
  ON public.stock_count_items(shop_id, product_id, updated_at DESC);

