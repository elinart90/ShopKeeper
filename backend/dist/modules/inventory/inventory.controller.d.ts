import { Request, Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class InventoryController {
    createProduct(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getProducts(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    getProductByBarcode(req: ShopRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    checkDuplicate(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    receiveStock(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    updateProduct(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    deleteProduct(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getLowStockProducts(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getStockHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    createCategory(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getCategories(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=inventory.controller.d.ts.map