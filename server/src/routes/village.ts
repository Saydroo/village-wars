import { Router } from 'express';
import { placeBuildingSchema, moveBuildingSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import {
  getVillageWithBuildings,
  placeBuilding,
  moveBuilding,
  deleteBuilding,
  storeBuilding,
  listInventory,
  placeFromInventory,
} from '../services/villageService';
import { settlePlayerResources } from '../services/resourceService';
import { startUpgrade, skipUpgrade } from '../services/upgradeService';

export const villageRouter = Router();

// GET /api/village/:playerId — öffentlich lesbar (für Battle-Vorschau etc.)
villageRouter.get(
  '/:playerId',
  asyncHandler(async (req, res) => {
    const playerId = String(req.params.playerId);
    // Passive Produktion vor dem Lesen verrechnen (zeitbasiert).
    await settlePlayerResources(playerId).catch(() => undefined);
    const data = await getVillageWithBuildings(playerId);
    res.json(data);
  }),
);

// POST /api/village/buildings — Gebäude platzieren
villageRouter.post(
  '/buildings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = placeBuildingSchema.parse(req.body);
    const building = await placeBuilding(currentPlayerId(req), input);
    res.status(201).json({ building });
  }),
);

// PATCH /api/village/buildings/:id/move — Gebäude verschieben
villageRouter.patch(
  '/buildings/:id/move',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = moveBuildingSchema.parse(req.body);
    const building = await moveBuilding(currentPlayerId(req), String(req.params.id), input);
    res.json({ building });
  }),
);

// DELETE /api/village/buildings/:id
villageRouter.delete(
  '/buildings/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteBuilding(currentPlayerId(req), String(req.params.id));
    res.status(204).send();
  }),
);

// POST /api/village/buildings/:id/store — Gebäude einlagern (statt löschen)
villageRouter.post(
  '/buildings/:id/store',
  requireAuth,
  asyncHandler(async (req, res) => {
    await storeBuilding(currentPlayerId(req), String(req.params.id));
    const inventory = await listInventory(currentPlayerId(req));
    res.json({ inventory });
  }),
);

// GET /api/village/inventory — eingelagerte Gebäude
villageRouter.get(
  '/inventory/list',
  requireAuth,
  asyncHandler(async (req, res) => {
    const inventory = await listInventory(currentPlayerId(req));
    res.json({ inventory });
  }),
);

// POST /api/village/inventory/:invId/place — eingelagertes Gebäude platzieren
villageRouter.post(
  '/inventory/:invId/place',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = moveBuildingSchema.parse(req.body);
    const building = await placeFromInventory(currentPlayerId(req), String(req.params.invId), input);
    res.status(201).json({ building });
  }),
);

// POST /api/village/buildings/:id/upgrade/start
villageRouter.post(
  '/buildings/:id/upgrade/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await startUpgrade(currentPlayerId(req), String(req.params.id));
    res.json(result);
  }),
);

// POST /api/village/buildings/:id/upgrade/skip — Goldbarren-Skip
villageRouter.post(
  '/buildings/:id/upgrade/skip',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await skipUpgrade(currentPlayerId(req), String(req.params.id));
    res.json(result);
  }),
);
