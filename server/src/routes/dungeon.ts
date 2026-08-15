import { Router } from 'express';
import { startDungeonSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import {
  completeDungeonWave,
  getDungeonHistory,
  getDungeonStatus,
  startDungeonRun,
} from '../services/dungeonService';

/**
 * Dungeon-Endpunkte (Phase 5, Abschnitt 14). PvE-Wellen werden server-autoritativ
 * pro Aufruf von /wave/complete aufgelöst.
 */
export const dungeonRouter = Router();

dungeonRouter.use(requireAuth);

// GET /api/dungeon/status — offen? + Zeitfenster + laufender Lauf
dungeonRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json(await getDungeonStatus(currentPlayerId(req)));
  }),
);

// POST /api/dungeon/start — Lauf starten (oder laufenden fortsetzen), mit Schwierigkeit
dungeonRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const { difficulty } = startDungeonSchema.parse(req.body ?? {});
    res.status(201).json(await startDungeonRun(currentPlayerId(req), difficulty));
  }),
);

// POST /api/dungeon/wave/complete — nächste Welle (bzw. Boss) auflösen
dungeonRouter.post(
  '/wave/complete',
  asyncHandler(async (req, res) => {
    res.json(await completeDungeonWave(currentPlayerId(req)));
  }),
);

// GET /api/dungeon/history — vergangene Läufe
dungeonRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    res.json(await getDungeonHistory(currentPlayerId(req)));
  }),
);
