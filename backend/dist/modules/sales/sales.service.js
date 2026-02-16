"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesService = void 0;
const supabase_1 = require("../../config/supabase");
const validators_1 = require("../../domain/validators");
const id_1 = require("../../utils/id");
const logger_1 = require("../../utils/logger");
const inventory_service_1 = require("../inventory/inventory.service");
const inventoryService = new inventory_service_1.InventoryService();
class SalesService {
    async createSale(shopId, userId, data) {
        const validated = validators_1.saleSchema.parse(data);
        let totalAmount = 0;
        const saleItems = [];
        for (const item of validated.items) {
            const product = await inventoryService.getProductById(item.product_id);
            if (product.shop_id !== shopId) {
                throw new Error(`Product ${item.product_id} does not belong to this shop`);
            }
            if (Number(product.stock_quantity) < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}`);
            }
            const itemTotal = item.unit_price * item.quantity - (item.discount_amount || 0);
            totalAmount += itemTotal;
            saleItems.push({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_amount: item.discount_amount || 0,
                total_price: itemTotal,
            });
        }
        const finalAmount = totalAmount - (validated.discount_amount || 0) + (validated.tax_amount || 0);
        const saleNumber = (0, id_1.generateSaleNumber)(shopId);
        const { data: sale, error: saleError } = await supabase_1.supabase
            .from('sales')
            .insert({
            shop_id: shopId,
            customer_id: validated.customer_id || null,
            sale_number: saleNumber,
            total_amount: totalAmount,
            discount_amount: validated.discount_amount || 0,
            tax_amount: validated.tax_amount || 0,
            final_amount: finalAmount,
            payment_method: validated.payment_method,
            status: 'completed',
            notes: validated.notes,
            created_by: userId,
        })
            .select()
            .single();
        if (saleError) {
            logger_1.logger.error('Error creating sale:', saleError);
            throw new Error('Failed to create sale');
        }
        const itemsToInsert = saleItems.map((item) => ({ ...item, sale_id: sale.id }));
        const { error: itemsError } = await supabase_1.supabase.from('sale_items').insert(itemsToInsert);
        if (itemsError) {
            logger_1.logger.error('Error creating sale items:', itemsError);
            await supabase_1.supabase.from('sales').delete().eq('id', sale.id);
            throw new Error('Failed to create sale items');
        }
        for (const item of validated.items) {
            const product = await inventoryService.getProductById(item.product_id);
            const newQuantity = Number(product.stock_quantity) - item.quantity;
            await supabase_1.supabase
                .from('products')
                .update({
                stock_quantity: newQuantity,
                updated_at: new Date().toISOString(),
            })
                .eq('id', item.product_id);
            await inventoryService.logStockMovement(shopId, item.product_id, userId, 'sale', item.quantity, Number(product.stock_quantity), newQuantity, `Sale ${saleNumber}`);
        }
        if (validated.payment_method === 'credit' && validated.customer_id) {
            const { data: customer } = await supabase_1.supabase
                .from('customers')
                .select('credit_balance')
                .eq('id', validated.customer_id)
                .single();
            if (customer) {
                await supabase_1.supabase
                    .from('customers')
                    .update({
                    credit_balance: Number(customer.credit_balance) + finalAmount,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', validated.customer_id);
            }
        }
        return this.getSaleById(sale.id);
    }
    async getSaleById(saleId) {
        const { data: sale, error } = await supabase_1.supabase
            .from('sales')
            .select(`
        *,
        customer:customers(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `)
            .eq('id', saleId)
            .single();
        if (error) {
            logger_1.logger.error('Error fetching sale:', error);
            throw new Error('Sale not found');
        }
        return sale;
    }
    async getSales(shopId, filters) {
        let query = supabase_1.supabase
            .from('sales')
            .select(`
        *,
        customer:customers(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });
        if (filters?.startDate)
            query = query.gte('created_at', filters.startDate);
        if (filters?.endDate)
            query = query.lte('created_at', filters.endDate);
        if (filters?.customer_id)
            query = query.eq('customer_id', filters.customer_id);
        if (filters?.payment_method)
            query = query.eq('payment_method', filters.payment_method);
        if (filters?.status)
            query = query.eq('status', filters.status);
        if (filters?.limit)
            query = query.limit(filters.limit);
        if (filters?.offset)
            query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching sales:', error);
            throw new Error('Failed to fetch sales');
        }
        return data || [];
    }
    async getSalesSummary(shopId, startDate, endDate) {
        let query = supabase_1.supabase
            .from('sales')
            .select('final_amount, payment_method, created_at')
            .eq('shop_id', shopId)
            .eq('status', 'completed');
        if (startDate)
            query = query.gte('created_at', startDate);
        if (endDate)
            query = query.lte('created_at', endDate);
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching sales summary:', error);
            throw new Error('Failed to fetch sales summary');
        }
        const sales = data || [];
        const totalSales = sales.reduce((sum, s) => sum + Number(s.final_amount), 0);
        const totalTransactions = sales.length;
        const paymentMethodBreakdown = sales.reduce((acc, s) => {
            const method = s.payment_method;
            acc[method] = (acc[method] || 0) + Number(s.final_amount);
            return acc;
        }, {});
        return {
            totalSales,
            totalTransactions,
            averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0,
            paymentMethodBreakdown,
        };
    }
    async cancelSale(saleId, shopId, userId) {
        const sale = await this.getSaleById(saleId);
        if (sale.shop_id !== shopId)
            throw new Error('Sale does not belong to this shop');
        if (sale.status !== 'completed')
            throw new Error('Only completed sales can be cancelled');
        for (const item of sale.items || []) {
            const product = await inventoryService.getProductById(item.product_id);
            const newQuantity = Number(product.stock_quantity) + item.quantity;
            await supabase_1.supabase
                .from('products')
                .update({
                stock_quantity: newQuantity,
                updated_at: new Date().toISOString(),
            })
                .eq('id', item.product_id);
            await inventoryService.logStockMovement(shopId, item.product_id, userId, 'adjustment', item.quantity, Number(product.stock_quantity), newQuantity, `Sale cancellation: ${sale.sale_number}`);
        }
        if (sale.payment_method === 'credit' && sale.customer_id) {
            const { data: customer } = await supabase_1.supabase
                .from('customers')
                .select('credit_balance')
                .eq('id', sale.customer_id)
                .single();
            if (customer) {
                await supabase_1.supabase
                    .from('customers')
                    .update({
                    credit_balance: Number(customer.credit_balance) - Number(sale.final_amount),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', sale.customer_id);
            }
        }
        const { data: updatedSale, error } = await supabase_1.supabase
            .from('sales')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', saleId)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error cancelling sale:', error);
            throw new Error('Failed to cancel sale');
        }
        return updatedSale;
    }
}
exports.SalesService = SalesService;
//# sourceMappingURL=sales.service.js.map