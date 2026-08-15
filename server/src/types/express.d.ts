import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Vom auth-Middleware gesetzt: authentifizierte Spieler-ID. */
      playerId?: string;
    }
  }
}

export {};
