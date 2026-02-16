"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersService = void 0;
const supabase_1 = require("../../config/supabase");
const validators_1 = require("../../domain/validators");
const logger_1 = require("../../utils/logger");
class MembersService {
    async createCustomer(shopId, data) {
        const validated = validators_1.customerSchema.parse(data);
        const { data: customer, error } = await supabase_1.supabase
            .from('customers')
            .insert({ ...validated, shop_id: shopId })
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error creating customer:', error);
            throw new Error('Failed to create customer');
        }
        return customer;
    }
    async getCustomers(shopId, search) {
        let query = supabase_1.supabase
            .from('customers')
            .select('*')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });
        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        }
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching customers:', error);
            throw new Error('Failed to fetch customers');
        }
        return data || [];
    }
    async getCustomerById(customerId) {
        const { data, error } = await supabase_1.supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();
        if (error) {
            logger_1.logger.error('Error fetching customer:', error);
            throw new Error('Customer not found');
        }
        return data;
    }
    async updateCustomer(customerId, shopId, data) {
        const validated = validators_1.customerSchema.partial().parse(data);
        const { data: customer, error } = await supabase_1.supabase
            .from('customers')
            .update({ ...validated, updated_at: new Date().toISOString() })
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error updating customer:', error);
            throw new Error('Failed to update customer');
        }
        return customer;
    }
    /** Credit & Customer Risk: customers owing money and total exposure */
    async getCreditSummary(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('customers')
            .select('id, name, phone, email, credit_balance, credit_limit')
            .eq('shop_id', shopId)
            .gt('credit_balance', 0)
            .order('credit_balance', { ascending: false });
        if (error) {
            logger_1.logger.error('Error fetching credit summary:', error);
            throw new Error('Failed to fetch credit summary');
        }
        const customersOwing = (data || []).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            credit_balance: Number(c.credit_balance || 0),
            credit_limit: Number(c.credit_limit || 0),
        }));
        const totalExposure = customersOwing.reduce((sum, c) => sum + c.credit_balance, 0);
        return {
            totalExposure,
            count: customersOwing.length,
            customersOwing,
        };
    }
    /** Record customer credit repayment, reduce balance, and post to sales for dashboard visibility. */
    async recordCreditPayment(customerId, shopId, userId, amount, paymentMethod, notes) {
        const customer = await this.getCustomerById(customerId);
        if (String(customer.shop_id) !== String(shopId)) {
            throw new Error('Customer not found');
        }
        const currentBalance = Number(customer.credit_balance || 0);
        if (currentBalance <= 0) {
            throw new Error('Customer has no outstanding credit');
        }
        const paymentAmount = Number(amount);
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new Error('Invalid payment amount');
        }
        const normalizedMethod = String(paymentMethod || 'cash').toLowerCase();
        if (!MembersService.ALLOWED_PAYMENT_METHODS.includes(normalizedMethod)) {
            throw new Error('Invalid payment method');
        }
        const newBalance = Math.max(0, Number((currentBalance - paymentAmount).toFixed(2)));
        const { data: updated, error } = await supabase_1.supabase
            .from('customers')
            .update({
            credit_balance: newBalance,
            updated_at: new Date().toISOString(),
        })
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .select('*')
            .single();
        if (error) {
            logger_1.logger.error('Error recording customer credit payment:', error);
            throw new Error('Failed to record payment');
        }
        const saleNumber = `CRPAY-${Date.now().toString(36).toUpperCase()}`;
        const { error: saleError } = await supabase_1.supabase.from('sales').insert({
            shop_id: shopId,
            customer_id: customerId,
            sale_number: saleNumber,
            total_amount: paymentAmount,
            discount_amount: 0,
            tax_amount: 0,
            final_amount: paymentAmount,
            payment_method: normalizedMethod,
            status: 'completed',
            notes: notes?.trim()
                ? `[CREDIT_REPAYMENT] Credit repayment: ${notes.trim()}`
                : '[CREDIT_REPAYMENT] Credit repayment',
            created_by: userId,
        });
        if (saleError) {
            logger_1.logger.error('Error posting credit repayment to sales:', saleError);
            // Keep payment applied even if mirror sales record fails.
        }
        return updated;
    }
}
exports.MembersService = MembersService;
MembersService.ALLOWED_PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card'];
//# sourceMappingURL=members.service.js.map