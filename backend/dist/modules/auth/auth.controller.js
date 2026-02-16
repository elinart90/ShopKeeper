"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const authService = new auth_service_1.AuthService();
class AuthController {
    async register(req, res, next) {
        try {
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                throw new errorHandler_1.AppError('Name, email and password are required', 400);
            }
            const result = await authService.register(name, email, password);
            res.status(201).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                throw new errorHandler_1.AppError('Email and password are required', 400);
            }
            const result = await authService.login(email, password);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async me(req, res, next) {
        try {
            if (!req.userId) {
                throw new errorHandler_1.AppError('Unauthorized', 401);
            }
            const user = await authService.getMe(req.userId);
            res.json({
                success: true,
                data: user,
            });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async updateProfile(req, res, next) {
        try {
            if (!req.userId)
                throw new errorHandler_1.AppError('Unauthorized', 401);
            const { name, email } = req.body;
            const user = await authService.updateProfile(req.userId, { name, email });
            res.json({ success: true, data: user });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async changePassword(req, res, next) {
        try {
            if (!req.userId)
                throw new errorHandler_1.AppError('Unauthorized', 401);
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                throw new errorHandler_1.AppError('Current password and new password are required', 400);
            }
            if (newPassword.length < 8) {
                throw new errorHandler_1.AppError('New password must be at least 8 characters', 400);
            }
            await authService.changePassword(req.userId, currentPassword, newPassword);
            res.json({ success: true, data: { updated: true } });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async forgotPasswordRequest(req, res, next) {
        try {
            const { email } = req.body;
            if (!email)
                throw new errorHandler_1.AppError('Email is required', 400);
            const result = await authService.forgotPasswordRequest(email);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async verifyForgotPasswordPin(req, res, next) {
        try {
            const { email, pin } = req.body;
            if (!email)
                throw new errorHandler_1.AppError('Email is required', 400);
            if (!pin)
                throw new errorHandler_1.AppError('PIN is required', 400);
            await authService.verifyForgotPasswordPin(email, pin);
            res.json({ success: true, data: { valid: true } });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async forgotPasswordReset(req, res, next) {
        try {
            const { email, pin, newPassword } = req.body;
            if (!email)
                throw new errorHandler_1.AppError('Email is required', 400);
            if (!pin)
                throw new errorHandler_1.AppError('PIN is required', 400);
            if (!newPassword)
                throw new errorHandler_1.AppError('New password is required', 400);
            await authService.forgotPasswordReset(email, pin, newPassword);
            res.json({ success: true, data: { success: true } });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map