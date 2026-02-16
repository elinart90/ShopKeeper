import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthService } from '../modules/auth/auth.service';
import { errorHandler, AppError } from './errorHandler';

const authService = new AuthService();

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: No token provided', 401);
    }

    const token = authHeader.substring(7);

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      throw new AppError('Unauthorized: Invalid token', 401);
    }

    req.userEmail = decoded.email;
    req.userId = await authService.resolveUserId(decoded.sub, decoded.email);
    next();
  } catch (error) {
    errorHandler(error as AppError, req, res, next);
  }
}
