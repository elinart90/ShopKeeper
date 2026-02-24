"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const supabase_1 = require("../config/supabase");
const auth_service_1 = require("../modules/auth/auth.service");
const errorHandler_1 = require("./errorHandler");
const authService = new auth_service_1.AuthService();
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('Unauthorized: No token provided', 401);
        }
        const token = authHeader.substring(7);
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        }
        catch {
            throw new errorHandler_1.AppError('Unauthorized: Invalid token', 401);
        }
        req.userEmail = decoded.email;
        req.userId = await authService.resolveUserId(decoded.sub, decoded.email);
        req.sessionId = decoded.sid;
        if (decoded.sid) {
            const { data: session } = await supabase_1.supabase
                .from('platform_sessions')
                .select('id, is_active, expires_at')
                .eq('id', decoded.sid)
                .eq('user_id', req.userId)
                .maybeSingle();
            const expired = session?.expires_at ? new Date(session.expires_at).getTime() <= Date.now() : false;
            if (!session || !session.is_active || expired) {
                throw new errorHandler_1.AppError('Unauthorized: Session expired or terminated', 401);
            }
            await supabase_1.supabase.from('platform_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', decoded.sid).eq('is_active', true);
        }
        next();
    }
    catch (error) {
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireAuth.js.map