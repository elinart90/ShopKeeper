-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'cashier', 'staff');
CREATE TYPE payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'card', 'credit');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');
CREATE TYPE stock_action AS ENUM ('sale', 'purchase', 'adjustment', 'transfer', 'damaged', 'expired');
