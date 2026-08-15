import type { NextFunction, Request, Response, RequestHandler } from 'express';

/** Wickelt einen async-Handler so, dass Fehler an Express' next() gehen. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
