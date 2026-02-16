import { supabase } from '../../config/supabase';
import { walletAdjustmentSchema, walletTransferSchema } from '../../domain/validators';
import { logger } from '../../utils/logger';

const WALLET_TYPES = ['business', 'personal', 'savings'] as const;

export class WalletsService {
  async ensureWallets(shopId: string, currency: string) {
    const { data: existing } = await supabase.from('wallets').select('id').eq('shop_id', shopId);
    if ((existing || []).length >= 3) return;
    const names: Record<string, string> = { business: 'Business Wallet', personal: 'Personal Wallet', savings: 'Savings Wallet' };
    for (const type of WALLET_TYPES) {
      const { data: found } = await supabase
        .from('wallets')
        .select('id')
        .eq('shop_id', shopId)
        .eq('type', type)
        .maybeSingle();
      if (!found) {
        await supabase.from('wallets').insert({
          shop_id: shopId,
          type,
          name: names[type],
          balance: 0,
          currency,
        });
      }
    }
  }

  async getWallets(shopId: string) {
    await this.ensureWallets(shopId, 'USD');
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('shop_id', shopId)
      .order('type', { ascending: true });
    if (error) {
      logger.error('Error fetching wallets:', error);
      throw new Error('Failed to fetch wallets');
    }
    return data || [];
  }

  async getWalletTransactions(shopId: string, walletId?: string, limit = 50) {
    let query = supabase
      .from('wallet_transactions')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (walletId) {
      query = query.or(`wallet_id.eq.${walletId},from_wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`);
    }
    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching wallet transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
    return data || [];
  }

  async adjustBalance(shopId: string, userId: string, body: any) {
    const v = walletAdjustmentSchema.parse(body);
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', v.wallet_id)
      .eq('shop_id', shopId)
      .single();
    if (!wallet) throw new Error('Wallet not found');
    const amount = v.type === 'inflow' ? Math.abs(v.amount) : -Math.abs(v.amount);
    const newBalance = Number(wallet.balance) + amount;
    if (newBalance < 0) throw new Error('Insufficient balance');
    const txType = v.type === 'inflow' ? 'inflow' : 'outflow';
    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      shop_id: shopId,
      wallet_id: v.wallet_id,
      type: txType,
      amount: Math.abs(v.amount),
      description: v.description || (v.type === 'inflow' ? 'Cash in' : 'Cash out'),
      created_by: userId,
    });
    if (txErr) throw new Error('Failed to record transaction');
    const { data: updated, error } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', v.wallet_id)
      .select()
      .single();
    if (error) throw new Error('Failed to update balance');
    return updated;
  }

  async transfer(shopId: string, userId: string, body: any) {
    const v = walletTransferSchema.parse(body);
    const { data: from } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', v.from_wallet_id)
      .eq('shop_id', shopId)
      .single();
    const { data: to } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', v.to_wallet_id)
      .eq('shop_id', shopId)
      .single();
    if (!from || !to) throw new Error('Wallet not found');
    if (Number(from.balance) < v.amount) throw new Error('Insufficient balance');
    const txDesc = v.description || `Transfer to ${to.name}`;
    const { error: txOutErr } = await supabase.from('wallet_transactions').insert({
      shop_id: shopId,
      wallet_id: v.from_wallet_id,
      type: 'transfer_out',
      amount: v.amount,
      to_wallet_id: v.to_wallet_id,
      description: txDesc,
      created_by: userId,
    });
    if (txOutErr) throw new Error('Failed to record transfer');
    const { error: txInErr } = await supabase.from('wallet_transactions').insert({
      shop_id: shopId,
      wallet_id: v.to_wallet_id,
      type: 'transfer_in',
      amount: v.amount,
      from_wallet_id: v.from_wallet_id,
      description: txDesc,
      created_by: userId,
    });
    if (txInErr) throw new Error('Failed to record transfer');
    await supabase
      .from('wallets')
      .update({ balance: Number(from.balance) - v.amount, updated_at: new Date().toISOString() })
      .eq('id', v.from_wallet_id);
    const { data: toUpdated } = await supabase
      .from('wallets')
      .update({ balance: Number(to.balance) + v.amount, updated_at: new Date().toISOString() })
      .eq('id', v.to_wallet_id)
      .select()
      .single();
    return toUpdated;
  }
}
