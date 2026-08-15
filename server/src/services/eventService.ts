import type { PoolClient } from 'pg';
import type {
  EventStatusResponse,
  EventClaimResponse,
  EventMetric,
} from '@village-wars/shared';
import {
  getActiveEvent,
  getEventChallenge,
  isChallengeComplete,
  buildEventChallengeView,
  resourceCap,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Limited-Time-Events (Roadmap P7-Folge). Das aktuell aktive Event-Fenster wird
 * aus der Config bestimmt; Aufgaben-Fortschritt wird **live aus dem Spielstand
 * SEIT Event-Start** gezählt (gewonnene Solo-Angriffe / Dungeon-Läufe — keine
 * Event-Instrumentierung). Aufgaben sind einmalig und nur bei aktivem Event
 * abholbar; Ressourcen-Belohnung wird auf das Lager-Cap gekappt.
 */

/** Live-Wert einer Event-Metrik seit Event-Start (ISO `since`). */
async function metricValue(
  metric: EventMetric,
  playerId: string,
  since: string,
  client?: PoolClient,
): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  switch (metric) {
    case 'battles_won': {
      const r = await q(
        `SELECT COUNT(*)::int AS n FROM battles
          WHERE attacker_id = $1 AND mode = 'solo' AND result = 'attacker_win'
            AND started_at >= $2::timestamptz`,
        [playerId, since],
      );
      return Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);
    }
    case 'dungeons_cleared': {
      const r = await q(
        `SELECT COUNT(*)::int AS n FROM dungeon_runs
          WHERE player_id = $1 AND status = 'won' AND started_at >= $2::timestamptz`,
        [playerId, since],
      );
      return Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);
    }
    default:
      return 0;
  }
}

/** Abgeholte Aufgaben-IDs eines Spielers im Event. */
async function loadClaimed(
  playerId: string,
  eventId: string,
  client?: PoolClient,
): Promise<Set<string>> {
  const q = client ? client.query.bind(client) : query;
  const r = await q(
    `SELECT challenge_id FROM player_event_claims WHERE player_id = $1 AND event_id = $2`,
    [playerId, eventId],
  );
  return new Set((r.rows as Array<{ challenge_id: string }>).map((x) => String(x.challenge_id)));
}

/** Aktuelles Event mit Live-Fortschritt + Abhol-Status (null = kein aktives Event). */
export async function getEventStatus(playerId: string): Promise<EventStatusResponse> {
  const config = getGameConfig();
  const event = getActiveEvent(config, new Date());
  if (!event) return { event: null };

  const claimed = await loadClaimed(playerId, event.id);
  // Live-Werte je benötigter Metrik (dedupliziert) seit Event-Start.
  const metrics = [...new Set(event.challenges.map((c) => c.metric))];
  const values = new Map<EventMetric, number>();
  await Promise.all(
    metrics.map(async (m) => values.set(m, await metricValue(m, playerId, event.starts_at))),
  );

  const challenges = event.challenges.map((c) =>
    buildEventChallengeView(c, values.get(c.metric) ?? 0, claimed.has(c.id)),
  );
  return {
    event: {
      id: event.id,
      name: event.name,
      icon: event.icon,
      description: event.description,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      challenges,
    },
  };
}

/** Holt die Belohnung einer erfüllten Event-Aufgabe ab (nur bei aktivem Event). */
export async function claimEventChallenge(
  playerId: string,
  challengeId: string,
): Promise<EventClaimResponse> {
  const config = getGameConfig();
  const event = getActiveEvent(config, new Date());
  if (!event) throw badRequest('Derzeit ist kein Event aktiv');

  const def = getEventChallenge(event, challengeId);
  if (!def) throw notFound('Event-Aufgabe nicht gefunden');

  return withTransaction(async (client) => {
    const value = await metricValue(def.metric, playerId, event.starts_at, client);
    if (!isChallengeComplete(value, def.target)) {
      throw badRequest('Diese Aufgabe ist noch nicht erfüllt');
    }

    // Einmalig abholbar — Claim-Zeile sperrt gegen Doppel-Abholung.
    const ins = await client.query(
      `INSERT INTO player_event_claims (player_id, event_id, challenge_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, event_id, challenge_id) DO NOTHING
       RETURNING challenge_id`,
      [playerId, event.id, challengeId],
    );
    if (ins.rows.length === 0) throw badRequest('Belohnung wurde bereits abgeholt');

    const r = def.reward;
    const wood = r.wood ?? 0;
    const stone = r.stone ?? 0;
    const gold = r.gold ?? 0;
    const gems = r.gems ?? 0;
    const goldBars = r.gold_bars ?? 0;

    const br = await client.query(
      `SELECT building_type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings: OwnedBuilding[] = br.rows.map((b) => ({
      building_type: b.building_type as string,
      level: Number(b.level),
    }));
    const capWood = resourceCap(config, buildings, 'wood');
    const capStone = resourceCap(config, buildings, 'stone');
    const capGold = resourceCap(config, buildings, 'gold');

    const pr = await client.query(
      `UPDATE players
          SET wood = LEAST(wood + $1, $2),
              stone = LEAST(stone + $3, $4),
              gold = LEAST(gold + $5, $6),
              gems = gems + $7,
              gold_bars = gold_bars + $8
        WHERE id = $9
      RETURNING ${PLAYER_COLUMNS}`,
      [wood, capWood, stone, capStone, gold, capGold, gems, goldBars, playerId],
    );
    const player = mapPlayer(pr.rows[0] as Record<string, unknown>);
    const challenge = buildEventChallengeView(def, value, true);

    return {
      player,
      challenge,
      claimed_wood: wood,
      claimed_stone: stone,
      claimed_gold: gold,
      claimed_gems: gems,
      claimed_gold_bars: goldBars,
    };
  });
}
