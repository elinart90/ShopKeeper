"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembersController = void 0;
const members_service_1 = require("./members.service");
const errorHandler_1 = require("../../middleware/errorHandler");
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
            const { id } = req.params;
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
            const { id } = req.params;
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
}
exports.MembersController = MembersController;
//# sourceMappingURL=members.controller.js.map