import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { claimDailyReward, getDailyStatus } from '../services/dailyRewardService';

/** Tägliche Login-Belohnung + Streak (Roadmap P1, Retention). */
export const dailyRouter = Router();

dailyRouter.use(requireAuth);

// GET /api/daily/status — abholbar? + Streak + Leiter + heutige Belohnung
dailyRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json(await getDailyStatus(currentPlayerId(req)));
  }),
);

// POST /api/daily/claim — heutige Belohnung abholen (einmal pro Berlin-Tag)
dailyRouter.post(
  '/claim',
  asyncHandler(async (req, res) => {
    res.json(await claimDailyReward(currentPlayerId(req)));
  }),
);
