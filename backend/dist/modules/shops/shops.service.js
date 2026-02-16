"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopsService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../../config/supabase");
const validators_1 = require("../../domain/validators");
const logger_1 = require("../../utils/logger");
const email_1 = require("../../utils/email");
const env_1 = require("../../config/env");
const auth_service_1 = require("../auth/auth.service");
const DASHBOARD_EDIT_TOKEN_EXPIRY = '15m';
const authService = new auth_service_1.AuthService();
const STAFF_ROLES = ['manager', 'cashier', 'staff'];
class ShopsService {
    async createShop(userId, data) {
        const validated = validators_1.shopSchema.parse(data);
        const { data: shop, error: shopError } = await supabase_1.supabase
            .from('shops')
            .insert({
            ...validated,
            owner_id: userId,
        })
            .select()
            .single();
        if (shopError) {
            logger_1.logger.error('Error creating shop:', shopError);
            throw new Error('Failed to create shop');
        }
        const { error: memberError } = await supabase_1.supabase.from('shop_members').insert({
            shop_id: shop.id,
            user_id: userId,
            role: 'owner',
        });
        if (memberError) {
            logger_1.logger.error('Error adding shop member:', memberError);
            throw new Error('Failed to create shop');
        }
        return shop;
    }
    async getShopById(shopId) {
        const { data: shop, error } = await supabase_1.supabase
            .from('shops')
            .select('*')
            .eq('id', shopId)
            .single();
        if (error) {
            logger_1.logger.error('Error fetching shop:', error);
            throw new Error('Shop not found');
        }
        return shop;
    }
    async getUserShops(userId) {
        const { data: owned, error: ownedErr } = await supabase_1.supabase
            .from('shops')
            .select('*')
            .eq('owner_id', userId);
        const { data: members, error: membersErr } = await supabase_1.supabase
            .from('shop_members')
            .select('shop_id, role')
            .eq('user_id', userId);
        if (ownedErr)
            logger_1.logger.warn('[getUserShops] owned query error:', ownedErr);
        if (membersErr)
            logger_1.logger.warn('[getUserShops] members query error:', membersErr);
        const ownedList = Array.isArray(owned) ? owned : [];
        const membersList = Array.isArray(members) ? members : [];
        const byId = new Map();
        for (const s of ownedList) {
            const row = s;
            const id = row?.id != null ? String(row.id) : (row?.Id != null ? String(row.Id) : undefined);
            if (id)
                byId.set(id, { ...row, role: 'owner' });
        }
        if (membersList.length > 0) {
            const shopIds = membersList.map((m) => m?.shop_id).filter(Boolean);
            if (shopIds.length > 0) {
                const { data: shops } = await supabase_1.supabase.from('shops').select('*').in('id', shopIds);
                const shopsList = Array.isArray(shops) ? shops : [];
                for (const s of shopsList) {
                    const sid = s?.id != null ? String(s.id) : undefined;
                    if (!sid || byId.has(sid))
                        continue;
                    const m = membersList.find((x) => x?.shop_id != null && (String(x.shop_id) === sid || x.shop_id === s.id));
                    if (m)
                        byId.set(sid, { ...s, role: m.role || 'staff' });
                }
            }
        }
        return Array.from(byId.values());
    }
    async updateShop(shopId, userId, data) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('*').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        const { data: member } = await supabase_1.supabase
            .from('shop_members')
            .select('role')
            .eq('shop_id', shopId)
            .eq('user_id', userId)
            .maybeSingle();
        const isOwner = shop.owner_id === userId;
        const isManager = member?.role === 'manager';
        if (!isOwner && !isManager)
            throw new Error('Unauthorized to update shop');
        const validated = validators_1.shopSchema.partial().parse(data);
        const { data: updated, error } = await supabase_1.supabase
            .from('shops')
            .update({ ...validated, updated_at: new Date().toISOString() })
            .eq('id', shopId)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error updating shop:', error);
            throw new Error('Failed to update shop');
        }
        return updated;
    }
    async addMember(shopId, requesterUserId, data) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== requesterUserId)
            throw new Error('Only the owner can add staff');
        const email = (data.email || '').toLowerCase().trim();
        if (!email)
            throw new Error('Email is required');
        const password = data.password;
        if (!password || password.length < 8)
            throw new Error('Password must be at least 8 characters');
        const role = (data.role || 'staff').toLowerCase();
        if (!STAFF_ROLES.includes(role))
            throw new Error('Role must be manager, cashier, or staff');
        const user = await authService.createUserForShop((data.name || '').trim() || email.split('@')[0], email, password);
        const { data: existingMember } = await supabase_1.supabase
            .from('shop_members')
            .select('id')
            .eq('shop_id', shopId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (existingMember) {
            await supabase_1.supabase
                .from('shop_members')
                .update({ role, updated_at: new Date().toISOString() })
                .eq('shop_id', shopId)
                .eq('user_id', user.id);
            return { user_id: user.id, name: user.name, email: user.email, role, added: false };
        }
        await supabase_1.supabase.from('shop_members').insert({
            shop_id: shopId,
            user_id: user.id,
            role,
        });
        return { user_id: user.id, name: user.name, email: user.email, role, added: true };
    }
    async getShopMembers(shopId, requesterUserId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== requesterUserId)
            throw new Error('Only the owner can view shop members');
        const { data: members } = await supabase_1.supabase
            .from('shop_members')
            .select('id, user_id, role, created_at')
            .eq('shop_id', shopId);
        const list = members || [];
        const userIds = [...new Set(list.map((m) => m.user_id).filter(Boolean))];
        if (shop.owner_id && !userIds.includes(shop.owner_id))
            userIds.push(shop.owner_id);
        const usersMap = new Map();
        if (userIds.length > 0) {
            const { data: users } = await supabase_1.supabase
                .from('users')
                .select('id, name, email')
                .in('id', userIds);
            (users || []).forEach((u) => usersMap.set(u.id, { name: u.name || '—', email: u.email || '—' }));
        }
        const result = [];
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
        list.forEach((m) => {
            if (m.user_id === ownerId)
                return;
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
    async removeMember(shopId, memberUserId, requesterUserId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== requesterUserId)
            throw new Error('Only the owner can remove members');
        if (memberUserId === shop.owner_id)
            throw new Error('Cannot remove the shop owner');
        const { error } = await supabase_1.supabase
            .from('shop_members')
            .delete()
            .eq('shop_id', shopId)
            .eq('user_id', memberUserId);
        if (error) {
            logger_1.logger.error('Error removing member:', error);
            throw new Error('Failed to remove member');
        }
        return { removed: true };
    }
    async transferOwnership(shopId, newOwnerUserId, requesterUserId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== requesterUserId)
            throw new Error('Only the current owner can transfer ownership');
        if (newOwnerUserId === shop.owner_id)
            throw new Error('New owner must be different from current owner');
        const { data: newOwnerUser } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('id', newOwnerUserId)
            .maybeSingle();
        if (!newOwnerUser)
            throw new Error('New owner user not found');
        const { error: updateErr } = await supabase_1.supabase
            .from('shops')
            .update({ owner_id: newOwnerUserId, updated_at: new Date().toISOString() })
            .eq('id', shopId);
        if (updateErr) {
            logger_1.logger.error('Error transferring ownership:', updateErr);
            throw new Error('Failed to transfer ownership');
        }
        await supabase_1.supabase
            .from('shop_members')
            .delete()
            .eq('shop_id', shopId)
            .eq('user_id', requesterUserId);
        const { data: existingMember } = await supabase_1.supabase
            .from('shop_members')
            .select('id')
            .eq('shop_id', shopId)
            .eq('user_id', newOwnerUserId)
            .maybeSingle();
        if (!existingMember) {
            await supabase_1.supabase.from('shop_members').insert({
                shop_id: shopId,
                user_id: newOwnerUserId,
                role: 'owner',
            });
        }
        else {
            await supabase_1.supabase
                .from('shop_members')
                .update({ role: 'owner', updated_at: new Date().toISOString() })
                .eq('shop_id', shopId)
                .eq('user_id', newOwnerUserId);
        }
        return { transferred: true, newOwnerId: newOwnerUserId };
    }
    async deleteShop(shopId, userId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== userId)
            throw new Error('Only the owner can delete this shop');
        const { data: sales } = await supabase_1.supabase.from('sales').select('id').eq('shop_id', shopId);
        const saleIds = (sales || []).map((s) => s.id);
        if (saleIds.length > 0) {
            const { error: itemsErr } = await supabase_1.supabase.from('sale_items').delete().in('sale_id', saleIds);
            if (itemsErr) {
                logger_1.logger.error('Error deleting sale_items:', itemsErr);
                throw new Error('Failed to delete shop');
            }
        }
        const { error } = await supabase_1.supabase.from('shops').delete().eq('id', shopId);
        if (error) {
            logger_1.logger.error('Error deleting shop:', error);
            throw new Error('Failed to delete shop');
        }
        return { deleted: true };
    }
    /** Owner-only: request a 6-digit PIN to open the dashboard edit interface. PIN is sent to user email. */
    async requestClearDataPin(shopId, userId, password) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== userId)
            throw new Error('Only the shop owner can open dashboard edit');
        const valid = await authService.verifyPassword(userId, password);
        if (!valid)
            throw new Error('Invalid password');
        const pin = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const purpose = 'clear_dashboard';
        await supabase_1.supabase
            .from('pin_verifications')
            .delete()
            .eq('user_id', userId)
            .eq('shop_id', shopId)
            .eq('purpose', purpose);
        const { error: insertErr } = await supabase_1.supabase.from('pin_verifications').insert({
            user_id: userId,
            shop_id: shopId,
            pin,
            purpose,
            expires_at: expiresAt,
        });
        if (insertErr) {
            logger_1.logger.error('Error saving PIN:', insertErr);
            throw new Error('Failed to generate PIN');
        }
        const { data: user } = await supabase_1.supabase.from('users').select('email').eq('id', userId).single();
        const toEmail = user?.email;
        if (toEmail) {
            const sent = await (0, email_1.sendClearDataPinEmail)(toEmail, pin);
            if (!sent)
                logger_1.logger.warn(`[Dashboard edit] PIN email failed for ${toEmail}; PIN: ${pin}`);
        }
        return { message: 'PIN sent to your email. Check your inbox (and spam folder).' };
    }
    /** Owner-only: verify PIN and return a short-lived token to use the dashboard edit interface. */
    async confirmDashboardEdit(shopId, userId, pin) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== userId)
            throw new Error('Only the shop owner can open dashboard edit');
        const normalizedPin = (pin || '').trim();
        if (normalizedPin.length !== 6)
            throw new Error('PIN must be 6 digits');
        const { data: row, error: findErr } = await supabase_1.supabase
            .from('pin_verifications')
            .select('id')
            .eq('user_id', userId)
            .eq('shop_id', shopId)
            .eq('purpose', 'clear_dashboard')
            .eq('pin', normalizedPin)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        if (findErr || !row)
            throw new Error('Invalid or expired PIN');
        await supabase_1.supabase.from('pin_verifications').delete().eq('id', row.id);
        const dashboardEditToken = jsonwebtoken_1.default.sign({ purpose: 'dashboard_edit', shopId, userId }, env_1.env.jwtSecret, { expiresIn: DASHBOARD_EDIT_TOKEN_EXPIRY });
        return { dashboardEditToken, expiresIn: 900 };
    }
    /**
     * Owner-only (via dashboard edit token): set data_cleared_at so the dashboard only shows data from now on.
     */
    async clearDashboardData(shopId, userId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== userId)
            throw new Error('Only the shop owner can clear dashboard data');
        const now = new Date().toISOString();
        const { error: updateErr } = await supabase_1.supabase
            .from('shops')
            .update({ data_cleared_at: now, updated_at: now })
            .eq('id', shopId);
        if (updateErr) {
            logger_1.logger.error('Error setting data_cleared_at:', updateErr);
            throw new Error('Failed to clear dashboard data');
        }
        return { cleared: true };
    }
    /**
     * Owner-only (via dashboard edit token): reset data_cleared_at so the main dashboard shows all data again.
     */
    async resetDashboardView(shopId, userId) {
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop)
            throw new Error('Shop not found');
        if (shop.owner_id !== userId)
            throw new Error('Only the shop owner can reset dashboard view');
        const { error: updateErr } = await supabase_1.supabase
            .from('shops')
            .update({ data_cleared_at: null, updated_at: new Date().toISOString() })
            .eq('id', shopId);
        if (updateErr) {
            logger_1.logger.error('Error resetting data_cleared_at:', updateErr);
            throw new Error('Failed to reset dashboard view');
        }
        return { reset: true };
    }
}
exports.ShopsService = ShopsService;
//# sourceMappingURL=shops.service.js.map