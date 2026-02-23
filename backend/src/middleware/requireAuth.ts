import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { AuthService } from '../modules/auth/auth.service';
import { errorHandler, AppError } from './errorHandler';

const authService = new AuthService();

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  sessionId?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  sid?: string;
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
    req.sessionId = decoded.sid;

    if (decoded.sid) {
      const { data: session } = await supabase
        .from('platform_sessions')
        .select('id, is_active, expires_at')
        .eq('id', decoded.sid)
        .eq('user_id', req.userId)
        .maybeSingle();

      const expired = session?.expires_at ? new Date(session.expires_at).getTime() <= Date.now() : false;
      if (!session || !session.is_active || expired) {
        throw new AppError('Unauthorized: Session expired or terminated', 401);
      }

      await supabase.from('platform_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', decoded.sid).eq('is_active', true);
    }
    next();
  } catch (error) {
    errorHandler(error as AppError, req, res, next);
  }
}
