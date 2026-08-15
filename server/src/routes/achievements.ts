import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { claimAchievement, getAchievements } from '../services/achievementService';

/** Achievements (Roadmap P2, Retention/Ziele). */
export const achievementsRouter = Router();

achievementsRouter.use(requireAuth);

// GET /api/achievements — alle Achievements mit Live-Fortschritt + Anspruch
achievementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getAchievements(currentPlayerId(req)));
  }),
);

// POST /api/achievements/:id/claim — neu erreichte Stufen abholen
achievementsRouter.post(
  '/:id/claim',
  asyncHandler(async (req, res) => {
    res.json(await claimAchievement(currentPlayerId(req), String(req.params.id)));
  }),
);
