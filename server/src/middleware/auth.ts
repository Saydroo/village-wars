import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { unauthorized } from '../utils/httpError';

/**
 * Verlangt ein gültiges Bearer-Access-Token und setzt req.playerId.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Authorization-Header (Bearer) fehlt');
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);
  req.playerId = payload.sub;
  next();
}

/** Liefert die authentifizierte Spieler-ID (nach requireAuth garantiert gesetzt). */
export function currentPlayerId(req: Request): string {
  if (!req.playerId) throw unauthorized();
  return req.playerId;
}
