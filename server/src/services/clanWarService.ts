import type { GameConfig, ClanWar } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { logger } from '../logger';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { mapClanWar, CLAN_WAR_COLUMNS } from './mappers';

/**
 * Clan-Krieg (Phase 4, Abschnitt 10). In-Memory-Queue für das Clan-vs-Clan-
 * Matchmaking + Lebenszyklus eines Kriegs in der DB (clan_wars). Kriegspunkte =
 * Summe der von den Mitgliedern erzielten Zerstörung (recordClanWarAttack, aus
 * battleService). Bei Ablauf (ends_at) wird der Sieger bestimmt und Saison-Punkte
 * (clans.season_points → leaderboard_clan) ausgeschüttet. Bewusst in-process
 * gehalten wie das Solo-Matchmaking (ein Server = autoritativ, ohne Redis).
 */

interface WarQueueEntry {
  clanId: string;
  memberCount: number;
  joinedAt: number;
}

const warQueue = new Map<string, WarQueueEntry>();
let loopHandle: ReturnType<typeof setInterval> | null = null;

/** Aktive Saisonnummer (Fallback 1, falls noch keine Saison angelegt ist). */
export async function getActiveSeasonNumber(): Promise<number> {
  const res = await query(
    `SELECT season_number FROM seasons WHERE is_active = TRUE ORDER BY season_number DESC LIMIT 1`,
  );
  return res.rows[0] ? Number((res.rows[0] as { season_number: number }).season_number) : 1;
}

/** Stellt einen Clan in die Kriegs-Warteschlange (Leader/Co-Leader-geprüft im Service). */
export async function requestWar(clanId: string): Promise<{ queued: boolean; war: ClanWar | null }> {
  const config = getGameConfig();

  // Bereits in einem laufenden Krieg?
  const existing = await getActiveWarForClan(clanId);
  if (existing) return { queued: false, war: existing };

  const cnt = await query(
    `SELECT COUNT(*)::int AS n FROM clan_members WHERE clan_id = $1`,
    [clanId],
  );
  const members = Number((cnt.rows[0] as { n: number }).n);
  if (members < config.clan.war.min_members_per_clan) {
    throw badRequest(`Mindestens ${config.clan.war.min_members_per_clan} Mitglied(er) für einen Krieg nötig`);
  }
  if (warQueue.has(clanId)) {
    throw conflict('Clan sucht bereits einen Kriegsgegner');
  }
  warQueue.set(clanId, { clanId, memberCount: members, joinedAt: Date.now() });
  return { queued: true, war: null };
}

export function cancelWarRequest(clanId: string): void {
  warQueue.delete(clanId);
}

export function isQueuedForWar(clanId: string): boolean {
  return warQueue.has(clanId);
}

/** Erstellt eine Kriegs-Zeile zwischen zwei Clans. */
async function createWar(config: GameConfig, clanAId: string, clanBId: string): Promise<void> {
  const season = await getActiveSeasonNumber();
  const durationMin = config.clan.war.duration_minutes;
  await query(
    `INSERT INTO clan_wars (clan_a_id, clan_b_id, status, season_number, started_at, ends_at)
     VALUES ($1, $2, 'in_progress', $3, NOW(), NOW() + ($4 * INTERVAL '1 minute'))`,
    [clanAId, clanBId, season, durationMin],
  );
  logger.info('Clan-Krieg gestartet', { clanAId, clanBId, durationMin });
}

