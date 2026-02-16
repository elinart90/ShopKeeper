import { supabase } from '../../config/supabase';
import { dailyCloseSchema } from '../../domain/validators';
import { logger } from '../../utils/logger';

export class DailyCloseService {
  async create(shopId: string, userId: string, body: unknown) {
    const v = dailyCloseSchema.parse(body);
    const closeDate = v.close_date || new Date().toISOString().slice(0, 10);
    const difference = Number(v.actual_cash) - Number(v.expected_cash);
    const { data, error } = await supabase
      .from('daily_close')
      .upsert(
        {
          shop_id: shopId,
          close_date: closeDate,
          expected_cash: v.expected_cash,
          actual_cash: v.actual_cash,
          difference,
          closed_by: userId,
          status: 'pending',
          notes: v.notes,
        },
        { onConflict: 'shop_id,close_date' }
      )
      .select()
      .single();
    if (error) {
      logger.error('Error creating daily close:', error);
      throw new Error('Failed to create daily close');
    }
    return data;
  }

  async approve(shopId: string, userId: string, id: string) {
    const { data: shop } = await supabase.from('shops').select('owner_id').eq('id', shopId).single();
    if (!shop || shop.owner_id !== userId) throw new Error('Only the owner can approve daily close');
    const { data, error } = await supabase
      .from('daily_close')
      .update({
        status: 'approved',
        approved_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select()
      .single();
    if (error) throw new Error('Failed to approve');
    return data;
  }

  async reject(shopId: string, userId: string, id: string) {
    const { data: shop } = await supabase.from('shops').select('owner_id').eq('id', shopId).single();
    if (!shop || shop.owner_id !== userId) throw new Error('Only the owner can reject daily close');
    const { data, error } = await supabase
      .from('daily_close')
      .update({
        status: 'rejected',
        approved_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('shop_id', shopId)
      .select()
      .single();
    if (error) throw new Error('Failed to reject');
    return data;
  }

  async getByDate(shopId: string, closeDate: string) {
    const { data, error } = await supabase
      .from('daily_close')
      .select('*')
      .eq('shop_id', shopId)
      .eq('close_date', closeDate)
      .maybeSingle();
    if (error) throw new Error('Failed to fetch daily close');
    return data;
  }

  async getRecent(shopId: string, limit = 14) {
    const { data, error } = await supabase
      .from('daily_close')
      .select('*')
      .eq('shop_id', shopId)
      .order('close_date', { ascending: false })
      .limit(limit);
    if (error) throw new Error('Failed to fetch daily closes');
    return data || [];
  }
}
