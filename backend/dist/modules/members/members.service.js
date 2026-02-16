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
}
exports.MembersService = MembersService;
//# sourceMappingURL=members.service.js.map