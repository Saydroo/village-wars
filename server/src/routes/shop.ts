import { Router } from 'express';
import { iapPurchaseSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { applySkin, buySkin, listSkins } from '../services/shopService';
import { purchaseBars } from '../services/iapService';
import { getGameConfig } from '../gameConfig';

/**
 * Shop-Endpunkte (Phase 5, Abschnitt 14). Skin-Galerie/Kauf/Anwenden (rein
 * kosmetisch) + Goldbarren-Kauf via IAP. Reihenfolge: /bars/* und /skins
 * (literal) vor den :skinId-Pfaden.
 */
export const shopRouter = Router();

shopRouter.use(requireAuth);

// GET /api/shop/skins — Galerie (mit Besitz-/Anwendungs-Status)
shopRouter.get(
  '/skins',
  asyncHandler(async (req, res) => {
    res.json(await listSkins(currentPlayerId(req)));
  }),
);

// GET /api/shop/bars/packages — verfügbare Goldbarren-Pakete (IAP)
shopRouter.get(
  '/bars/packages',
  asyncHandler(async (_req, res) => {
    res.json({ packages: getGameConfig().iap.packages });
  }),
);

// POST /api/shop/bars/purchase — IAP-Beleg verifizieren & Goldbarren gutschreiben
shopRouter.post(
  '/bars/purchase',
  asyncHandler(async (req, res) => {
    const input = iapPurchaseSchema.parse(req.body);
    res.json(await purchaseBars(currentPlayerId(req), input));
  }),
);

// POST /api/shop/skins/:skinId/buy — Skin kaufen
shopRouter.post(
  '/skins/:skinId/buy',
  asyncHandler(async (req, res) => {
    res.json(await buySkin(currentPlayerId(req), String(req.params.skinId)));
  }),
);

// POST /api/shop/skins/:skinId/apply — Skin anwenden (rein kosmetisch)
shopRouter.post(
  '/skins/:skinId/apply',
  asyncHandler(async (req, res) => {
    res.json(await applySkin(currentPlayerId(req), String(req.params.skinId), true));
  }),
);

// POST /api/shop/skins/:skinId/unapply — Skin entfernen (Standard-Optik)
shopRouter.post(
  '/skins/:skinId/unapply',
  asyncHandler(async (req, res) => {
    res.json(await applySkin(currentPlayerId(req), String(req.params.skinId), false));
  }),
);
