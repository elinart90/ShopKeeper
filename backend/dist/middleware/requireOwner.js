"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwner = requireOwner;
const errorHandler_1 = require("./errorHandler");
/**
 * Restrict route to shop owner only. Use after requireShop.
 * Cashiers and managers get 403.
 */
function requireOwner(req, res, next) {
    if (req.userRole !== 'owner') {
        return (0, errorHandler_1.errorHandler)(new errorHandler_1.AppError('Only the shop owner can access this', 403), req, res, next);
    }
    next();
}
//# sourceMappingURL=requireOwner.js.map