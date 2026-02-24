"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../../config/supabase");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const email_1 = require("../../utils/email");
const errorHandler_1 = require("../../middleware/errorHandler");
const SALT_ROUNDS = 10;
function isNetworkError(err) {
    const msg = err?.message || String(err);
    return (msg.includes('fetch failed') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('getaddrinfo'));
}
class AuthService {
    async createSession(userId, meta) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('platform_sessions')
                .insert({
                user_id: userId,
                ip_address: meta?.ipAddress || null,
                user_agent: meta?.userAgent || null,
                device_fingerprint: meta?.deviceFingerprint || null,
                is_active: true,
                last_seen_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
                .select('id')
                .single();
            if (error || !data?.id)
                return null;
            return String(data.id);
        }
        catch {
            return null;
        }
    }
    async writeLoginHistory(userId, success, meta) {
        try {
            await supabase_1.supabase.from('user_login_history').insert({
                user_id: userId,
                ip_address: meta?.ipAddress || null,
                user_agent: meta?.userAgent || null,
                success,
            });
        }
        catch (err) {
            logger_1.logger.warn('Failed to write user_login_history event', err);
        }
    }
    async register(name, email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        let existing;
        try {
            const result = await supabase_1.supabase
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();
            existing = result.data;
        }
        catch (err) {
            if (isNetworkError(err)) {
                logger_1.logger.error('Supabase unreachable:', err);
                throw new Error('Cannot reach Supabase. Check your internet connection and SUPABASE_URL in backend/.env (use the Project URL from Supabase Dashboard → Settings → API).');
            }
            throw err;
        }
        if (existing) {
            throw new Error('A user with this email already exists');
        }
        const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        let user;
        let error;
        try {
            const result = await supabase_1.supabase
                .from('users')
                .insert({
                name,
                email: normalizedEmail,
                password_hash: passwordHash,
                role: 'owner',
            })
                .select('id, name, email, role')
                .single();
            user = result.data;
            error = result.error;
        }
        catch (err) {
            if (isNetworkError(err)) {
                logger_1.logger.error('Supabase unreachable:', err);
                throw new Error('Cannot reach Supabase. Check your internet connection and SUPABASE_URL in backend/.env (use the Project URL from Supabase Dashboard → Settings → API).');
            }
            throw err;
        }
        if (error) {
            logger_1.logger.error('Error registering user:', error);
            throw new Error('Failed to register');
        }
        const token = this.createToken(user.id, user.email);
        return {
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            token,
        };
    }
    async login(email, password, meta) {
        const normalizedEmail = email.toLowerCase().trim();
        let user;
        let error;
        try {
            const result = await supabase_1.supabase
                .from('users')
                .select('id, name, email, role, password_hash, is_active, force_password_reset, two_factor_enabled')
                .eq('email', normalizedEmail)
                .single();
            user = result.data;
            error = result.error;
        }
        catch (err) {
            if (isNetworkError(err)) {
                logger_1.logger.error('Supabase unreachable:', err);
                throw new Error('Cannot reach Supabase. Check your internet connection and SUPABASE_URL in backend/.env (use the Project URL from Supabase Dashboard → Settings → API).');
            }
            throw err;
        }
        if (error || !user) {
            throw new errorHandler_1.AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
        }
        if (user.is_active === false) {
            await this.writeLoginHistory(user.id, false, meta);
            throw new errorHandler_1.AppError('Your account is suspended. Contact support.', 403, 'AUTH_ACCOUNT_SUSPENDED');
        }
        if (user.force_password_reset === true) {
            await this.writeLoginHistory(user.id, false, meta);
            throw new errorHandler_1.AppError('Password reset required. Use forgot password to continue.', 403, 'AUTH_PASSWORD_RESET_REQUIRED');
        }
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            await this.writeLoginHistory(user.id, false, meta);
            throw new errorHandler_1.AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
        }
        const { data: policy } = await supabase_1.supabase.from('user_security_policies').select('require_2fa').eq('user_id', user.id).maybeSingle();
        if (policy?.require_2fa === true && user.two_factor_enabled !== true) {
            await this.writeLoginHistory(user.id, false, meta);
            throw new errorHandler_1.AppError('Two-factor authentication is required for this account.', 403, 'AUTH_2FA_REQUIRED');
        }
        await this.writeLoginHistory(user.id, true, meta);
        const sessionId = await this.createSession(user.id, meta);
        const token = this.createToken(user.id, user.email, sessionId || undefined);
        return {
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            token,
            sessionId: sessionId || undefined,
        };
    }
    /**
     * Create a user account for staff (used when owner adds staff by email/name/password).
     * Returns the user if created or existing; does not return a token.
     */
    async createUserForShop(name, email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const { data: existing } = await supabase_1.supabase
            .from('users')
            .select('id, name, email, role, is_active, force_password_reset')
            .eq('email', normalizedEmail)
            .maybeSingle();
        if (existing) {
            const updates = { updated_at: new Date().toISOString() };
            let shouldUpdate = false;
            // If this user no longer owns any shop, normalize role to staff for member login behavior.
            const { data: ownedShop } = await supabase_1.supabase.from('shops').select('id').eq('owner_id', existing.id).limit(1).maybeSingle();
            if (!ownedShop && String(existing.role || '').toLowerCase() !== 'staff') {
                updates.role = 'staff';
                shouldUpdate = true;
            }
            // Re-activate previously suspended staff accounts so owners can reuse them.
            if (existing.is_active === false) {
                updates.is_active = true;
                updates.suspended_reason = null;
                updates.suspended_at = null;
                updates.reactivated_at = new Date().toISOString();
                shouldUpdate = true;
            }
            // Clear forced reset lock for re-invited non-owner users.
            if (existing.force_password_reset === true && !ownedShop) {
                updates.force_password_reset = false;
                shouldUpdate = true;
            }
            // For non-owner existing users, allow owner-provided password to take effect.
            if (password && password.length >= 8 && !ownedShop) {
                updates.password_hash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
                shouldUpdate = true;
            }
            if (shouldUpdate) {
                await supabase_1.supabase.from('users').update(updates).eq('id', existing.id);
            }
            return { id: existing.id, name: existing.name, email: existing.email };
        }
        const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .insert({
            name: (name || '').trim() || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password_hash: passwordHash,
            role: 'staff',
        })
            .select('id, name, email')
            .single();
        if (error) {
            logger_1.logger.error('Error creating user for shop:', error);
            throw new Error('Failed to create staff account');
        }
        return { id: user.id, name: user.name, email: user.email };
    }
    async getMe(userId) {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('id, name, email, role')
            .eq('id', userId)
            .single();
        if (error || !user) {
            throw new Error('User not found');
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role };
    }
    async getPlatformAdminStatus(userId) {
        const { data, error } = await supabase_1.supabase
            .from('platform_admins')
            .select('user_id, role, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();
        if (error) {
            logger_1.logger.warn('Failed to read platform admin status', error);
            return { isPlatformAdmin: false };
        }
        if (!data)
            return { isPlatformAdmin: false };
        return {
            isPlatformAdmin: true,
            role: String(data.role || ''),
        };
    }
    async updateProfile(userId, data) {
        const updates = { updated_at: new Date().toISOString() };
        if (data.name !== undefined) {
            const t = (data.name || '').trim();
            if (t)
                updates.name = t;
        }
        if (data.email !== undefined) {
            const normalizedEmail = (data.email || '').toLowerCase().trim();
            if (!normalizedEmail)
                throw new Error('Email cannot be empty');
            const { data: existing } = await supabase_1.supabase
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .neq('id', userId)
                .maybeSingle();
            if (existing)
                throw new Error('A user with this email already exists');
            updates.email = normalizedEmail;
        }
        if (Object.keys(updates).length <= 1)
            return this.getMe(userId);
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select('id, name, email, role')
            .single();
        if (error) {
            logger_1.logger.error('Error updating profile:', error);
            throw new Error('Failed to update profile');
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role };
    }
    /**
     * Verify that the given password matches the user's password. Used for sensitive actions (e.g. clear dashboard).
     */
    async verifyPassword(userId, password) {
        const { data: user, error } = await supabase_1.supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single();
        if (error || !user?.password_hash)
            return false;
        return bcrypt_1.default.compare(password, user.password_hash);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const { data: user, error: fetchErr } = await supabase_1.supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single();
        if (fetchErr || !user?.password_hash) {
            throw new Error('User not found');
        }
        const valid = await bcrypt_1.default.compare(currentPassword, user.password_hash);
        if (!valid) {
            throw new Error('Current password is incorrect');
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, SALT_ROUNDS);
        const { error: updateErr } = await supabase_1.supabase
            .from('users')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (updateErr) {
            logger_1.logger.error('Error changing password:', updateErr);
            throw new Error('Failed to change password');
        }
        return { updated: true };
    }
    /**
     * Resolve the canonical user id from the database (single source of truth).
     * Uses JWT sub first, then email (unique) so shops/records are always tied to the same user row.
     */
    async resolveUserId(userIdFromToken, emailFromToken) {
        const normalizedEmail = emailFromToken?.toLowerCase().trim();
        const { data: byId, error: byIdError } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('id', userIdFromToken)
            .maybeSingle();
        if (byIdError) {
            logger_1.logger.error('resolveUserId lookup by id failed:', byIdError);
            const err = new Error('Authentication service is temporarily unavailable. Please try again.');
            err.statusCode = 503;
            throw err;
        }
        if (byId?.id)
            return byId.id;
        if (normalizedEmail) {
            const { data: byEmail, error: byEmailError } = await supabase_1.supabase
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();
            if (byEmailError) {
                logger_1.logger.error('resolveUserId lookup by email failed:', byEmailError);
                const err = new Error('Authentication service is temporarily unavailable. Please try again.');
                err.statusCode = 503;
                throw err;
            }
            if (byEmail?.id)
                return byEmail.id;
        }
        const err = new Error('User no longer exists. Please sign in again.');
        err.statusCode = 401;
        throw err;
    }
    createToken(userId, email, sessionId) {
        return jsonwebtoken_1.default.sign({ sub: userId, email, sid: sessionId }, env_1.env.jwtSecret, { expiresIn: '7d' });
    }
    /** Request password reset: send 6-digit PIN to email. Always returns success (don't reveal if email exists). */
    async forgotPasswordRequest(email) {
        const normalizedEmail = (email || '').toLowerCase().trim();
        if (!normalizedEmail)
            throw new Error('Email is required');
        const { data: user } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();
        if (!user) {
            return { message: 'If that email exists, a PIN was sent. Check your inbox.' };
        }
        const pin = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase_1.supabase
            .from('password_reset_pins')
            .delete()
            .eq('email', normalizedEmail);
        const { error: insertErr } = await supabase_1.supabase
            .from('password_reset_pins')
            .insert({ email: normalizedEmail, pin, expires_at: expiresAt });
        if (insertErr) {
            logger_1.logger.error('Error saving password reset PIN:', insertErr);
            throw new Error('Failed to generate reset PIN');
        }
        const sent = await (0, email_1.sendPasswordResetPinEmail)(normalizedEmail, pin);
        if (!sent)
            logger_1.logger.warn(`Password reset PIN email failed for ${normalizedEmail}`);
        return { message: 'If that email exists, a PIN was sent. Check your inbox (and spam folder).' };
    }
    /** Verify forgot-password PIN without changing password. */
    async verifyForgotPasswordPin(email, pin) {
        const normalizedEmail = (email || '').toLowerCase().trim();
        if (!normalizedEmail)
            throw new Error('Email is required');
        const trimmedPin = (pin || '').trim();
        if (trimmedPin.length !== 6)
            throw new Error('PIN must be 6 digits');
        const { data: row, error } = await supabase_1.supabase
            .from('password_reset_pins')
            .select('id')
            .eq('email', normalizedEmail)
            .eq('pin', trimmedPin)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        if (error || !row)
            throw new Error('Invalid or expired PIN');
        return { valid: true };
    }
    /** Reset password with PIN. */
    async forgotPasswordReset(email, pin, newPassword) {
        const normalizedEmail = (email || '').toLowerCase().trim();
        if (!normalizedEmail)
            throw new Error('Email is required');
        const trimmedPin = (pin || '').trim();
        if (trimmedPin.length !== 6)
            throw new Error('PIN must be 6 digits');
        if (!newPassword || newPassword.length < 8)
            throw new Error('New password must be at least 8 characters');
        const { data: row, error: findErr } = await supabase_1.supabase
            .from('password_reset_pins')
            .select('id')
            .eq('email', normalizedEmail)
            .eq('pin', trimmedPin)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
        if (findErr || !row)
            throw new Error('Invalid or expired PIN');
        const passwordHash = await bcrypt_1.default.hash(newPassword, SALT_ROUNDS);
        const { data: updatedRows, error: updateErr } = await supabase_1.supabase
            .from('users')
            .update({
            password_hash: passwordHash,
            force_password_reset: false,
            updated_at: new Date().toISOString(),
        })
            .ilike('email', normalizedEmail)
            .select('id');
        if (updateErr) {
            logger_1.logger.error('Error updating password:', updateErr);
            throw new Error('Failed to reset password');
        }
        if (!updatedRows || updatedRows.length === 0) {
            throw new Error('No user account matched this email for password reset');
        }
        await supabase_1.supabase.from('password_reset_pins').delete().eq('id', row.id);
        return { success: true };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map