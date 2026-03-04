"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = requireActiveSubscription;
const errorHandler_1 = require("./errorHandler");
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
        // Subscription enforcement removed: authenticated users can access app features without active plan.
        req.subscription = {
            hasPlan: false,
            status: 'inactive',
            isActive: true,
        };
        req.subscriptionUserId = req.userId;
        next();
    }
    catch (error) {
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireActiveSubscription.js.map