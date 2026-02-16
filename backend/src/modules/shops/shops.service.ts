import jwt from 'jsonwebtoken';
import { supabase } from '../../config/supabase';
import { shopSchema } from '../../domain/validators';
import { logger } from '../../utils/logger';
import { sendClearDataPinEmail } from '../../utils/email';
import { env } from '../../config/env';
import { AuthService } from '../auth/auth.service';

const DASHBOARD_EDIT_TOKEN_EXPIRY = '15m';

const authService = new AuthService();

const STAFF_ROLES = ['manager', 'cashier', 'staff'] as const;

export class ShopsService {
  async createShop(userId: string, data: any) {
    const validated = shopSchema.parse(data);

    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert({
        ...validated,
        owner_id: userId,
      })
      .select()
      .single();

    if (shopError) {
      logger.error('Error creating shop:', shopError);
      throw new Error('Failed to create shop');
    }

    const { error: memberError } = await supabase.from('shop_members').insert({
      shop_id: shop.id,
      user_id: userId,
      role: 'owner',
    });

    if (memberError) {
      logger.error('Error adding shop member:', memberError);
      throw new Error('Failed to create shop');
    }

    return shop;
  }

  async getShopById(shopId: string) {
    const { data: shop, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();

    if (error) {
      logger.error('Error fetching shop:', error);
      throw new Error('Shop not found');
    }
    return shop;
  }

  async getUserShops(userId: string) {
    const { data: owned, error: ownedErr } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', userId);

    const { data: members, error: membersErr } = await supabase
      .from('shop_members')
      .select('shop_id, role')
      .eq('user_id', userId);

    if (ownedErr) logger.warn('[getUserShops] owned query error:', ownedErr);
    if (membersErr) logger.warn('[getUserShops] members query error:', membersErr);

    const ownedList = Array.isArray(owned) ? owned : [];
    const membersList = Array.isArray(members) ? members : [];

    const byId = new Map<string, any>();
    for (const s of ownedList) {
      const row = s as Record<string, unknown>;
      const id = row?.id != null ? String(row.id) : (row?.Id != null ? String(row.Id) : undefined);
      if (id) byId.set(id, { ...row, role: 'owner' });
    }
    if (membersList.length > 0) {
      const shopIds = membersList.map((m) => m?.shop_id).filter(Boolean);
      if (shopIds.length > 0) {
        const { data: shops } = await supabase.from('shops').select('*').in('id', shopIds);
        const shopsList = Array.isArray(shops) ? shops : [];
        for (const s of shopsList) {
          const sid = s?.id != null ? String(s.id) : undefined;
          if (!sid || byId.has(sid)) continue;
          const m = membersList.find(
            (x) => x?.shop_id != null && (String(x.shop_id) === sid || x.shop_id === s.id)
          );
          if (m) byId.set(sid, { ...s, role: m.role || 'staff' });
        }
      }
    }
    return Array.from(byId.values());
  }

  async updateShop(shopId: string, userId: string, data: any) {
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');

    const { data: member } = await supabase
      .from('shop_members')
      .select('role')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .maybeSingle();

    const isOwner = shop.owner_id === userId;
    const isManager = member?.role === 'manager';
    if (!isOwner && !isManager) throw new Error('Unauthorized to update shop');

    const validated = shopSchema.partial().parse(data);
    const { data: updated, error } = await supabase
      .from('shops')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', shopId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating shop:', error);
      throw new Error('Failed to update shop');
    }
    return updated;
  }

  async addMember(
    shopId: string,
    requesterUserId: string,
    data: { email: string; name?: string; password: string; role: string }
  ) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== requesterUserId) throw new Error('Only the owner can add staff');

    const email = (data.email || '').toLowerCase().trim();
    if (!email) throw new Error('Email is required');
    const password = data.password;
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

    const role = (data.role || 'staff').toLowerCase();
    if (!STAFF_ROLES.includes(role as any)) throw new Error('Role must be manager, cashier, or staff');

    const user = await authService.createUserForShop(
      (data.name || '').trim() || email.split('@')[0],
      email,
      password
    );

    const { data: existingMember } = await supabase
      .from('shop_members')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      await supabase
        .from('shop_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('shop_id', shopId)
        .eq('user_id', user.id);
      return { user_id: user.id, name: user.name, email: user.email, role, added: false };
    }

    await supabase.from('shop_members').insert({
      shop_id: shopId,
      user_id: user.id,
      role,
    });
    return { user_id: user.id, name: user.name, email: user.email, role, added: true };
  }

  async getShopMembers(shopId: string, requesterUserId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== requesterUserId) throw new Error('Only the owner can view shop members');

    const { data: members } = await supabase
      .from('shop_members')
      .select('id, user_id, role, created_at')
      .eq('shop_id', shopId);

    const list = members || [];
    const userIds = [...new Set(list.map((m: any) => m.user_id).filter(Boolean))];
    if (shop.owner_id && !userIds.includes(shop.owner_id)) userIds.push(shop.owner_id);

    const usersMap = new Map<string, { name: string; email: string }>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);
      (users || []).forEach((u: any) => usersMap.set(u.id, { name: u.name || '—', email: u.email || '—' }));
    }

    const result: Array<{ id?: string; user_id: string; role: string; name: string; email: string; is_owner: boolean }> = [];
    const ownerId = shop.owner_id;
    const ownerUser = ownerId ? usersMap.get(ownerId) : null;
    if (ownerId && ownerUser) {
      result.push({
        user_id: ownerId,
        role: 'owner',
        name: ownerUser.name,
        email: ownerUser.email,
        is_owner: true,
      });
    }
    list.forEach((m: any) => {
      if (m.user_id === ownerId) return;
      const u = usersMap.get(m.user_id);
      result.push({
        id: m.id,
        user_id: m.user_id,
        role: m.role || 'staff',
        name: (u && u.name) || '—',
        email: (u && u.email) || '—',
        is_owner: false,
      });
    });
    return result;
  }

  async removeMember(shopId: string, memberUserId: string, requesterUserId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== requesterUserId) throw new Error('Only the owner can remove members');
    if (memberUserId === shop.owner_id) throw new Error('Cannot remove the shop owner');

    const { error } = await supabase
      .from('shop_members')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', memberUserId);

    if (error) {
      logger.error('Error removing member:', error);
      throw new Error('Failed to remove member');
    }
    return { removed: true };
  }

  async transferOwnership(shopId: string, newOwnerUserId: string, requesterUserId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== requesterUserId) throw new Error('Only the current owner can transfer ownership');
    if (newOwnerUserId === shop.owner_id) throw new Error('New owner must be different from current owner');

    const { data: newOwnerUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', newOwnerUserId)
      .maybeSingle();
    if (!newOwnerUser) throw new Error('New owner user not found');

    const { error: updateErr } = await supabase
      .from('shops')
      .update({ owner_id: newOwnerUserId, updated_at: new Date().toISOString() })
      .eq('id', shopId);
    if (updateErr) {
      logger.error('Error transferring ownership:', updateErr);
      throw new Error('Failed to transfer ownership');
    }

    await supabase
      .from('shop_members')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', requesterUserId);

    const { data: existingMember } = await supabase
      .from('shop_members')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', newOwnerUserId)
      .maybeSingle();

    if (!existingMember) {
      await supabase.from('shop_members').insert({
        shop_id: shopId,
        user_id: newOwnerUserId,
        role: 'owner',
      });
    } else {
      await supabase
        .from('shop_members')
        .update({ role: 'owner', updated_at: new Date().toISOString() })
        .eq('shop_id', shopId)
        .eq('user_id', newOwnerUserId);
    }

    return { transferred: true, newOwnerId: newOwnerUserId };
  }

  async deleteShop(shopId: string, userId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== userId) throw new Error('Only the owner can delete this shop');

    const { data: sales } = await supabase.from('sales').select('id').eq('shop_id', shopId);
    const saleIds = (sales || []).map((s: any) => s.id);
    if (saleIds.length > 0) {
      const { error: itemsErr } = await supabase.from('sale_items').delete().in('sale_id', saleIds);
      if (itemsErr) {
        logger.error('Error deleting sale_items:', itemsErr);
        throw new Error('Failed to delete shop');
      }
    }

    const { error } = await supabase.from('shops').delete().eq('id', shopId);
    if (error) {
      logger.error('Error deleting shop:', error);
      throw new Error('Failed to delete shop');
    }
    return { deleted: true };
  }

  /** Owner-only: request a 6-digit PIN to open the dashboard edit interface. PIN is sent to user email. */
  async requestClearDataPin(shopId: string, userId: string, password: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== userId) throw new Error('Only the shop owner can open dashboard edit');

    const valid = await authService.verifyPassword(userId, password);
    if (!valid) throw new Error('Invalid password');

    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const purpose = 'clear_dashboard';

    await supabase
      .from('pin_verifications')
      .delete()
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .eq('purpose', purpose);

    const { error: insertErr } = await supabase.from('pin_verifications').insert({
      user_id: userId,
      shop_id: shopId,
      pin,
      purpose,
      expires_at: expiresAt,
    });
    if (insertErr) {
      logger.error('Error saving PIN:', insertErr);
      throw new Error('Failed to generate PIN');
    }

    const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
    const toEmail = (user as any)?.email;
    if (toEmail) {
      const sent = await sendClearDataPinEmail(toEmail, pin);
      if (!sent) logger.warn(`[Dashboard edit] PIN email failed for ${toEmail}; PIN: ${pin}`);
    }
    return { message: 'PIN sent to your email. Check your inbox (and spam folder).' };
  }

  /** Owner-only: verify PIN and return a short-lived token to use the dashboard edit interface. */
  async confirmDashboardEdit(shopId: string, userId: string, pin: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== userId) throw new Error('Only the shop owner can open dashboard edit');

    const normalizedPin = (pin || '').trim();
    if (normalizedPin.length !== 6) throw new Error('PIN must be 6 digits');

    const { data: row, error: findErr } = await supabase
      .from('pin_verifications')
      .select('id')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .eq('purpose', 'clear_dashboard')
      .eq('pin', normalizedPin)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (findErr || !row) throw new Error('Invalid or expired PIN');

    await supabase.from('pin_verifications').delete().eq('id', row.id);

    const dashboardEditToken = jwt.sign(
      { purpose: 'dashboard_edit', shopId, userId },
      env.jwtSecret,
      { expiresIn: DASHBOARD_EDIT_TOKEN_EXPIRY }
    );
    return { dashboardEditToken, expiresIn: 900 };
  }

  /**
   * Owner-only (via dashboard edit token): set data_cleared_at so the dashboard only shows data from now on.
   */
  async clearDashboardData(shopId: string, userId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== userId) throw new Error('Only the shop owner can clear dashboard data');

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('shops')
      .update({ data_cleared_at: now, updated_at: now })
      .eq('id', shopId);
    if (updateErr) {
      logger.error('Error setting data_cleared_at:', updateErr);
      throw new Error('Failed to clear dashboard data');
    }
    return { cleared: true };
  }

  /**
   * Owner-only (via dashboard edit token): reset data_cleared_at so the main dashboard shows all data again.
   */
  async resetDashboardView(shopId: string, userId: string) {
    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
    if (!shop) throw new Error('Shop not found');
    if (shop.owner_id !== userId) throw new Error('Only the shop owner can reset dashboard view');

    const { error: updateErr } = await supabase
      .from('shops')
      .update({ data_cleared_at: null, updated_at: new Date().toISOString() })
      .eq('id', shopId);
    if (updateErr) {
      logger.error('Error resetting data_cleared_at:', updateErr);
      throw new Error('Failed to reset dashboard view');
    }
    return { reset: true };
  }
}
