-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    credit_balance DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer transactions (for credit tracking)
CREATE TABLE customer_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    sale_id UUID, -- References sales table
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'credit', 'payment'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL -- Clerk user ID
);

-- Create indexes
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customer_transactions_customer_id ON customer_transactions(customer_id);
CREATE INDEX idx_customer_transactions_shop_id ON customer_transactions(shop_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;
