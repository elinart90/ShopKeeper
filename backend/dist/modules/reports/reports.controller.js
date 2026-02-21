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
            if (!['daily', 'weekly', 'monthly', 'pl', 'tax'].includes(type)) {
                throw new errorHandler_1.AppError('Invalid type. Use: daily, weekly, monthly, pl, tax', 400);
            }
            const data = await reportsService.getComplianceExport(req.shopId, type, {
                date: req.query.date,
                week: req.query.week,
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
    async getNaturalLanguageReport(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            const query = String(req.body?.query || '').trim();
            if (!query)
                throw new errorHandler_1.AppError('query is required', 400);
            const language = String(req.body?.language || '').trim().toLowerCase();
            const data = await reportsService.getNaturalLanguageReport(req.shopId, req.userId, query, language === 'auto' ? 'auto' : language === 'twi' ? 'twi' : 'en');
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getBusinessIntelligence(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            const period = String(req.query.period || 'daily').toLowerCase();
            if (!['daily', 'weekly', 'monthly'].includes(period)) {
                throw new errorHandler_1.AppError('Invalid period. Use daily, weekly, or monthly', 400);
            }
            const data = await reportsService.getBusinessIntelligence(req.shopId, req.userId, period);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async queryBusinessIntelligence(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            const query = String(req.body?.query || '').trim();
            if (!query)
                throw new errorHandler_1.AppError('query is required', 400);
            const period = String(req.body?.period || 'daily').toLowerCase();
            if (!['daily', 'weekly', 'monthly'].includes(period)) {
                throw new errorHandler_1.AppError('Invalid period. Use daily, weekly, or monthly', 400);
            }
            const data = await reportsService.queryBusinessIntelligence(req.shopId, req.userId, query, period);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getInventoryStockIntelligence(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            const period = String(req.query.period || 'weekly').toLowerCase();
            if (!['daily', 'weekly', 'monthly'].includes(period)) {
                throw new errorHandler_1.AppError('Invalid period. Use daily, weekly, or monthly', 400);
            }
            const data = await reportsService.getInventoryStockIntelligence(req.shopId, req.userId, period);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async queryInventoryStockIntelligence(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            const query = String(req.body?.query || '').trim();
            if (!query)
                throw new errorHandler_1.AppError('query is required', 400);
            const period = String(req.body?.period || 'weekly').toLowerCase();
            if (!['daily', 'weekly', 'monthly'].includes(period)) {
                throw new errorHandler_1.AppError('Invalid period. Use daily, weekly, or monthly', 400);
            }
            const data = await reportsService.queryInventoryStockIntelligence(req.shopId, req.userId, query, period);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.ReportsController = ReportsController;
//# sourceMappingURL=reports.controller.js.map