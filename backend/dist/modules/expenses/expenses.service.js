"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesService = void 0;
const supabase_1 = require("../../config/supabase");
const validators_1 = require("../../domain/validators");
const logger_1 = require("../../utils/logger");
class ExpensesService {
    async createExpense(shopId, userId, data) {
        const validated = validators_1.expenseSchema.parse(data);
        const expense_date = validated.expense_date || new Date().toISOString().split('T')[0];
        const { data: expense, error } = await supabase_1.supabase
            .from('expenses')
            .insert({
            ...validated,
            shop_id: shopId,
            created_by: userId,
            expense_date,
        })
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error creating expense:', error);
            throw new Error('Failed to create expense');
        }
        return expense;
    }
    async getExpenses(shopId, filters) {
        let query = supabase_1.supabase
            .from('expenses')
            .select('*, category:expense_categories(*)')
            .eq('shop_id', shopId)
            .order('expense_date', { ascending: false });
        if (filters?.startDate)
            query = query.gte('expense_date', filters.startDate);
        if (filters?.endDate)
            query = query.lte('expense_date', filters.endDate);
        if (filters?.category_id)
            query = query.eq('category_id', filters.category_id);
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching expenses:', error);
            throw new Error('Failed to fetch expenses');
        }
        return data || [];
    }
    async getExpenseCategories(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('expense_categories')
            .select('id, name, description')
            .eq('shop_id', shopId)
            .order('name');
        if (error) {
            logger_1.logger.error('Error fetching expense categories:', error);
            throw new Error('Failed to fetch expense categories');
        }
        return data || [];
    }
    async createExpenseCategory(shopId, data) {
        const name = (data.name || '').trim();
        if (!name)
            throw new Error('Category name is required');
        const { data: category, error } = await supabase_1.supabase
            .from('expense_categories')
            .insert({ shop_id: shopId, name, description: data.description || null })
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error creating expense category:', error);
            throw new Error(error.code === '23505' ? 'Category name already exists' : 'Failed to create category');
        }
        return category;
    }
}
exports.ExpensesService = ExpensesService;
//# sourceMappingURL=expenses.service.js.map