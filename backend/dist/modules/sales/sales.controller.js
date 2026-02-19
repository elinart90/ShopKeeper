"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesController = void 0;
const sales_service_1 = require("./sales.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const params_1 = require("../../utils/params");
const audit_1 = require("../controls/audit");
const salesService = new sales_service_1.SalesService();
class SalesController {
    async createSale(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const sale = await salesService.createSale(req.shopId, req.userId, req.body);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'sale.create',
                entityType: 'sale',
                entityId: sale?.id,
                after: sale,
            });
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
    async getGoodsSoldSummary(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const data = await salesService.getGoodsSoldSummary(req.shopId, req.query.startDate, req.query.endDate);
            res.json({ success: true, data });
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
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'sale.cancel',
                entityType: 'sale',
                entityId: id,
                after: sale,
            });
            res.json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async returnSaleItem(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const saleItemId = String(req.body?.sale_item_id || '');
            const quantity = Number(req.body?.quantity);
            const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
            if (!saleItemId)
                throw new errorHandler_1.AppError('sale_item_id is required', 400);
            if (!Number.isFinite(quantity) || quantity <= 0)
                throw new errorHandler_1.AppError('Valid quantity is required', 400);
            const sale = await salesService.returnSaleItem(id, req.shopId, req.userId, {
                sale_item_id: saleItemId,
                quantity,
                reason,
            });
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'sale.return_item',
                entityType: 'sale',
                entityId: id,
                metadata: { sale_item_id: saleItemId, quantity, reason: reason || null },
                after: sale,
            });
            res.json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async createPartialRefund(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const amount = Number(req.body?.amount);
            const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
            if (!Number.isFinite(amount) || amount <= 0)
                throw new errorHandler_1.AppError('Valid amount is required', 400);
            const sale = await salesService.createPartialRefund(id, req.shopId, req.userId, { amount, reason });
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'sale.partial_refund',
                entityType: 'sale',
                entityId: id,
                metadata: { amount, reason: reason || null },
                after: sale,
            });
            res.json({ success: true, data: sale });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.SalesController = SalesController;
//# sourceMappingURL=sales.controller.js.map