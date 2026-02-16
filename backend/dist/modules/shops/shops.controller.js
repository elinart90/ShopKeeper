"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopsController = void 0;
const shops_service_1 = require("./shops.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const shopsService = new shops_service_1.ShopsService();
class ShopsController {
    async createShop(req, res, next) {
        try {
            if (!req.userId) {
                throw new errorHandler_1.AppError('User ID is required', 401);
            }
            const shop = await shopsService.createShop(req.userId, req.body);
            res.status(201).json({ success: true, data: shop });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getShop(req, res, next) {
        try {
            const { id } = req.params;
            const shop = await shopsService.getShopById(id);
            res.json({ success: true, data: shop });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getUserShops(req, res, next) {
        try {
            if (!req.userId) {
                throw new errorHandler_1.AppError('User ID is required', 401);
            }
            const shops = await shopsService.getUserShops(req.userId);
            res.json({ success: true, data: shops });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async updateShop(req, res, next) {
        try {
            if (!req.userId) {
                throw new errorHandler_1.AppError('User ID is required', 401);
            }
            const { id } = req.params;
            const shop = await shopsService.updateShop(id, req.userId, req.body);
            res.json({ success: true, data: shop });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async deleteShop(req, res, next) {
        try {
            if (!req.userId) {
                throw new errorHandler_1.AppError('User ID is required', 401);
            }
            const { id } = req.params;
            await shopsService.deleteShop(id, req.userId);
            res.json({ success: true, data: { deleted: true } });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async addMember(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const { email, name, password, role } = req.body;
            if (!email || !password) {
                throw new errorHandler_1.AppError('Email and password are required', 400);
            }
            const result = await shopsService.addMember(req.shopId, req.userId, {
                email,
                name,
                password,
                role: role || 'staff',
            });
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getShopMembers(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const members = await shopsService.getShopMembers(req.shopId, req.userId);
            res.json({ success: true, data: members });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async removeMember(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const { userId: memberUserId } = req.params;
            if (!memberUserId)
                throw new errorHandler_1.AppError('Member user ID is required', 400);
            await shopsService.removeMember(req.shopId, memberUserId, req.userId);
            res.json({ success: true, data: { removed: true } });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async transferOwnership(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const { newOwnerUserId } = req.body;
            if (!newOwnerUserId)
                throw new errorHandler_1.AppError('newOwnerUserId is required', 400);
            const result = await shopsService.transferOwnership(req.shopId, newOwnerUserId, req.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async requestClearDataPin(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const { password } = req.body;
            if (!password)
                throw new errorHandler_1.AppError('Password is required', 400);
            const result = await shopsService.requestClearDataPin(req.shopId, req.userId, password);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async confirmDashboardEdit(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const { pin } = req.body;
            if (!pin)
                throw new errorHandler_1.AppError('PIN is required', 400);
            const result = await shopsService.confirmDashboardEdit(req.shopId, req.userId, pin);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async clearDashboardData(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const result = await shopsService.clearDashboardData(req.shopId, req.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async resetDashboardView(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const result = await shopsService.resetDashboardView(req.shopId, req.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.ShopsController = ShopsController;
//# sourceMappingURL=shops.controller.js.map