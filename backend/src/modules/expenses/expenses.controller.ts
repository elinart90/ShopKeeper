import { Request, Response, NextFunction } from 'express';
import { ExpensesService } from './expenses.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const expensesService = new ExpensesService();

export class ExpensesController {
  async createExpense(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const expense = await expensesService.createExpense(req.shopId, req.userId, req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getExpenses(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const expenses = await expensesService.getExpenses(req.shopId, req.query as any);
      res.json({ success: true, data: expenses });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getExpenseCategories(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const categories = await expensesService.getExpenseCategories(req.shopId);
      res.json({ success: true, data: categories });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async createExpenseCategory(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const category = await expensesService.createExpenseCategory(req.shopId, req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
