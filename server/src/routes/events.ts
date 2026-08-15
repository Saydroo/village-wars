import { Router } from 'express';
import { claimEventChallengeSchema } from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import { getEventStatus, claimEventChallenge } from '../services/eventService';

/** Limited-Time-Events (Roadmap P7-Folge). */
export const eventsRouter = Router();

eventsRouter.use(requireAuth);

// GET /api/events — aktuelles Event mit Live-Fortschritt (null = kein aktives Event)
eventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getEventStatus(currentPlayerId(req)));
  }),
);

// POST /api/events/claim — Belohnung einer erfüllten Aufgabe abholen
eventsRouter.post(
  '/claim',
  asyncHandler(async (req, res) => {
    const { challenge_id } = claimEventChallengeSchema.parse(req.body);
    res.json(await claimEventChallenge(currentPlayerId(req), challenge_id));
  }),
);
