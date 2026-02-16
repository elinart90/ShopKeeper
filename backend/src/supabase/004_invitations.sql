-- Shop invitations for adding staff members
CREATE TABLE shop_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'staff',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by VARCHAR(255) NOT NULL, -- Clerk user ID
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_shop_invitations_shop_id ON shop_invitations(shop_id);
CREATE INDEX idx_shop_invitations_token ON shop_invitations(token);
CREATE INDEX idx_shop_invitations_email ON shop_invitations(email);

-- Enable RLS
ALTER TABLE shop_invitations ENABLE ROW LEVEL SECURITY;
