import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { pingDatabase } from '../db/pool';
import { pingRedis } from '../redis/client';
import { getGameConfig } from '../gameConfig';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [db, redis] = await Promise.all([pingDatabase(), pingRedis()]);
    res.json({
      status: 'ok',
      version: getGameConfig()._meta.version,
      services: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
      time: new Date().toISOString(),
    });
  }),
);
