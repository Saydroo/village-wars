import type { PoolClient } from 'pg';
import type {
  SeasonPassActionResponse,
  SeasonPassResponse,
  SeasonPassTierView,
  SeasonPassTrack,
} from '@village-wars/shared';
import {
  seasonPassTiers,
  maxSeasonPassTier,
  currentSeasonPassTier,
  nextSeasonPassTierXp,
  seasonPassTierDef,
  resourceCap,
  type OwnedBuilding,
  type SeasonPassXpAction,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Season-/Battle-Pass (Roadmap P7). Spieler sammeln Pass-XP durchs Spielen
 * (PvP-Sieg, Dungeon-Sieg, Quest abholen → addSeasonPassXp, fire-and-forget).
 * Jede Stufe hat eine Gratis- und eine Premium-Belohnung; Premium ist mit GEMS
 * freischaltbar (verdienbar = fair). Belohnungen werden manuell abgeholt; ein
 * Claim ist pro (Saison, Stufe, Track) einmalig. An die seasons-Tabelle gekoppelt:
 * neue Saison = neuer Pass (neue Zeilen). Alle Zahlen aus config.season_pass.
 */

/** Aktive Saisonnummer (Fallback 1, falls — unerwartet — keine aktive Saison existiert). */
async function getActiveSeasonNumber(client?: PoolClient): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT season_number FROM seasons WHERE is_active = TRUE ORDER BY season_number DESC LIMIT 1`,
  );
  const row = res.rows[0] as { season_number: number } | undefined;
  return row ? Number(row.season_number) : 1;
}

interface ProgressRow {
  xp: number;
  premium_unlocked: boolean;
}

async function loadProgress(
  playerId: string,
  season: number,
  client?: PoolClient,
): Promise<ProgressRow> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT xp, premium_unlocked FROM season_pass_progress WHERE player_id = $1 AND season_number = $2`,
    [playerId, season],
  );
  const row = res.rows[0] as { xp: number; premium_unlocked: boolean } | undefined;
  return {
    xp: row ? Number(row.xp) : 0,
    premium_unlocked: row ? Boolean(row.premium_unlocked) : false,
  };
}

