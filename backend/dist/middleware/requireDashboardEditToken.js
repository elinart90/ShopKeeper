"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDashboardEditToken = requireDashboardEditToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errorHandler_1 = require("./errorHandler");
/**
 * Requires X-Dashboard-Edit-Token header with a valid JWT (purpose: dashboard_edit).
 * Use after requireAuth and requireShop so req.userId and req.shopId are set.
 */
function requireDashboardEditToken(req, res, next) {
    try {
        const token = req.headers['x-dashboard-edit-token'];
        if (!token) {
            const err = new Error('Dashboard edit token is required');
            err.statusCode = 403;
            throw err;
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        if (decoded.purpose !== 'dashboard_edit') {
            const err = new Error('Invalid dashboard edit token');
            err.statusCode = 403;
            throw err;
        }
        if (decoded.shopId !== req.shopId || decoded.userId !== req.userId) {
            const err = new Error('Dashboard edit token does not match this shop');
            err.statusCode = 403;
            throw err;
        }
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError || error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            const err = new Error('Dashboard edit session expired. Enter password and PIN again.');
            err.statusCode = 403;
            (0, errorHandler_1.errorHandler)(err, req, res, next);
            return;
        }
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireDashboardEditToken.js.map