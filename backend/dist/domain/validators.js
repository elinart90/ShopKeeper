"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyCloseSchema = exports.walletTransferSchema = exports.walletAdjustmentSchema = exports.expenseSchema = exports.customerSchema = exports.saleSchema = exports.saleItemSchema = exports.productUpdateSchema = exports.productSchema = exports.shopSchema = void 0;
const zod_1 = require("zod");
exports.shopSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    currency: zod_1.z.string().default('USD'),
    timezone: zod_1.z.string().default('UTC'),
});
const productBaseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    category_id: zod_1.z.string().min(1).optional(),
    barcode: zod_1.z.string().optional(),
    sku: zod_1.z.string().optional(),
    unit: zod_1.z.string().default('piece'),
    cost_price: zod_1.z.number().min(0),
    selling_price: zod_1.z.number().positive('Selling price must be greater than 0'),
    stock_quantity: zod_1.z.number().min(0).default(0),
    min_stock_level: zod_1.z.number().min(0).default(0),
    max_stock_level: zod_1.z.number().min(0).optional(),
    expiry_date: zod_1.z.string().date().optional(),
    image_url: zod_1.z.string().optional(),
});
exports.productSchema = productBaseSchema.refine((d) => d.cost_price <= d.selling_price, { message: 'Cost price should not be greater than selling price', path: ['cost_price'] });
exports.productUpdateSchema = productBaseSchema.partial().refine((d) => d.cost_price == null ||
    d.selling_price == null ||
    d.cost_price <= d.selling_price, { message: 'Cost price should not be greater than selling price', path: ['cost_price'] });
exports.saleItemSchema = zod_1.z.object({
    product_id: zod_1.z.string().min(1),
    quantity: zod_1.z.number().min(0.001),
    unit_price: zod_1.z.number().min(0),
    discount_amount: zod_1.z.number().min(0).default(0),
});
exports.saleSchema = zod_1.z.object({
    customer_id: zod_1.z.string().min(1).optional(),
    items: zod_1.z.array(exports.saleItemSchema).min(1),
    discount_amount: zod_1.z.number().min(0).default(0),
    tax_amount: zod_1.z.number().min(0).default(0),
    payment_method: zod_1.z.enum(['cash', 'mobile_money', 'bank_transfer', 'card', 'credit']).default('cash'),
    notes: zod_1.z.string().optional(),
});
exports.customerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    credit_limit: zod_1.z.number().min(0).default(0),
    notes: zod_1.z.string().optional(),
});
exports.expenseSchema = zod_1.z.object({
    category_id: zod_1.z.string().min(1).optional(),
    amount: zod_1.z.number().min(0),
    description: zod_1.z.string().min(1),
    expense_date: zod_1.z.string().date().optional(),
    payment_method: zod_1.z.string().optional(),
});
exports.walletAdjustmentSchema = zod_1.z.object({
    wallet_id: zod_1.z.string().min(1),
    amount: zod_1.z.number().refine((n) => n !== 0, 'Amount cannot be zero'),
    type: zod_1.z.enum(['inflow', 'outflow']),
    description: zod_1.z.string().optional(),
});
exports.walletTransferSchema = zod_1.z.object({
    from_wallet_id: zod_1.z.string().min(1),
    to_wallet_id: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive('Amount must be positive'),
    description: zod_1.z.string().optional(),
}).refine((d) => d.from_wallet_id !== d.to_wallet_id, { message: 'Cannot transfer to same wallet', path: ['to_wallet_id'] });
exports.dailyCloseSchema = zod_1.z.object({
    close_date: zod_1.z.string().date().optional(),
    expected_cash: zod_1.z.number().min(0).default(0),
    actual_cash: zod_1.z.number().min(0),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=validators.js.map