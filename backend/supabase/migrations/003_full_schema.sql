-- Run this in Supabase Dashboard → SQL Editor (after 001_create_users.sql and 002_create_shops.sql)
-- Creates: customers, categories, products, stock_movements, sales, sale_items, expense_categories, expenses

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    credit_balance DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);

-- Categories (for products)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, name)
);
CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON public.categories(shop_id);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    barcode VARCHAR(255),
    sku VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'piece',
    cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    stock_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(15, 3) DEFAULT 0,
    max_stock_level DECIMAL(15, 3),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- Stock movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    previous_quantity DECIMAL(15, 3) NOT NULL,
    new_quantity DECIMAL(15, 3) NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_id ON public.stock_movements(shop_id);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    sale_number VARCHAR(100) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON public.sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- Sale items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- Expense categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, name)
);
CREATE INDEX IF NOT EXISTS idx_expense_categories_shop_id ON public.expense_categories(shop_id);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON public.expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
