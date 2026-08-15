import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getQuestStatus, claimQuest } from '../services/questService';

/** Tägliche Quests (Roadmap P4). */
export const questsRouter = Router();

questsRouter.use(requireAuth);

const claimSchema = z.object({ quest_id: z.string().min(1) });

// GET /api/quests — aktueller Quest-Status
questsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getQuestStatus(currentPlayerId(req)));
  }),
);

// POST /api/quests/claim — Belohnung einer abgeschlossenen Quest einsammeln
questsRouter.post(
  '/claim',
  asyncHandler(async (req, res) => {
    const { quest_id } = claimSchema.parse(req.body);
    res.json(await claimQuest(currentPlayerId(req), quest_id));
  }),
);
