import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class PaymentsController {
    initialize(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    verify(req: ShopRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=payments.controller.d.ts.map