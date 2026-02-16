-- Sales/Transactions
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    sale_number VARCHAR(100) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    status transaction_status NOT NULL DEFAULT 'completed',
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL, -- Clerk user ID
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sale items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sales_shop_id ON sales(shop_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_sale_number ON sales(sale_number);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
