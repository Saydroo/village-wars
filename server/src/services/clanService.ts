import Filter from 'bad-words';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type {
  Clan,
  ClanBanner,
  ClanDetailResponse,
  ClanMember,
  ClanSummary,
  CastleResponse,
  FactionId,
  Player,
} from '@village-wars/shared';
import { clanCastleHousing, defendersHousingUsed, unitHousing, validateBanner } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { settleTrainingTx } from './unitService';
import { cancelWarRequest, getActiveWarForClan } from './clanWarService';
import {
  mapClan,
  mapCastleDefender,
  mapPlayer,
  CLAN_COLUMNS,
  PLAYER_COLUMNS,
} from './mappers';

/**
 * Clan-System (Phase 4, Abschnitt 10). Erstellen/Beitreten/Verlassen, Banner-
 * Baukasten + Tag/Name-Profanity-Filter (bad-words), Clan-Burg-Stationierung mit
 * Housing-Space-Logik. players.clan_id und clan_members werden synchron gehalten.
 * Alle Schwellen/Optionen kommen aus game-config.json (clan.*).
 */

// --- Profanity-Filter (bad-words + konfigurierbare Extra-Wörter) ---
let filterSingleton: Filter | null = null;
function profanityFilter(): Filter {
  if (filterSingleton) return filterSingleton;
  const f = new Filter();
  const extra = getGameConfig().clan.profanity_extra_words ?? [];
  if (extra.length > 0) f.addWords(...extra);
  filterSingleton = f;
  return f;
}

