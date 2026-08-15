import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { apiRouter } from './routes';
import { apiLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Allgemeines Rate-Limit für die gesamte API
  app.use('/api', apiLimiter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
