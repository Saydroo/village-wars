import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getClanLeaderboard, getSoloLeaderboard } from '../services/leaderboardService';
import { getPlayerById } from '../services/playerService';

/** Ranglisten-Endpunkte (Phase 4, Abschnitt 14). */
export const leaderboardRouter = Router();

leaderboardRouter.use(requireAuth);

function intParam(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// GET /api/leaderboard/solo?page=1&limit=50
leaderboardRouter.get(
  '/solo',
  asyncHandler(async (req, res) => {
    const data = await getSoloLeaderboard(
      currentPlayerId(req),
      intParam(req.query.page),
      intParam(req.query.limit),
    );
    res.json(data);
  }),
);

// GET /api/leaderboard/clan?season=current&page=1&limit=50
leaderboardRouter.get(
  '/clan',
  asyncHandler(async (req, res) => {
    const player = await getPlayerById(currentPlayerId(req));
    const seasonRaw = req.query.season;
    const season =
      seasonRaw === undefined || seasonRaw === 'current'
        ? 'current'
        : (intParam(seasonRaw) ?? 'current');
    const data = await getClanLeaderboard(
      player.clan_id,
      season,
      intParam(req.query.page),
      intParam(req.query.limit),
    );
    res.json(data);
  }),
);
