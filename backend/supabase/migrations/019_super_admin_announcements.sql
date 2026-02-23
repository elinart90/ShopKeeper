-- Platform announcements and delivery tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('all', 'shop_ids', 'plan', 'region')),
  target_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_status_created
  ON public.admin_announcements(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_announcement_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app')),
  status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_announcement_deliveries_announcement
  ON public.admin_announcement_deliveries(announcement_id, status);

CREATE INDEX IF NOT EXISTS idx_admin_announcement_deliveries_user
  ON public.admin_announcement_deliveries(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_announcement_deliveries_shop
  ON public.admin_announcement_deliveries(shop_id, sent_at DESC);
