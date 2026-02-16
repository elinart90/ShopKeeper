import { supabase } from '../../config/supabase';
import { expenseSchema } from '../../domain/validators';
import { logger } from '../../utils/logger';

export class ExpensesService {
  async createExpense(shopId: string, userId: string, data: any) {
    const validated = expenseSchema.parse(data);

    const expense_date =
      validated.expense_date || new Date().toISOString().split('T')[0];

    const { data: expense, error } = await supabase
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
      logger.error('Error creating expense:', error);
      throw new Error('Failed to create expense');
    }
    return expense;
  }

  async getExpenses(
    shopId: string,
    filters?: { startDate?: string; endDate?: string; category_id?: string }
  ) {
    let query = supabase
      .from('expenses')
      .select('*, category:expense_categories(*)')
      .eq('shop_id', shopId)
      .order('expense_date', { ascending: false });

    if (filters?.startDate) query = query.gte('expense_date', filters.startDate);
    if (filters?.endDate) query = query.lte('expense_date', filters.endDate);
    if (filters?.category_id) query = query.eq('category_id', filters.category_id);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching expenses:', error);
      throw new Error('Failed to fetch expenses');
    }
    return data || [];
  }

  async getExpenseCategories(shopId: string) {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name, description')
      .eq('shop_id', shopId)
      .order('name');

    if (error) {
      logger.error('Error fetching expense categories:', error);
      throw new Error('Failed to fetch expense categories');
    }
    return data || [];
  }

  async createExpenseCategory(shopId: string, data: { name: string; description?: string }) {
    const name = (data.name || '').trim();
    if (!name) throw new Error('Category name is required');

    const { data: category, error } = await supabase
      .from('expense_categories')
      .insert({ shop_id: shopId, name, description: data.description || null })
      .select()
      .single();

    if (error) {
      logger.error('Error creating expense category:', error);
      throw new Error(error.code === '23505' ? 'Category name already exists' : 'Failed to create category');
    }
    return category;
  }
}
