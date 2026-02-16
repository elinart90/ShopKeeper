-- Shops table
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    owner_id VARCHAR(255) NOT NULL, -- Clerk user ID
    currency VARCHAR(10) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Shop members (staff)
CREATE TABLE shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Clerk user ID
    role user_role NOT NULL DEFAULT 'staff',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

-- Create indexes
CREATE INDEX idx_shops_owner_id ON shops(owner_id);
CREATE INDEX idx_shops_active ON shops(is_active);
CREATE INDEX idx_shop_members_shop_id ON shop_members(shop_id);
CREATE INDEX idx_shop_members_user_id ON shop_members(user_id);

-- Enable RLS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
