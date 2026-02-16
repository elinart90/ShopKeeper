"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsController = void 0;
const subscriptions_service_1 = require("./subscriptions.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const service = new subscriptions_service_1.SubscriptionsService();
function createHttpError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
class SubscriptionsController {
    listPlans(req, res) {
        res.json({ success: true, data: service.listPlans() });
    }
    async getStatus(req, res, next) {
        try {
            if (!req.userId)
                throw createHttpError('Unauthorized', 401);
            const shopIdHeader = req.headers['x-shop-id'];
            const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
            const status = await service.getStatus(req.userId, shopId);
            res.json({ success: true, data: status });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async initialize(req, res, next) {
        try {
            if (!req.userId)
                throw createHttpError('Unauthorized', 401);
            const planCode = String(req.body?.planCode || '').trim().toLowerCase();
            if (!planCode)
                throw createHttpError('planCode is required', 400);
            const billingCycle = String(req.body?.billingCycle || 'monthly').trim().toLowerCase();
            if (!['monthly', 'yearly'].includes(billingCycle)) {
                throw createHttpError('billingCycle must be monthly or yearly', 400);
            }
            const email = String(req.body?.email || req.userEmail || '').trim().toLowerCase();
            if (!email)
                throw createHttpError('Email is required', 400);
            const result = await service.initialize(req.userId, email, planCode, billingCycle);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async verify(req, res, next) {
        try {
            if (!req.userId)
                throw createHttpError('Unauthorized', 401);
            const reference = String(req.body?.reference || '').trim();
            if (!reference)
                throw createHttpError('reference is required', 400);
            const result = await service.verify(req.userId, reference);
            if (!result.success) {
                res.status(400).json({ success: false, data: result.status, error: { message: 'Subscription payment verification failed' } });
                return;
            }
            res.json({ success: true, data: result.status });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.SubscriptionsController = SubscriptionsController;
//# sourceMappingURL=subscriptions.controller.js.map