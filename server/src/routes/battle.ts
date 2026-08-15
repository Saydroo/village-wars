import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getPlayerById } from '../services/playerService';
import { getBattleHistory } from '../services/battleService';

export const battleRouter = Router();

battleRouter.use(requireAuth);

/**
 * POST /api/battle/find — Einstiegspunkt fürs Matchmaking.
 *
 * Das eigentliche Matchmaking + der Kampf laufen in Echtzeit über Socket.io
 * (Abschnitt 8). Dieser Endpunkt liefert dem Client die nötige Auskunft, wie er
 * den Socket-Kanal nutzt (Event-Vertrag) und seine aktuellen Trophäen.
 */
battleRouter.post(
  '/find',
  asyncHandler(async (req, res) => {
    const player = await getPlayerById(currentPlayerId(req));
    res.json({
      transport: 'socket',
      emit_event: 'matchmaking:join',
      result_events: ['matchmaking:matched', 'battle:setup', 'battle:state_update', 'battle:ended'],
      trophies: player.trophies,
    });
  }),
);

// GET /api/battle/history — eigene Kampf-Historie
battleRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const battles = await getBattleHistory(currentPlayerId(req));
    res.json({ battles });
  }),
);
