"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesController = void 0;
const expenses_service_1 = require("./expenses.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const expensesService = new expenses_service_1.ExpensesService();
class ExpensesController {
    async createExpense(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const expense = await expensesService.createExpense(req.shopId, req.userId, req.body);
            res.status(201).json({ success: true, data: expense });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getExpenses(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const expenses = await expensesService.getExpenses(req.shopId, req.query);
            res.json({ success: true, data: expenses });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getExpenseCategories(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const categories = await expensesService.getExpenseCategories(req.shopId);
            res.json({ success: true, data: categories });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async createExpenseCategory(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const category = await expensesService.createExpenseCategory(req.shopId, req.body);
            res.status(201).json({ success: true, data: category });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.ExpensesController = ExpensesController;
//# sourceMappingURL=expenses.controller.js.map