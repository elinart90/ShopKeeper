-- Run this in Supabase Dashboard → SQL Editor → New query
-- Creates shops and shop_members tables (required after creating users)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shops table
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    owner_id VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Shop members (staff)
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_active ON public.shops(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_members_shop_id ON public.shop_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_members_user_id ON public.shop_members(user_id);
