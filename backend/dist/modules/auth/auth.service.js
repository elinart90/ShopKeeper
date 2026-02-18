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
    async login(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        let user;
        let error;
        try {
            const result = await supabase_1.supabase
                .from('users')
                .select('id, name, email, role, password_hash')
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
            throw new Error('Invalid email or password');
        }
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid email or password');
        }
        const token = this.createToken(user.id, user.email);
        return {
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
            token,
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
            .select('id, name, email')
            .eq('email', normalizedEmail)
            .maybeSingle();
        if (existing) {
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
    createToken(userId, email) {
        return jsonwebtoken_1.default.sign({ sub: userId, email }, env_1.env.jwtSecret, { expiresIn: '7d' });
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
        const { error: updateErr } = await supabase_1.supabase
            .from('users')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('email', normalizedEmail);
        if (updateErr) {
            logger_1.logger.error('Error updating password:', updateErr);
            throw new Error('Failed to reset password');
        }
        await supabase_1.supabase.from('password_reset_pins').delete().eq('id', row.id);
        return { success: true };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map