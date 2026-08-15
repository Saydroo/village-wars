import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@village-wars/shared';
import { HttpError } from '../utils/httpError';
import { logger } from '../logger';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: 'not_found', message: `Route nicht gefunden: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'validation_error',
        message: 'Eingabevalidierung fehlgeschlagen',
        details: err.issues,
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  // Postgres unique-violation -> 409
  if (isPgUniqueViolation(err)) {
    const body: ApiErrorBody = {
      error: { code: 'conflict', message: 'Eindeutigkeitsverletzung (bereits vergeben)' },
    };
    res.status(409).json(body);
    return;
  }

  // Postgres invalid_text_representation (22P02) -> 400 statt 500.
  // Tritt z.B. auf, wenn ein nicht-UUID-Pfadparameter in eine UUID-Spalte fließt.
  if (isPgCode(err, '22P02')) {
    const body: ApiErrorBody = {
      error: { code: 'bad_request', message: 'Ungültiger Parameter (z. B. fehlerhafte ID)' },
    };
    res.status(400).json(body);
    return;
  }

  logger.error('Unbehandelter Fehler', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Interner Serverfehler' },
  };
  res.status(500).json(body);
}

function isPgUniqueViolation(err: unknown): boolean {
  return isPgCode(err, '23505');
}

function isPgCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === code
  );
}
