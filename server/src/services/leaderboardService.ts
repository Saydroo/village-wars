import type {
  ClanBanner,
  FactionId,
  LeaderboardClanEntry,
  LeaderboardClanResponse,
  LeaderboardSoloEntry,
  LeaderboardSoloResponse,
} from '@village-wars/shared';
import { query } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { getActiveSeasonNumber } from './clanWarService';

/**
 * Ranglisten (Phase 4, Abschnitt 11). Solo = individuelle Trophäen, dauerhaft
 * kumuliert (live aus players). Clan = saisonbasierte Saison-Punkte (live aus
 * clans für die aktive Saison, sonst Snapshot aus leaderboard_clan). Beide
 * paginiert; die eigene Position wird zusätzlich aufgelöst. Seitengrößen kommen
 * aus game-config.json (leaderboard.*).
 */

interface Paging {
  page: number;
  limit: number;
  offset: number;
}

function resolvePaging(page?: number, limit?: number): Paging {
  const cfg = getGameConfig().leaderboard;
  const p = Math.max(1, Math.floor(page ?? 1));
  const l = Math.min(cfg.max_page_size, Math.max(1, Math.floor(limit ?? cfg.default_page_size)));
  return { page: p, limit: l, offset: (p - 1) * l };
}

// --- Solo ---

export async function getSoloLeaderboard(
  playerId: string,
  page?: number,
  limit?: number,
): Promise<LeaderboardSoloResponse> {
  const { page: p, limit: l, offset } = resolvePaging(page, limit);

  // RANK nur über Trophäen → Spieler mit gleichem Stand teilen sich den Rang.
  // created_at/id sind nur stabile Anzeige-Sortierung (deterministische Paginierung).
  const pageRes = await query(
    `WITH ranked AS (
        SELECT id AS player_id, username, faction, trophies, created_at,
               RANK() OVER (ORDER BY trophies DESC) AS rank
          FROM players
      )
      SELECT player_id, username, faction, trophies, rank
        FROM ranked ORDER BY rank, created_at ASC, player_id LIMIT $1 OFFSET $2`,
    [l, offset],
  );
  const entries: LeaderboardSoloEntry[] = pageRes.rows.map((r) => ({
    rank: Number(r.rank),
    player_id: r.player_id as string,
    username: r.username as string,
    faction: r.faction as FactionId,
    trophies: Number(r.trophies),
  }));

  const meRes = await query(
    `WITH ranked AS (
        SELECT id AS player_id, username, faction, trophies,
               RANK() OVER (ORDER BY trophies DESC) AS rank
          FROM players
      )
      SELECT player_id, username, faction, trophies, rank FROM ranked WHERE player_id = $1`,
    [playerId],
  );
  const me: LeaderboardSoloEntry | null = meRes.rows[0]
    ? {
        rank: Number(meRes.rows[0].rank),
        player_id: meRes.rows[0].player_id as string,
        username: meRes.rows[0].username as string,
        faction: meRes.rows[0].faction as FactionId,
        trophies: Number(meRes.rows[0].trophies),
      }
    : null;

  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM players`);
  const total = Number((totalRes.rows[0] as { n: number }).n);

  return { entries, page: p, page_size: l, total, me };
}

// --- Clan (saisonbasiert) ---

function mapClanEntry(r: Record<string, unknown>): LeaderboardClanEntry {
  return {
    rank: Number(r.rank),
    clan_id: r.clan_id as string,
    name: r.name as string,
    tag: r.tag as string,
    banner: (typeof r.banner === 'string' ? JSON.parse(r.banner) : r.banner) as ClanBanner,
    season_points: Number(r.season_points),
    member_count: r.member_count === undefined ? 0 : Number(r.member_count),
  };
}

export async function getClanLeaderboard(
  myClanId: string | null,
  season?: number | 'current',
  page?: number,
  limit?: number,
): Promise<LeaderboardClanResponse> {
  const { page: p, limit: l, offset } = resolvePaging(page, limit);
  const activeSeason = await getActiveSeasonNumber();
  const parsed = season === undefined || season === 'current' ? activeSeason : Number(season);
  // Ganzzahl erzwingen (verhindert NaN in der interpolierten Saison-Bedingung).
  const seasonNumber = Number.isFinite(parsed) ? Math.floor(parsed) : activeSeason;

  // Aktive Saison → live aus clans; vergangene Saison → Snapshot leaderboard_clan.
  const live = seasonNumber === activeSeason;

  // RANK nur über season_points → Clans mit gleichem Stand teilen sich den Rang;
  // total_wins/created_at sind nur stabile Anzeige-Sortierung.
  const baseCte = live
    ? `SELECT c.id AS clan_id, c.name, c.tag, c.banner, c.season_points, c.total_wins, c.created_at,
              (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id)::int AS member_count,
              RANK() OVER (ORDER BY c.season_points DESC) AS rank
         FROM clans c`
    : `SELECT c.id AS clan_id, c.name, c.tag, c.banner, lc.season_points, c.total_wins, c.created_at,
              (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id)::int AS member_count,
              RANK() OVER (ORDER BY lc.season_points DESC) AS rank
         FROM leaderboard_clan lc JOIN clans c ON c.id = lc.clan_id
        WHERE lc.season_number = ${seasonNumber}`;

  const pageRes = await query(
    `WITH ranked AS (${baseCte})
      SELECT * FROM ranked ORDER BY rank, total_wins DESC, created_at ASC, clan_id LIMIT $1 OFFSET $2`,
    [l, offset],
  );
  const entries = pageRes.rows.map((r) => mapClanEntry(r as Record<string, unknown>));

  let me: LeaderboardClanEntry | null = null;
  if (myClanId) {
    const meRes = await query(
      `WITH ranked AS (${baseCte}) SELECT * FROM ranked WHERE clan_id = $1`,
      [myClanId],
    );
    me = meRes.rows[0] ? mapClanEntry(meRes.rows[0] as Record<string, unknown>) : null;
  }

  const totalRes = live
    ? await query(`SELECT COUNT(*)::int AS n FROM clans`)
    : await query(`SELECT COUNT(*)::int AS n FROM leaderboard_clan WHERE season_number = $1`, [
        seasonNumber,
      ]);
  const total = Number((totalRes.rows[0] as { n: number }).n);

  return { entries, page: p, page_size: l, total, season_number: seasonNumber, me };
}
