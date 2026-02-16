import { Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest } from '../../middleware/requireAuth';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const authService = new AuthService();

export class AuthController {
  async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw new AppError('Name, email and password are required', 400);
      }

      const result = await authService.register(name, email, password);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const user = await authService.getMe(req.userId);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { name, email } = req.body;
      const user = await authService.updateProfile(req.userId, { name, email });
      res.json({ success: true, data: user });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400);
      }
      if (newPassword.length < 8) {
        throw new AppError('New password must be at least 8 characters', 400);
      }
      await authService.changePassword(req.userId, currentPassword, newPassword);
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async forgotPasswordRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) throw new AppError('Email is required', 400);
      const result = await authService.forgotPasswordRequest(email);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async verifyForgotPasswordPin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, pin } = req.body;
      if (!email) throw new AppError('Email is required', 400);
      if (!pin) throw new AppError('PIN is required', 400);
      await authService.verifyForgotPasswordPin(email, pin);
      res.json({ success: true, data: { valid: true } });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async forgotPasswordReset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, pin, newPassword } = req.body;
      if (!email) throw new AppError('Email is required', 400);
      if (!pin) throw new AppError('PIN is required', 400);
      if (!newPassword) throw new AppError('New password is required', 400);
      await authService.forgotPasswordReset(email, pin, newPassword);
      res.json({ success: true, data: { success: true } });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}

