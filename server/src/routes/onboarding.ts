import { Router } from 'express';
import { claimOnboardingSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getOnboarding, claimOnboardingStep } from '../services/onboardingService';

/** Onboarding / Tutorial (Roadmap P8, quest-geführter Erststart). */
export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

// GET /api/onboarding — alle Tutorial-Schritte mit Live-Fortschritt + Status
onboardingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getOnboarding(currentPlayerId(req)));
  }),
);

// POST /api/onboarding/claim — aktuell offenen Schritt abholen (step_id muss aktiv sein)
onboardingRouter.post(
  '/claim',
  asyncHandler(async (req, res) => {
    const { step_id } = claimOnboardingSchema.parse(req.body);
    res.json(await claimOnboardingStep(currentPlayerId(req), step_id));
  }),
);
