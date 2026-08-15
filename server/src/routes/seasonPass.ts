import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getSeasonPassStatus, unlockPremium, claimTier } from '../services/seasonPassService';

/** Season-/Battle-Pass (Roadmap P7). */
export const seasonPassRouter = Router();

seasonPassRouter.use(requireAuth);

const claimSchema = z.object({
  tier: z.number().int().positive(),
  track: z.enum(['free', 'premium']),
});

// GET /api/season-pass — aktueller Pass-Status (XP, Stufen, Claims)
seasonPassRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getSeasonPassStatus(currentPlayerId(req)));
  }),
);

// POST /api/season-pass/unlock — Premium-Track mit Gems freischalten
seasonPassRouter.post(
  '/unlock',
  asyncHandler(async (req, res) => {
    res.json(await unlockPremium(currentPlayerId(req)));
  }),
);

// POST /api/season-pass/claim — eine erreichte Stufe einsammeln (free/premium)
seasonPassRouter.post(
  '/claim',
  asyncHandler(async (req, res) => {
    const { tier, track } = claimSchema.parse(req.body);
    res.json(await claimTier(currentPlayerId(req), tier, track));
  }),
);
