-- Advanced security and compliance foundation for super-admin

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Per-login session tracking for device/session management
CREATE TABLE IF NOT EXISTS public.platform_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  terminated_at TIMESTAMPTZ,
  terminated_reason TEXT,
  terminated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_user_active ON public.platform_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_last_seen ON public.platform_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_ip ON public.platform_sessions(ip_address);

-- Request-level API access logs for compliance/debugging
CREATE TABLE IF NOT EXISTS public.admin_api_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  query_json JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_api_access_logs_created_at ON public.admin_api_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_api_access_logs_actor ON public.admin_api_access_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_api_access_logs_path ON public.admin_api_access_logs(path);

-- GDPR wipe execution tracker
CREATE TABLE IF NOT EXISTS public.gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  summary_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT gdpr_deletion_requests_status_check CHECK (status IN ('pending', 'completed', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_user ON public.gdpr_deletion_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_status ON public.gdpr_deletion_requests(status, created_at DESC);

-- Per-user security policy flags (includes forced 2FA)
CREATE TABLE IF NOT EXISTS public.user_security_policies (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  enforced_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  enforced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
