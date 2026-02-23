"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersController = void 0;
const members_service_1 = require("./members.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const params_1 = require("../../utils/params");
const audit_1 = require("../controls/audit");
const membersService = new members_service_1.MembersService();
class MembersController {
    async createCustomer(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const customer = await membersService.createCustomer(req.shopId, req.body);
            res.status(201).json({ success: true, data: customer });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getCustomers(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const customers = await membersService.getCustomers(req.shopId, req.query.search);
            res.json({ success: true, data: customers });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getCustomer(req, res, next) {
        try {
            const id = (0, params_1.getParam)(req, 'id');
            const customer = await membersService.getCustomerById(id);
            res.json({ success: true, data: customer });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async updateCustomer(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const customer = await membersService.updateCustomer(id, req.shopId, req.body);
            res.json({ success: true, data: customer });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getCreditSummary(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const data = await membersService.getCreditSummary(req.shopId);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async recordPayment(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const amount = Number(req.body?.amount);
            const paymentMethod = String(req.body?.payment_method || 'cash');
            const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new errorHandler_1.AppError('Valid amount is required', 400);
            }
            if (!req.userId) {
                throw new errorHandler_1.AppError('User ID is required', 401);
            }
            const customer = await membersService.recordCreditPayment(id, req.shopId, req.userId, amount, paymentMethod, notes);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'customers.record_payment',
                entityType: 'customer',
                entityId: id,
                metadata: { amount, paymentMethod },
                after: customer,
            });
            res.json({ success: true, data: customer });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getCreditIntelligence(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const lookbackDays = req.query.lookbackDays ? Number(req.query.lookbackDays) : 90;
            const data = await membersService.getCreditIntelligence(req.shopId, lookbackDays);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async queryCreditIntelligence(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const query = String(req.body?.query || '').trim();
            if (!query)
                throw new errorHandler_1.AppError('query is required', 400);
            const lookbackDays = req.body?.lookbackDays != null ? Number(req.body.lookbackDays) : 90;
            const data = await membersService.queryCreditIntelligence(req.shopId, query, lookbackDays);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async runAutoCreditReminders(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const intervalDays = req.body?.intervalDays != null ? Number(req.body.intervalDays) : 3;
            const lookbackDays = req.body?.lookbackDays != null ? Number(req.body.lookbackDays) : 90;
            const data = await membersService.runAutoCreditReminders(req.shopId, req.userId, intervalDays, lookbackDays);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.MembersController = MembersController;
//# sourceMappingURL=members.controller.js.map