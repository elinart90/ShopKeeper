import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/requireAuth';
export declare class AuthController {
    register(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    login(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    me(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    forgotPasswordRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    verifyForgotPasswordPin(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    forgotPasswordReset(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map