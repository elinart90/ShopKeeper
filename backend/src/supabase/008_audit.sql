-- Audit log for tracking all important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Clerk user ID
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'view', etc.
    entity_type VARCHAR(100) NOT NULL, -- 'product', 'sale', 'customer', etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
