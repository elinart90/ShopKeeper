import { z } from 'zod';

export const shopSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  currency: z.string().default('GHS'),
  timezone: z.string().default('UTC'),
});

const productBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category_id: z.string().min(1).optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().default('piece'),
  cost_price: z.number().min(0),
  selling_price: z.number().positive('Selling price must be greater than 0'),
  stock_quantity: z.number().min(0).default(0),
  min_stock_level: z.number().min(0).default(0),
  max_stock_level: z.number().min(0).optional(),
  expiry_date: z.string().date().optional(),
  image_url: z.string().optional(),
});

export const productSchema = productBaseSchema.refine(
  (d) => d.cost_price <= d.selling_price,
  { message: 'Cost price should not be greater than selling price', path: ['cost_price'] }
);

export const productUpdateSchema = productBaseSchema.partial().refine(
  (d) =>
    d.cost_price == null ||
    d.selling_price == null ||
    d.cost_price <= d.selling_price,
  { message: 'Cost price should not be greater than selling price', path: ['cost_price'] }
);

export const saleItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().min(0.001),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
});

export const saleSchema = z.object({
  customer_id: z.string().min(1).optional(),
  items: z.array(saleItemSchema).min(1),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  payment_method: z.enum(['cash', 'mobile_money', 'bank_transfer', 'card', 'credit']).default('cash'),
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  credit_limit: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  category_id: z.string().min(1).optional(),
  amount: z.number().min(0),
  description: z.string().min(1),
  expense_date: z.string().date().optional(),
  payment_method: z.string().optional(),
});

export const walletAdjustmentSchema = z.object({
  wallet_id: z.string().min(1),
  amount: z.number().refine((n) => n !== 0, 'Amount cannot be zero'),
  type: z.enum(['inflow', 'outflow']),
  description: z.string().optional(),
});

export const walletTransferSchema = z.object({
  from_wallet_id: z.string().min(1),
  to_wallet_id: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
}).refine((d) => d.from_wallet_id !== d.to_wallet_id, { message: 'Cannot transfer to same wallet', path: ['to_wallet_id'] });

export const dailyCloseSchema = z.object({
  close_date: z.string().date().optional(),
  expected_cash: z.number().min(0).default(0),
  actual_cash: z.number().min(0),
  notes: z.string().optional(),
});