function assertClean(value: string, label: string): void {
  if (profanityFilter().isProfane(value)) {
    throw badRequest(`${label} enthält unzulässige Wörter`);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/** Einheitlicher Query-Runner: Transaktions-Client falls vorhanden, sonst Pool. */
type Runner = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;
function runner(client?: PoolClient): Runner {
  if (!client) return query;
  return (text, params) => client.query(text, params as never[]);
}

/** Ein Clan inkl. member_count (Subquery). */
async function loadClan(clanId: string, client?: PoolClient): Promise<Clan | null> {
  const q = runner(client);
  const res = await q(
    `SELECT ${CLAN_COLUMNS},
            (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id)::int AS member_count
       FROM clans c WHERE c.id = $1`,
    [clanId],
  );
  const row = res.rows[0];
  return row ? mapClan(row as Record<string, unknown>) : null;
}

async function loadMembers(clanId: string): Promise<ClanMember[]> {
  const res = await query(
    `SELECT cm.player_id, p.username, p.faction, p.trophies, p.village_level, cm.role, cm.joined_at
       FROM clan_members cm JOIN players p ON p.id = cm.player_id
      WHERE cm.clan_id = $1
      ORDER BY CASE cm.role WHEN 'leader' THEN 0 WHEN 'co_leader' THEN 1 ELSE 2 END, cm.joined_at`,
    [clanId],
  );
  return res.rows.map((r) => ({
    player_id: r.player_id as string,
    username: r.username as string,
    faction: r.faction as FactionId,
    trophies: Number(r.trophies),
    village_level: Number(r.village_level),
    role: r.role as ClanMember['role'],
    joined_at: (r.joined_at as Date).toISOString(),
  }));
}

/** Vollansicht eines Clans (Stammdaten + Mitglieder + laufender Krieg). */
export async function getClanDetail(clanId: string): Promise<ClanDetailResponse> {
  const clan = await loadClan(clanId);
  if (!clan) throw notFound('Clan nicht gefunden');
  const [members, war] = await Promise.all([loadMembers(clanId), getActiveWarForClan(clanId)]);
  return { clan, members, war };
}

/** Clan-Liste/Suche (offene Clans zum Beitreten). */
export async function listClans(search?: string, limit = 50): Promise<ClanSummary[]> {
  const like = search && search.trim() ? `%${search.trim()}%` : null;
  const res = await query(
    `SELECT ${CLAN_COLUMNS},
            (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id)::int AS member_count
       FROM clans c
      WHERE $1::text IS NULL OR c.name ILIKE $1 OR c.tag ILIKE $1
      ORDER BY season_points DESC, member_count DESC, created_at ASC
      LIMIT $2`,
    [like, limit],
  );
  return res.rows.map((r) => {
    const clan = mapClan(r as Record<string, unknown>);
    return {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      banner: clan.banner,
      member_count: clan.member_count,
      season_points: clan.season_points,
      total_wins: clan.total_wins,
    };
  });
}

/** Lädt die clan-relevanten Spielerfelder mit Sperre. */
async function lockPlayerClanFields(
  client: PoolClient,
  playerId: string,
): Promise<{ village_level: number; clan_id: string | null }> {
  const res = await client.query(
    `SELECT village_level, clan_id FROM players WHERE id = $1 FOR UPDATE`,
    [playerId],
  );
  const row = res.rows[0] as { village_level: number; clan_id: string | null } | undefined;
  if (!row) throw notFound('Spieler nicht gefunden');
  return { village_level: Number(row.village_level), clan_id: row.clan_id };
}

function assertCanJoinByLevel(villageLevel: number): void {
  const min = getGameConfig().clan.unlock_town_hall_level;
  if (villageLevel < min) {
    throw badRequest(`Clans sind erst ab Rathaus-Level ${min} freigeschaltet (aktuell ${villageLevel})`);
  }
}

export interface ClanActionResult {
  clan: Clan | null;
  player: Player;
}

/** Mitgliedschaft (Clan + Rolle) eines Spielers oder null. */
export async function getMembership(
  playerId: string,
): Promise<{ clanId: string; role: ClanMember['role'] } | null> {
  const res = await query(
    `SELECT clan_id, role FROM clan_members WHERE player_id = $1 LIMIT 1`,
    [playerId],
  );
  const row = res.rows[0] as { clan_id: string; role: ClanMember['role'] } | undefined;
  return row ? { clanId: row.clan_id, role: row.role } : null;
}

/** Liefert die Clan-ID, wenn der Spieler Leader/Co-Leader ist — sonst Fehler. */
export async function requireLeadership(playerId: string): Promise<string> {
  const m = await getMembership(playerId);
  if (!m) throw badRequest('Du bist in keinem Clan');
  if (m.role !== 'leader' && m.role !== 'co_leader') {
    throw forbidden('Nur Leader oder Co-Leader dürfen das');
  }
  return m.clanId;
}

/** Erstellt einen Clan (Spieler wird Leader). Tag/Name werden gefiltert & sind unique. */
export async function createClan(
  playerId: string,
  input: { name: string; tag: string; banner: ClanBanner },
): Promise<ClanActionResult> {
  const config = getGameConfig();
  const bannerErr = validateBanner(config, input.banner);
  if (bannerErr) throw badRequest(bannerErr);
  assertClean(input.name, 'Clan-Name');
  assertClean(input.tag, 'Clan-Tag');
  const tag = input.tag.toUpperCase();

  return withTransaction(async (client) => {
    const { village_level, clan_id } = await lockPlayerClanFields(client, playerId);
    assertCanJoinByLevel(village_level);
    if (clan_id) throw conflict('Du bist bereits in einem Clan');

    let clanId: string;
    try {
      const ins = await client.query(
        `INSERT INTO clans (name, tag, banner, leader_id)
         VALUES ($1, $2, $3::jsonb, $4) RETURNING id`,
        [input.name, tag, JSON.stringify(input.banner), playerId],
      );
      clanId = (ins.rows[0] as { id: string }).id;
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Clan-Name oder Tag ist bereits vergeben');
      throw err;
    }

    await client.query(
      `INSERT INTO clan_members (clan_id, player_id, role) VALUES ($1, $2, 'leader')`,
      [clanId, playerId],
    );
    const upd = await client.query(
      `UPDATE players SET clan_id = $1 WHERE id = $2 RETURNING ${PLAYER_COLUMNS}`,
      [clanId, playerId],
    );
    const clan = await loadClan(clanId, client);
    return { clan, player: mapPlayer(upd.rows[0] as Record<string, unknown>) };
  });
}

/** Tritt einem bestehenden Clan bei (sofern Platz ist und TH-Level passt). */
export async function joinClan(playerId: string, clanId: string): Promise<ClanActionResult> {
  const config = getGameConfig();
  return withTransaction(async (client) => {
    const { village_level, clan_id } = await lockPlayerClanFields(client, playerId);
    assertCanJoinByLevel(village_level);
    if (clan_id) throw conflict('Du bist bereits in einem Clan');

    const cr = await client.query(
      `SELECT id, (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id)::int AS member_count
         FROM clans c WHERE c.id = $1 FOR UPDATE`,
      [clanId],
    );
    const crow = cr.rows[0] as { id: string; member_count: number } | undefined;
    if (!crow) throw notFound('Clan nicht gefunden');
    if (Number(crow.member_count) >= config.clan.max_members) {
      throw conflict(`Clan ist voll (max. ${config.clan.max_members} Mitglieder)`);
    }

    await client.query(
      `INSERT INTO clan_members (clan_id, player_id, role) VALUES ($1, $2, 'member')`,
      [clanId, playerId],
    );
    const upd = await client.query(
      `UPDATE players SET clan_id = $1 WHERE id = $2 RETURNING ${PLAYER_COLUMNS}`,
      [clanId, playerId],
    );
    const clan = await loadClan(clanId, client);
    return { clan, player: mapPlayer(upd.rows[0] as Record<string, unknown>) };
  });
}

/**
 * Verlässt den Clan. Verlässt der Leader, wird die Führung an das dienstälteste
 * Mitglied (bevorzugt co_leader) übergeben; war es das letzte Mitglied, wird der
 * Clan aufgelöst. Während eines laufenden Kriegs nicht möglich.
 */
export async function leaveClan(playerId: string): Promise<ClanActionResult> {
  return withTransaction(async (client) => {
    const { clan_id } = await lockPlayerClanFields(client, playerId);
    if (!clan_id) throw badRequest('Du bist in keinem Clan');

    const war = await client.query(
      `SELECT 1 FROM clan_wars
        WHERE status = 'in_progress' AND (clan_a_id = $1 OR clan_b_id = $1) LIMIT 1`,
      [clan_id],
    );
    if (war.rows.length > 0) {
      throw conflict('Während eines laufenden Clan-Kriegs kann der Clan nicht verlassen werden');
    }

    const meRes = await client.query(
      `SELECT role FROM clan_members WHERE clan_id = $1 AND player_id = $2`,
      [clan_id, playerId],
    );
    const me = meRes.rows[0] as { role: ClanMember['role'] } | undefined;
    if (!me) throw badRequest('Mitgliedschaft nicht gefunden');

    // Eigene Mitgliedschaft entfernen + clan_id lösen.
    await client.query(`DELETE FROM clan_members WHERE clan_id = $1 AND player_id = $2`, [
      clan_id,
      playerId,
    ]);
    const upd = await client.query(
      `UPDATE players SET clan_id = NULL WHERE id = $1 RETURNING ${PLAYER_COLUMNS}`,
      [playerId],
    );

    // Verbleibende Mitglieder?
    const rest = await client.query(
      `SELECT player_id, role FROM clan_members WHERE clan_id = $1
        ORDER BY CASE role WHEN 'co_leader' THEN 0 ELSE 1 END, joined_at LIMIT 1`,
      [clan_id],
    );
    const successor = rest.rows[0] as { player_id: string } | undefined;

    if (!successor) {
      // Letztes Mitglied → Clan auflösen (clan_members/leaderboard_clan cascaden).
      // Etwaigen Kriegs-Queue-Eintrag entfernen, damit kein späteres Pairing auf den
      // gelöschten Clan verweist (FK-Fehler + stiller Krieg-Verlust des Partners).
      cancelWarRequest(clan_id);
      await client.query(`DELETE FROM clans WHERE id = $1`, [clan_id]);
      return { clan: null, player: mapPlayer(upd.rows[0] as Record<string, unknown>) };
    }

    if (me.role === 'leader') {
      await client.query(`UPDATE clan_members SET role = 'leader' WHERE clan_id = $1 AND player_id = $2`, [
        clan_id,
        successor.player_id,
      ]);
      await client.query(`UPDATE clans SET leader_id = $1 WHERE id = $2`, [successor.player_id, clan_id]);
    }
    return { clan: null, player: mapPlayer(upd.rows[0] as Record<string, unknown>) };
  });
}

/**
 * Befördert/degradiert ein Mitglied (Rollen-Verwaltung, Phase 4):
 *  - promote: member → co_leader (durch Leader ODER Co-Leader); co_leader → leader
 *    = **Führungsübergabe** (nur durch den aktuellen Leader; dieser wird Co-Leader).
 *  - demote: co_leader → member (**nur** durch den Leader).
 * Liefert die aktualisierte Clan-Vollansicht.
 */
export async function changeMemberRole(
  actorId: string,
  targetId: string,
  action: 'promote' | 'demote',
): Promise<ClanDetailResponse> {
  if (actorId === targetId) throw badRequest('Du kannst deine eigene Rolle nicht ändern');

  const clanId = await withTransaction(async (client) => {
    const actorRes = await client.query(
      `SELECT clan_id, role FROM clan_members WHERE player_id = $1`,
      [actorId],
    );
    const actor = actorRes.rows[0] as { clan_id: string; role: ClanMember['role'] } | undefined;
    if (!actor) throw badRequest('Du bist in keinem Clan');

    const tgtRes = await client.query(
      `SELECT role FROM clan_members WHERE clan_id = $1 AND player_id = $2 FOR UPDATE`,
      [actor.clan_id, targetId],
    );
    const target = tgtRes.rows[0] as { role: ClanMember['role'] } | undefined;
    if (!target) throw notFound('Mitglied nicht im Clan gefunden');

    if (action === 'promote') {
      if (target.role === 'member') {
        if (actor.role !== 'leader' && actor.role !== 'co_leader') {
          throw forbidden('Nur Leader oder Co-Leader dürfen befördern');
        }
        await client.query(
          `UPDATE clan_members SET role = 'co_leader' WHERE clan_id = $1 AND player_id = $2`,
          [actor.clan_id, targetId],
        );
      } else if (target.role === 'co_leader') {
        // Führungsübergabe — nur der amtierende Leader.
        if (actor.role !== 'leader') {
          throw forbidden('Nur der Leader kann die Führung übergeben');
        }
        await client.query(
          `UPDATE clan_members SET role = 'leader' WHERE clan_id = $1 AND player_id = $2`,
          [actor.clan_id, targetId],
        );
        await client.query(
          `UPDATE clan_members SET role = 'co_leader' WHERE clan_id = $1 AND player_id = $2`,
          [actor.clan_id, actorId],
        );
        await client.query(`UPDATE clans SET leader_id = $1 WHERE id = $2`, [targetId, actor.clan_id]);
      } else {
        throw badRequest('Spieler ist bereits Leader');
      }
    } else {
      // demote — ausschließlich der Leader.
      if (actor.role !== 'leader') throw forbidden('Nur der Leader darf degradieren');
      if (target.role === 'leader') throw badRequest('Der Leader kann nicht degradiert werden');
      if (target.role === 'member') throw badRequest('Mitglied hat bereits die niedrigste Rolle');
      await client.query(
        `UPDATE clan_members SET role = 'member' WHERE clan_id = $1 AND player_id = $2`,
        [actor.clan_id, targetId],
      );
    }
    return actor.clan_id;
  });

  return getClanDetail(clanId);
}

// --- Clan-Burg (Housing Space) ---

/** Höchste Stufe der Clan-Burg eines Spielers (0 = keine/​im Bau). */
async function castleLevel(playerId: string, client?: PoolClient): Promise<number> {
  const q = runner(client);
  const res = await q(
    `SELECT COALESCE(MAX(level), 0)::int AS lvl FROM buildings
       WHERE player_id = $1 AND building_type = 'clan_castle'`,
    [playerId],
  );
  return Number((res.rows[0] as { lvl: number }).lvl);
}

async function loadCastle(playerId: string, client?: PoolClient): Promise<CastleResponse> {
  const config = getGameConfig();
  const q = runner(client);
  const lvl = await castleLevel(playerId, client);
  const dres = await q(
    `SELECT id, player_id, unit_type, quantity, donated_by
       FROM clan_castle_defenders WHERE player_id = $1 ORDER BY unit_type`,
    [playerId],
  );
  const defenders = dres.rows.map((r) => mapCastleDefender(r as Record<string, unknown>));
  return {
    castle_level: lvl,
    housing_capacity: clanCastleHousing(config, lvl),
    housing_used: defendersHousingUsed(config, defenders),
    defenders,
  };
}

/** Liest die eigene Clan-Burg (Stationierte Einheiten + Housing-Auslastung). */
export async function getCastle(playerId: string): Promise<CastleResponse> {
  return loadCastle(playerId);
}

/**
 * Stationiert Einheiten aus der eigenen Armee in einer Clan-Burg (Housing Space).
 * Standardziel = eigene Burg; optional die Burg eines Clan-Kameraden (donate).
 */
export async function donateToCastle(
  donorId: string,
  input: { unit_type: string; quantity: number; target_player_id?: string },
): Promise<CastleResponse> {
  const config = getGameConfig();
  const targetId = input.target_player_id ?? donorId;
  const housingPerUnit = unitHousing(config, input.unit_type);
  if (housingPerUnit <= 0) throw badRequest(`Unbekannte Einheit: ${input.unit_type}`);

  return withTransaction(async (client) => {
    // Donor & Ziel müssen (bei Fremd-Donation) im selben Clan sein.
    if (targetId !== donorId) {
      const rel = await client.query(
        `SELECT (SELECT clan_id FROM players WHERE id = $1) AS donor_clan,
                (SELECT clan_id FROM players WHERE id = $2) AS target_clan`,
        [donorId, targetId],
      );
      const r = rel.rows[0] as { donor_clan: string | null; target_clan: string | null };
      if (!r.donor_clan || r.donor_clan !== r.target_clan) {
        throw forbidden('Nur an Mitglieder des eigenen Clans möglich');
      }
    } else {
      const own = await client.query(`SELECT clan_id FROM players WHERE id = $1`, [donorId]);
      if (!(own.rows[0] as { clan_id: string | null } | undefined)?.clan_id) {
        throw badRequest('Du bist in keinem Clan');
      }
    }

    // Housing-Cap der Ziel-Burg prüfen.
    const lvl = await castleLevel(targetId, client);
    const capacity = clanCastleHousing(config, lvl);
    if (capacity <= 0) throw badRequest('Ziel hat keine (fertige) Clan-Burg');

    const cur = await client.query(
      `SELECT unit_type, quantity FROM clan_castle_defenders WHERE player_id = $1`,
      [targetId],
    );
    const used = defendersHousingUsed(
      config,
      cur.rows.map((r) => ({ unit_type: r.unit_type as string, quantity: Number(r.quantity) })),
    );
    const adding = housingPerUnit * input.quantity;
    if (used + adding > capacity) {
      throw badRequest(
        `Nicht genug Stellplätze (frei: ${capacity - used}, benötigt: ${adding})`,
      );
    }

    // Einheiten aus der Donor-Armee abziehen (fällige Trainings zuvor verrechnen).
    await settleTrainingTx(client, donorId);
    const arm = await client.query(
      `SELECT quantity FROM units WHERE player_id = $1 AND unit_type = $2 FOR UPDATE`,
      [donorId, input.unit_type],
    );
    const have = arm.rows[0] ? Number((arm.rows[0] as { quantity: number }).quantity) : 0;
    if (have < input.quantity) {
      throw badRequest(`Nicht genug Einheiten in der Armee (verfügbar: ${have})`);
    }
    const left = have - input.quantity;
    if (left <= 0) {
      await client.query(`DELETE FROM units WHERE player_id = $1 AND unit_type = $2`, [
        donorId,
        input.unit_type,
      ]);
    } else {
      await client.query(`UPDATE units SET quantity = $1 WHERE player_id = $2 AND unit_type = $3`, [
        left,
        donorId,
        input.unit_type,
      ]);
    }

    // In die Ziel-Burg aufaddieren (UPSERT auf (player_id, unit_type)).
    await client.query(
      `INSERT INTO clan_castle_defenders (player_id, unit_type, quantity, donated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, unit_type)
       DO UPDATE SET quantity = clan_castle_defenders.quantity + EXCLUDED.quantity,
                     donated_by = EXCLUDED.donated_by`,
      [targetId, input.unit_type, input.quantity, donorId],
    );

    return loadCastle(targetId, client);
  });
}
