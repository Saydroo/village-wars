import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import {
  getResearchStatus,
  startResearch,
  cancelResearch,
} from '../services/researchService';

/** Truppen-Level-Forschung (Roadmap P3). */
export const researchRouter = Router();

researchRouter.use(requireAuth);

// GET /api/research — aktueller Forschungsstand (unit_levels + active queue)
researchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getResearchStatus(currentPlayerId(req)));
  }),
);

const startSchema = z.object({ unit_type: z.string().min(1) });

// POST /api/research/start — Forschung starten
researchRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const { unit_type } = startSchema.parse(req.body);
    res.json(await startResearch(currentPlayerId(req), unit_type));
  }),
);

// DELETE /api/research/cancel — laufende Forschung abbrechen
researchRouter.delete(
  '/cancel',
  asyncHandler(async (req, res) => {
    res.json(await cancelResearch(currentPlayerId(req)));
  }),
);
