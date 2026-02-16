import { z } from 'zod';
export declare const shopSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const productSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    unit: z.ZodDefault<z.ZodString>;
    cost_price: z.ZodNumber;
    selling_price: z.ZodNumber;
    stock_quantity: z.ZodDefault<z.ZodNumber>;
    min_stock_level: z.ZodDefault<z.ZodNumber>;
    max_stock_level: z.ZodOptional<z.ZodNumber>;
    expiry_date: z.ZodOptional<z.ZodString>;
    image_url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const productUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sku: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    unit: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    cost_price: z.ZodOptional<z.ZodNumber>;
    selling_price: z.ZodOptional<z.ZodNumber>;
    stock_quantity: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    min_stock_level: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    max_stock_level: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    expiry_date: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    image_url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const saleItemSchema: z.ZodObject<{
    product_id: z.ZodString;
    quantity: z.ZodNumber;
    unit_price: z.ZodNumber;
    discount_amount: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const saleSchema: z.ZodObject<{
    customer_id: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        quantity: z.ZodNumber;
        unit_price: z.ZodNumber;
        discount_amount: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    discount_amount: z.ZodDefault<z.ZodNumber>;
    tax_amount: z.ZodDefault<z.ZodNumber>;
    payment_method: z.ZodDefault<z.ZodEnum<{
        cash: "cash";
        mobile_money: "mobile_money";
        bank_transfer: "bank_transfer";
        card: "card";
        credit: "credit";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const customerSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    credit_limit: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const expenseSchema: z.ZodObject<{
    category_id: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    description: z.ZodString;
    expense_date: z.ZodOptional<z.ZodString>;
    payment_method: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const walletAdjustmentSchema: z.ZodObject<{
    wallet_id: z.ZodString;
    amount: z.ZodNumber;
    type: z.ZodEnum<{
        inflow: "inflow";
        outflow: "outflow";
    }>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const walletTransferSchema: z.ZodObject<{
    from_wallet_id: z.ZodString;
    to_wallet_id: z.ZodString;
    amount: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const dailyCloseSchema: z.ZodObject<{
    close_date: z.ZodOptional<z.ZodString>;
    expected_cash: z.ZodDefault<z.ZodNumber>;
    actual_cash: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=validators.d.ts.map