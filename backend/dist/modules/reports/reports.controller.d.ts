import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class ReportsController {
    getDashboardStats(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getSalesIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getInventoryFinance(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getExpensesProfit(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getComplianceExport(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getNaturalLanguageReport(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getBusinessIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    queryBusinessIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getInventoryStockIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    queryInventoryStockIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=reports.controller.d.ts.map