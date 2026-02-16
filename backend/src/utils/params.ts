import { Request } from 'express';

/** Normalize req.params[key] to string (Express may type it as string | string[]). */
export function getParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}
