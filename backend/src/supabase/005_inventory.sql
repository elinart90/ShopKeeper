-- Product categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, name)
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(255),
    sku VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'piece', -- piece, kg, liter, etc.
    cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    stock_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(15, 3) DEFAULT 0,
    max_stock_level DECIMAL(15, 3),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements/history
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    action stock_action NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    previous_quantity DECIMAL(15, 3) NOT NULL,
    new_quantity DECIMAL(15, 3) NOT NULL,
    reference_id UUID, -- Can reference sale_id, purchase_id, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL -- Clerk user ID
);

-- Create indexes
CREATE INDEX idx_categories_shop_id ON categories(shop_id);
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_shop_id ON stock_movements(shop_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
