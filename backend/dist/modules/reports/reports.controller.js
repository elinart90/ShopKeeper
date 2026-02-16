"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("./reports.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const reportsService = new reports_service_1.ReportsService();
class ReportsController {
    async getDashboardStats(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const stats = await reportsService.getDashboardStats(req.shopId, req.query.startDate, req.query.endDate);
            res.json({ success: true, data: stats });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getSalesIntelligence(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const data = await reportsService.getSalesIntelligence(req.shopId, req.query.startDate, req.query.endDate);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getInventoryFinance(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const deadStockDays = req.query.days ? Number(req.query.days) : 30;
            const data = await reportsService.getInventoryFinance(req.shopId, deadStockDays);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getExpensesProfit(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const data = await reportsService.getExpensesProfitReport(req.shopId, req.query.startDate, req.query.endDate);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getComplianceExport(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const type = req.query.type || 'daily';
            if (!['daily', 'monthly', 'pl', 'tax'].includes(type)) {
                throw new errorHandler_1.AppError('Invalid type. Use: daily, monthly, pl, tax', 400);
            }
            const data = await reportsService.getComplianceExport(req.shopId, type, {
                date: req.query.date,
                month: req.query.month,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
            });
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.ReportsController = ReportsController;
//# sourceMappingURL=reports.controller.js.map