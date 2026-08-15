import { Router } from 'express';
import { trainUnitsSchema, disbandUnitsSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getArmy, trainUnits, disbandUnits } from '../services/unitService';

export const unitsRouter = Router();

unitsRouter.use(requireAuth);

// GET /api/units/me — fertige Armee + laufende Trainings (verrechnet Fälliges)
unitsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const army = await getArmy(currentPlayerId(req));
    res.json(army);
  }),
);

// POST /api/units/train — Einheiten trainieren
unitsRouter.post(
  '/train',
  asyncHandler(async (req, res) => {
    const { unit_type, quantity } = trainUnitsSchema.parse(req.body);
    const result = await trainUnits(currentPlayerId(req), unit_type, quantity);
    res.status(201).json(result);
  }),
);

// DELETE /api/units/:id — Einheiten entlassen (optional: quantity im Body)
unitsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { quantity } = disbandUnitsSchema.parse(req.body ?? {});
    const army = await disbandUnits(currentPlayerId(req), String(req.params.id), quantity);
    res.json(army);
  }),
);
