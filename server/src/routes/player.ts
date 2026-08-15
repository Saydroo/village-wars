import { Router } from 'express';
import { changeFactionSchema, type FactionId } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getPlayerById, changeFaction } from '../services/playerService';
import { settlePlayerResources } from '../services/resourceService';

export const playerRouter = Router();

playerRouter.use(requireAuth);

// GET /api/player/me — verrechnet passive Produktion und liefert Spieler + Kapazitäten
playerRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const playerId = currentPlayerId(req);
    const settle = await settlePlayerResources(playerId);
    const player = await getPlayerById(playerId);
    res.json({ player, capacities: settle?.capacities ?? null });
  }),
);

// PATCH /api/player/faction
playerRouter.patch(
  '/faction',
  asyncHandler(async (req, res) => {
    const { faction } = changeFactionSchema.parse(req.body);
    const result = await changeFaction(currentPlayerId(req), faction as FactionId);
    res.json(result);
  }),
);
