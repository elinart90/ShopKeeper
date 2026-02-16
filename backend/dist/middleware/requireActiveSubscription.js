"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = requireActiveSubscription;
const errorHandler_1 = require("./errorHandler");
const subscriptions_service_1 = require("../modules/subscriptions/subscriptions.service");
const subscriptionsService = new subscriptions_service_1.SubscriptionsService();
function createHttpError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
async function requireActiveSubscription(req, res, next) {
    try {
        if (!req.userId)
            throw createHttpError('Unauthorized', 401);
        const shopIdHeader = req.headers['x-shop-id'];
        const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
        const status = await subscriptionsService.getStatus(req.userId, shopId);
        req.subscription = status;
        if (!status.isActive) {
            throw createHttpError('Active monthly subscription is required to use this app', 402, 'SUBSCRIPTION_REQUIRED');
        }
        next();
    }
    catch (error) {
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireActiveSubscription.js.map