/** Pairing-Tick: koppelt zwei wartende Clans zu einem Krieg. */
async function tick(config: GameConfig): Promise<void> {
  if (warQueue.size < 2) return;
  const waiting = [...warQueue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  // Greedy paaren (FIFO). Bei Bedarf später Toleranz nach memberCount verfeinern.
  for (let i = 0; i + 1 < waiting.length; i += 2) {
    const a = waiting[i]!;
    const b = waiting[i + 1]!;
    warQueue.delete(a.clanId);
    warQueue.delete(b.clanId);
    try {
      await createWar(config, a.clanId, b.clanId);
    } catch (err) {
      logger.error('Krieg-Erstellung fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function startClanWarMatchmaking(config: GameConfig): void {
  if (loopHandle) return;
  loopHandle = setInterval(() => {
    void tick(config).catch((err) =>
      logger.error('Clan-Krieg-Tick fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    void settleExpiredWars().catch(() => undefined);
  }, 2000);
  logger.info('Clan-Krieg-Matchmaking gestartet');
}

export function stopClanWarMatchmaking(): void {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
}

/** Laufender Krieg eines Clans (verrechnet vorher abgelaufene Kriege). */
export async function getActiveWarForClan(clanId: string): Promise<ClanWar | null> {
  await settleExpiredWars().catch(() => undefined);
  const res = await query(
    `SELECT ${CLAN_WAR_COLUMNS} FROM clan_wars
      WHERE status = 'in_progress' AND (clan_a_id = $1 OR clan_b_id = $1)
      ORDER BY started_at DESC LIMIT 1`,
    [clanId],
  );
  return res.rows[0] ? mapClanWar(res.rows[0] as Record<string, unknown>) : null;
}

export interface WarContext {
  warId: string;
  attackerClanId: string;
}

/** Kriegskontext eines Spielers (für socket clanwar:join → Battle). */
export async function getWarContextForPlayer(playerId: string): Promise<WarContext | null> {
  const res = await query(
    `SELECT w.id, p.clan_id
       FROM players p
       JOIN clan_wars w ON w.status = 'in_progress'
                       AND (w.clan_a_id = p.clan_id OR w.clan_b_id = p.clan_id)
      WHERE p.id = $1
      ORDER BY w.started_at DESC LIMIT 1`,
    [playerId],
  );
  const row = res.rows[0] as { id: string; clan_id: string } | undefined;
  return row ? { warId: row.id, attackerClanId: row.clan_id } : null;
}

/** Wählt einen Verteidiger aus dem feindlichen Clan (zufälliges Mitglied mit Dorf). */
export async function pickEnemyDefender(warId: string, attackerId: string): Promise<string | null> {
  const war = await query(
    `SELECT clan_a_id, clan_b_id FROM clan_wars WHERE id = $1`,
    [warId],
  );
  const w = war.rows[0] as { clan_a_id: string; clan_b_id: string } | undefined;
  if (!w) throw notFound('Krieg nicht gefunden');
  const me = await query(`SELECT clan_id FROM players WHERE id = $1`, [attackerId]);
  const myClan = (me.rows[0] as { clan_id: string | null } | undefined)?.clan_id ?? null;
  const enemyClan = myClan === w.clan_a_id ? w.clan_b_id : w.clan_a_id;

  const res = await query(
    `SELECT cm.player_id FROM clan_members cm
       JOIN villages v ON v.player_id = cm.player_id
      WHERE cm.clan_id = $1 AND cm.player_id <> $2
      ORDER BY random() LIMIT 1`,
    [enemyClan, attackerId],
  );
  return res.rows[0] ? (res.rows[0] as { player_id: string }).player_id : null;
}

/** Trägt erzielte Zerstörung als Kriegspunkte für den Angreifer-Clan ein. */
export async function recordClanWarAttack(
  warId: string,
  attackerClanId: string,
  destructionPct: number,
): Promise<void> {
  const points = Math.max(0, Math.round(destructionPct));
  await query(
    `UPDATE clan_wars
        SET clan_a_points = clan_a_points + CASE WHEN clan_a_id = $2 THEN $3 ELSE 0 END,
            clan_b_points = clan_b_points + CASE WHEN clan_b_id = $2 THEN $3 ELSE 0 END
      WHERE id = $1 AND status = 'in_progress'`,
    [warId, attackerClanId, points],
  );
}

/**
 * Schließt abgelaufene Kriege ab: Sieger nach Punkten, Saison-Punkte +
 * total_wins gutschreiben und leaderboard_clan fortschreiben (Abschnitt 11).
 */
export async function settleExpiredWars(): Promise<number> {
  const config = getGameConfig();
  const due = await query(
    `SELECT id, clan_a_id, clan_b_id, clan_a_points, clan_b_points, season_number
       FROM clan_wars
      WHERE status = 'in_progress' AND ends_at IS NOT NULL AND ends_at <= NOW()`,
  );
  let settled = 0;
  for (const r of due.rows as Array<{
    id: string;
    clan_a_id: string;
    clan_b_id: string;
    clan_a_points: number;
    clan_b_points: number;
    season_number: number | null;
  }>) {
    const a = Number(r.clan_a_points);
    const b = Number(r.clan_b_points);
    const winner = a > b ? r.clan_a_id : b > a ? r.clan_b_id : null;
    const season = r.season_number ?? (await getActiveSeasonNumber());

    await withTransaction(async (client) => {
      // Doppelte Abrechnung vermeiden (nur, wenn noch in_progress).
      const upd = await client.query(
        `UPDATE clan_wars SET status = 'ended', winner_clan_id = $2, finished_at = NOW()
          WHERE id = $1 AND status = 'in_progress'`,
        [r.id, winner],
      );
      if (upd.rowCount === 0) return;

      if (winner) {
        await client.query(
          `UPDATE clans SET season_points = season_points + $2, total_wins = total_wins + 1 WHERE id = $1`,
          [winner, config.clan.war.win_season_points],
        );
        await upsertClanLeaderboard(client, winner, season);
      } else {
        // Unentschieden: beide Clans erhalten Trostpunkte.
        for (const clanId of [r.clan_a_id, r.clan_b_id]) {
          await client.query(
            `UPDATE clans SET season_points = season_points + $2 WHERE id = $1`,
            [clanId, config.clan.war.draw_season_points],
          );
          await upsertClanLeaderboard(client, clanId, season);
        }
      }
      settled += 1;
    });
  }
  if (settled > 0) logger.info('Clan-Kriege abgeschlossen', { count: settled });
  return settled;
}

/** Schreibt den aktuellen season_points-Stand eines Clans in leaderboard_clan. */
async function upsertClanLeaderboard(
  client: import('pg').PoolClient,
  clanId: string,
  seasonNumber: number,
): Promise<void> {
  await client.query(
    `INSERT INTO leaderboard_clan (clan_id, season_points, season_number)
       SELECT id, season_points, $2 FROM clans WHERE id = $1
     ON CONFLICT (clan_id, season_number)
       DO UPDATE SET season_points = EXCLUDED.season_points, updated_at = NOW()`,
    [clanId, seasonNumber],
  );
}
