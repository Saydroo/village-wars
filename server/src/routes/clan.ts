import { Router } from 'express';
import {
  createClanSchema,
  donateUnitsSchema,
  sendClanMessageSchema,
  createDonationRequestSchema,
} from '@village-wars/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, currentPlayerId } from '../middleware/auth';
import {
  changeMemberRole,
  createClan,
  donateToCastle,
  getCastle,
  getClanDetail,
  joinClan,
  leaveClan,
  listClans,
  requireLeadership,
} from '../services/clanService';
import { getClanMessages, postClanMessage } from '../services/clanChatService';
import {
  cancelDonationRequest,
  createDonationRequest,
  donateToRequest,
  listDonationRequests,
} from '../services/clanDonationService';
import { getActiveWarForClan, requestWar } from '../services/clanWarService';
import { getPlayerById } from '../services/playerService';

/**
 * Clan-Endpunkte (Phase 4, Abschnitt 14). Reihenfolge wichtig: spezifische
 * GET-Pfade (/, /castle, /wars/current) müssen VOR dem Catch-all GET /:clanId
 * registriert werden.
 */
export const clanRouter = Router();

clanRouter.use(requireAuth);

// GET /api/clan?search= — Clan-Liste/Suche (Beitreten)
clanRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const clans = await listClans(search);
    res.json({ clans });
  }),
);

// POST /api/clan/create — Clan erstellen (Spieler wird Leader)
clanRouter.post(
  '/create',
  asyncHandler(async (req, res) => {
    const input = createClanSchema.parse(req.body);
    const result = await createClan(currentPlayerId(req), input);
    res.status(201).json(result);
  }),
);

// DELETE /api/clan/leave — Clan verlassen
clanRouter.delete(
  '/leave',
  asyncHandler(async (req, res) => {
    const result = await leaveClan(currentPlayerId(req));
    res.json(result);
  }),
);

// GET /api/clan/castle — eigene Clan-Burg (Housing)
clanRouter.get(
  '/castle',
  asyncHandler(async (req, res) => {
    const castle = await getCastle(currentPlayerId(req));
    res.json(castle);
  }),
);

// POST /api/clan/castle/donate — Einheiten in einer Clan-Burg stationieren
clanRouter.post(
  '/castle/donate',
  asyncHandler(async (req, res) => {
    const input = donateUnitsSchema.parse(req.body);
    const castle = await donateToCastle(currentPlayerId(req), input);
    res.json(castle);
  }),
);

// GET /api/clan/wars/current — laufender Clan-Krieg des eigenen Clans
clanRouter.get(
  '/wars/current',
  asyncHandler(async (req, res) => {
    const player = await getPlayerById(currentPlayerId(req));
    const war = player.clan_id ? await getActiveWarForClan(player.clan_id) : null;
    res.json({ war, my_clan_id: player.clan_id });
  }),
);

// POST /api/clan/wars/start — Kriegssuche starten (Leader/Co-Leader)
clanRouter.post(
  '/wars/start',
  asyncHandler(async (req, res) => {
    const clanId = await requireLeadership(currentPlayerId(req));
    const result = await requestWar(clanId);
    res.json(result);
  }),
);

// GET /api/clan/chat — Chat-Verlauf des eigenen Clans (neueste zuerst, paginiert)
clanRouter.get(
  '/chat',
  asyncHandler(async (req, res) => {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const result = await getClanMessages(currentPlayerId(req), before, limit);
    res.json(result);
  }),
);

// POST /api/clan/chat — Nachricht im eigenen Clan senden
clanRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const { body } = sendClanMessageSchema.parse(req.body);
    const message = await postClanMessage(currentPlayerId(req), body);
    res.status(201).json({ message });
  }),
);

// GET /api/clan/donations — offene Spenden-Anfragen des eigenen Clans
clanRouter.get(
  '/donations',
  asyncHandler(async (req, res) => {
    res.json(await listDonationRequests(currentPlayerId(req)));
  }),
);

// POST /api/clan/donations — eigene Spenden-Anfrage öffnen
clanRouter.post(
  '/donations',
  asyncHandler(async (req, res) => {
    const input = createDonationRequestSchema.parse(req.body);
    res.status(201).json(await createDonationRequest(currentPlayerId(req), input));
  }),
);

// DELETE /api/clan/donations — eigene offene Anfrage schließen
clanRouter.delete(
  '/donations',
  asyncHandler(async (req, res) => {
    await cancelDonationRequest(currentPlayerId(req));
    res.json({ ok: true });
  }),
);

// POST /api/clan/donations/:id/donate — auf eine Anfrage spenden
clanRouter.post(
  '/donations/:id/donate',
  asyncHandler(async (req, res) => {
    const input = donateUnitsSchema.parse(req.body);
    const request = await donateToRequest(currentPlayerId(req), String(req.params.id), input);
    res.json({ request });
  }),
);

// POST /api/clan/join/:clanId — Clan beitreten
clanRouter.post(
  '/join/:clanId',
  asyncHandler(async (req, res) => {
    const result = await joinClan(currentPlayerId(req), String(req.params.clanId));
    res.json(result);
  }),
);

// POST /api/clan/members/:playerId/promote — befördern (member→co_leader / Führungsübergabe)
clanRouter.post(
  '/members/:playerId/promote',
  asyncHandler(async (req, res) => {
    const detail = await changeMemberRole(currentPlayerId(req), String(req.params.playerId), 'promote');
    res.json(detail);
  }),
);

// POST /api/clan/members/:playerId/demote — degradieren (co_leader→member, nur Leader)
clanRouter.post(
  '/members/:playerId/demote',
  asyncHandler(async (req, res) => {
    const detail = await changeMemberRole(currentPlayerId(req), String(req.params.playerId), 'demote');
    res.json(detail);
  }),
);

// GET /api/clan/:clanId — Clan-Vollansicht (Mitglieder + Krieg)
clanRouter.get(
  '/:clanId',
  asyncHandler(async (req, res) => {
    const detail = await getClanDetail(String(req.params.clanId));
    res.json(detail);
  }),
);
