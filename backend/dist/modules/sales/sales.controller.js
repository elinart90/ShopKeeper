"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesController = void 0;
const sales_service_1 = require("./sales.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const params_1 = require("../../utils/params");
const salesService = new sales_service_1.SalesService();
class SalesController {
    async createSale(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const sale = await salesService.createSale(req.shopId, req.userId, req.body);
            res.status(201).json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getSales(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const sales = await salesService.getSales(req.shopId, req.query);
            res.json({ success: true, data: sales });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getSale(req, res, next) {
        try {
            const id = (0, params_1.getParam)(req, 'id');
            const sale = await salesService.getSaleById(id);
            res.json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getSalesSummary(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const summary = await salesService.getSalesSummary(req.shopId, req.query.startDate, req.query.endDate);
            res.json({ success: true, data: summary });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async cancelSale(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const sale = await salesService.cancelSale(id, req.shopId, req.userId);
            res.json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.SalesController = SalesController;
//# sourceMappingURL=sales.controller.js.map