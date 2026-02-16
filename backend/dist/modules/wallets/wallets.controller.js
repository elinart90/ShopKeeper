"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletsController = void 0;
const wallets_service_1 = require("./wallets.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const walletsService = new wallets_service_1.WalletsService();
class WalletsController {
    async getWallets(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID required', 400);
            const data = await walletsService.getWallets(req.shopId);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getTransactions(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID required', 400);
            const walletId = req.query.walletId;
            const data = await walletsService.getWalletTransactions(req.shopId, walletId);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async adjustBalance(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const wallet = await walletsService.adjustBalance(req.shopId, req.userId, req.body);
            res.json({ success: true, data: wallet });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async transfer(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const result = await walletsService.transfer(req.shopId, req.userId, req.body);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.WalletsController = WalletsController;
//# sourceMappingURL=wallets.controller.js.map