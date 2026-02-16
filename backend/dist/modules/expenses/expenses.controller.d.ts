import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class ExpensesController {
    createExpense(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getExpenses(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getExpenseCategories(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    createExpenseCategory(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=expenses.controller.d.ts.map