/** Menge der bereits abgeholten Stufen als Set "tier:track". */
async function loadClaims(
  playerId: string,
  season: number,
  client?: PoolClient,
): Promise<Set<string>> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT tier, track FROM season_pass_claims WHERE player_id = $1 AND season_number = $2`,
    [playerId, season],
  );
  const set = new Set<string>();
  for (const r of res.rows as Array<{ tier: number; track: string }>) {
    set.add(`${Number(r.tier)}:${r.track}`);
  }
  return set;
}

/** Baut die Pass-Antwort aus Fortschritt + Claims. */
function buildResponse(
  season: number,
  progress: ProgressRow,
  claims: Set<string>,
): SeasonPassResponse {
  const config = getGameConfig();
  const tiers: SeasonPassTierView[] = seasonPassTiers(config).map((t) => ({
    tier: t.tier,
    xp_required: t.xp_required,
    free: t.free,
    premium: t.premium,
    reached: progress.xp >= t.xp_required,
    free_claimed: claims.has(`${t.tier}:free`),
    premium_claimed: claims.has(`${t.tier}:premium`),
  }));

  return {
    season_number: season,
    xp: progress.xp,
    current_tier: currentSeasonPassTier(config, progress.xp),
    max_tier: maxSeasonPassTier(config),
    premium_unlocked: progress.premium_unlocked,
    premium_cost_gems: config.season_pass.premium_cost_gems,
    next_tier_xp: nextSeasonPassTierXp(config, progress.xp),
    tiers,
  };
}

/** Aktuellen Pass-Status eines Spielers laden. */
export async function getSeasonPassStatus(playerId: string): Promise<SeasonPassResponse> {
  const season = await getActiveSeasonNumber();
  const [progress, claims] = await Promise.all([
    loadProgress(playerId, season),
    loadClaims(playerId, season),
  ]);
  return buildResponse(season, progress, claims);
}

/**
 * Pass-XP gutschreiben (fire-and-forget aus battle/dungeon/quest-Service).
 * Betrag kommt aus config.season_pass.xp_per_action[action].
 */
export async function addSeasonPassXp(playerId: string, action: SeasonPassXpAction): Promise<void> {
  const config = getGameConfig();
  const amount = config.season_pass?.xp_per_action?.[action] ?? 0;
  if (amount <= 0) return;
  const season = await getActiveSeasonNumber();
  await query(
    `INSERT INTO season_pass_progress (player_id, season_number, xp)
       VALUES ($1, $2, $3)
     ON CONFLICT (player_id, season_number)
       DO UPDATE SET xp = season_pass_progress.xp + EXCLUDED.xp`,
    [playerId, season, amount],
  );
}

/** Premium-Track mit Gems freischalten (einmal je Saison). */
export async function unlockPremium(playerId: string): Promise<SeasonPassActionResponse> {
  const config = getGameConfig();
  const cost = config.season_pass.premium_cost_gems;

  const result = await withTransaction(async (client) => {
    const season = await getActiveSeasonNumber(client);

    // Fortschrittszeile sperren bzw. anlegen.
    await client.query(
      `INSERT INTO season_pass_progress (player_id, season_number) VALUES ($1, $2)
         ON CONFLICT (player_id, season_number) DO NOTHING`,
      [playerId, season],
    );
    const locked = await client.query(
      `SELECT xp, premium_unlocked FROM season_pass_progress
         WHERE player_id = $1 AND season_number = $2 FOR UPDATE`,
      [playerId, season],
    );
    const row = locked.rows[0] as { xp: number; premium_unlocked: boolean };
    if (row.premium_unlocked) throw badRequest('Premium-Pass ist bereits freigeschaltet');

    const pr = await client.query(`SELECT gems FROM players WHERE id = $1 FOR UPDATE`, [playerId]);
    if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');
    const gems = Number((pr.rows[0] as { gems: number }).gems);
    if (gems < cost) {
      throw badRequest(`Nicht genug Edelsteine (benötigt: ${cost}, vorhanden: ${gems})`);
    }

    await client.query(`UPDATE players SET gems = gems - $1 WHERE id = $2`, [cost, playerId]);
    await client.query(
      `UPDATE season_pass_progress SET premium_unlocked = TRUE
         WHERE player_id = $1 AND season_number = $2`,
      [playerId, season],
    );
    return { season };
  });

  return statusWithPlayer(playerId, result.season);
}

/** Eine Stufe einsammeln (free oder premium). */
export async function claimTier(
  playerId: string,
  tier: number,
  track: SeasonPassTrack,
): Promise<SeasonPassActionResponse> {
  const config = getGameConfig();
  const def = seasonPassTierDef(config, tier);
  if (!def) throw badRequest(`Unbekannte Pass-Stufe ${tier}`);

  const result = await withTransaction(async (client) => {
    const season = await getActiveSeasonNumber(client);

    // Fortschritt sperren/anlegen.
    await client.query(
      `INSERT INTO season_pass_progress (player_id, season_number) VALUES ($1, $2)
         ON CONFLICT (player_id, season_number) DO NOTHING`,
      [playerId, season],
    );
    const locked = await client.query(
      `SELECT xp, premium_unlocked FROM season_pass_progress
         WHERE player_id = $1 AND season_number = $2 FOR UPDATE`,
      [playerId, season],
    );
    const prog = locked.rows[0] as { xp: number; premium_unlocked: boolean };

    if (Number(prog.xp) < def.xp_required) {
      throw badRequest(`Stufe ${tier} noch nicht erreicht`);
    }
    if (track === 'premium' && !prog.premium_unlocked) {
      throw badRequest('Premium-Pass nicht freigeschaltet');
    }

    // Doppel-Claim verhindern (eindeutig pro Stufe+Track).
    const claimIns = await client.query(
      `INSERT INTO season_pass_claims (player_id, season_number, tier, track)
         VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, season_number, tier, track) DO NOTHING`,
      [playerId, season, tier, track],
    );
    if (claimIns.rowCount === 0) throw badRequest('Diese Belohnung wurde bereits abgeholt');

    // Belohnung gutschreiben (Ressourcen auf Lager-Cap gekappt; Gems/Goldbarren ungekappt).
    const reward = track === 'free' ? def.free : def.premium;
    const ar = await client.query(
      `SELECT building_type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings: OwnedBuilding[] = ar.rows.map((b) => ({
      building_type: b.building_type as string,
      level: Number(b.level),
    }));
    const capWood = resourceCap(config, buildings, 'wood');
    const capStone = resourceCap(config, buildings, 'stone');
    const capGold = resourceCap(config, buildings, 'gold');

    await client.query(
      `UPDATE players
          SET wood = LEAST(wood + $1, $2),
              stone = LEAST(stone + $3, $4),
              gold = LEAST(gold + $5, $6),
              gems = gems + $7,
              gold_bars = gold_bars + $8
        WHERE id = $9`,
      [
        reward.wood ?? 0,
        capWood,
        reward.stone ?? 0,
        capStone,
        reward.gold ?? 0,
        capGold,
        reward.gems ?? 0,
        reward.gold_bars ?? 0,
        playerId,
      ],
    );
    return { season };
  });

  return statusWithPlayer(playerId, result.season);
}

/** Lädt aktualisierten Spieler + Pass-Status nach einer Transaktion. */
async function statusWithPlayer(playerId: string, season: number): Promise<SeasonPassActionResponse> {
  const pr = await query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [playerId]);
  if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');
  const [progress, claims] = await Promise.all([
    loadProgress(playerId, season),
    loadClaims(playerId, season),
  ]);
  return {
    player: mapPlayer(pr.rows[0] as Record<string, unknown>),
    status: buildResponse(season, progress, claims),
  };
}
