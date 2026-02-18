-- Staff & Controls foundation
-- Cash discrepancies, shifts, audit logs, and granular permissions.

CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_staff_permissions_shop_user
  ON public.staff_permissions(shop_id, user_id);

CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  opening_cash DECIMAL(15, 2) NOT NULL DEFAULT 0,
  expected_cash DECIMAL(15, 2),
  closing_cash DECIMAL(15, 2),
  discrepancy DECIMAL(15, 2),
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_shop_started
  ON public.shift_sessions(shop_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_shop_user
  ON public.shift_sessions(shop_id, user_id);

CREATE TABLE IF NOT EXISTS public.cash_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_discrepancies_shop_created
  ON public.cash_discrepancies(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_discrepancies_status
  ON public.cash_discrepancies(status);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(255),
  before_json JSONB,
  after_json JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_created
  ON public.audit_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_user
  ON public.audit_logs(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action);
