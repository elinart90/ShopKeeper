"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyCloseController = void 0;
const daily_close_service_1 = require("./daily-close.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const dailyCloseService = new daily_close_service_1.DailyCloseService();
class DailyCloseController {
    async create(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const data = await dailyCloseService.create(req.shopId, req.userId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async approve(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const { id } = req.params;
            const data = await dailyCloseService.approve(req.shopId, req.userId, id);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async reject(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const { id } = req.params;
            const data = await dailyCloseService.reject(req.shopId, req.userId, id);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getByDate(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID required', 400);
            const date = req.query.date || new Date().toISOString().slice(0, 10);
            const data = await dailyCloseService.getByDate(req.shopId, date);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getRecent(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID required', 400);
            const data = await dailyCloseService.getRecent(req.shopId);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.DailyCloseController = DailyCloseController;
//# sourceMappingURL=daily-close.controller.js.map