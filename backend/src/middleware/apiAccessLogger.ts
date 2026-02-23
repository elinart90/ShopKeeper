import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

interface JwtPayload {
  sub?: string;
}

function extractActorUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

export function apiAccessLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const actorUserId = extractActorUserId(req);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const pathOnly = req.originalUrl.split('?')[0];
    void supabase.from('admin_api_access_logs').insert({
      actor_user_id: actorUserId,
      method: req.method,
      path: pathOnly,
      status_code: res.statusCode,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
      query_json: req.query || {},
      duration_ms: durationMs,
    });
  });

  next();
}
