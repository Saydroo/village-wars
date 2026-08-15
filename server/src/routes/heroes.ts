import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getHeroStatus, startHeroLevelUp, cancelHeroLevelUp } from '../services/heroService';

/** Helden-System (Roadmap P6). */
export const heroesRouter = Router();

heroesRouter.use(requireAuth);

// GET /api/heroes — aktueller Helden-Status
heroesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getHeroStatus(currentPlayerId(req)));
  }),
);

// POST /api/heroes/levelup — Helden-Level-Up starten
heroesRouter.post(
  '/levelup',
  asyncHandler(async (req, res) => {
    res.json(await startHeroLevelUp(currentPlayerId(req)));
  }),
);

// DELETE /api/heroes/levelup — Helden-Level-Up abbrechen
heroesRouter.delete(
  '/levelup',
  asyncHandler(async (req, res) => {
    res.json(await cancelHeroLevelUp(currentPlayerId(req)));
  }),
);
