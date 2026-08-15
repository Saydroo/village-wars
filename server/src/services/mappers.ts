import type {
  Player,
  Village,
  Building,
  Unit,
  UnitTrainingItem,
  Battle,
  Clan,
  ClanBanner,
  ClanCastleDefender,
  ClanWar,
  DungeonRun,
  Skin,
} from '@village-wars/shared';

/**
 * pg liefert BIGINT (int8) als String zurück, um Präzisionsverlust zu vermeiden;
 * für unsere Wertebereiche (< 2^53) ist Number() sicher. TIMESTAMPTZ kommt als
 * Date-Objekt — wir normalisieren auf ISO-Strings für die API.
 */

function toNum(v: unknown): number {
  return typeof v === 'number' ? v : Number(v);
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

export function mapPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    username: row.username as string,
    email: (row.email as string | null) ?? null,
    auth_provider: row.auth_provider as Player['auth_provider'],
    auth_provider_id: (row.auth_provider_id as string | null) ?? null,
    faction: row.faction as Player['faction'],
    village_level: toNum(row.village_level),
    trophies: toNum(row.trophies),
    gold_bars: toNum(row.gold_bars),
    wood: toNum(row.wood),
    stone: toNum(row.stone),
    gold: toNum(row.gold),
    gems: toNum(row.gems),
    clan_id: (row.clan_id as string | null) ?? null,
    last_active: toIso(row.last_active),
    created_at: toIso(row.created_at),
  };
}

export function mapVillage(row: Record<string, unknown>): Village {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    grid_width: toNum(row.grid_width),
    grid_height: toNum(row.grid_height),
    layout: (row.layout as Village['layout']) ?? [],
    updated_at: toIso(row.updated_at),
  };
}

export function mapBuilding(row: Record<string, unknown>): Building {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    building_type: row.building_type as string,
    level: toNum(row.level),
    grid_x: toNum(row.grid_x),
    grid_y: toNum(row.grid_y),
    upgrade_started_at: toIsoOrNull(row.upgrade_started_at),
    upgrade_finish_at: toIsoOrNull(row.upgrade_finish_at),
    is_upgrading: Boolean(row.is_upgrading),
    created_at: toIso(row.created_at),
  };
}

export function mapUnit(row: Record<string, unknown>): Unit {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    unit_type: row.unit_type as string,
    level: toNum(row.level),
    quantity: toNum(row.quantity),
    training_finish_at: toIsoOrNull(row.training_finish_at),
  };
}

export function mapTrainingItem(row: Record<string, unknown>): UnitTrainingItem {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    unit_type: row.unit_type as string,
    quantity: toNum(row.quantity),
    started_at: toIso(row.started_at),
    finish_at: toIso(row.finish_at),
  };
}

export function mapBattle(row: Record<string, unknown>): Battle {
  return {
    id: row.id as string,
    attacker_id: row.attacker_id as string,
    defender_id: (row.defender_id as string | null) ?? null,
    mode: row.mode as Battle['mode'],
    result: (row.result as Battle['result']) ?? null,
    attacker_destruction_pct: toNum(row.attacker_destruction_pct),
    defender_destruction_pct: toNum(row.defender_destruction_pct),
    loot_wood: toNum(row.loot_wood),
    loot_stone: toNum(row.loot_stone),
    trophies_change: toNum(row.trophies_change),
    duration_seconds: row.duration_seconds === null ? null : toNum(row.duration_seconds),
    started_at: toIso(row.started_at),
    finished_at: toIsoOrNull(row.finished_at),
  };
}

/** Spalten-Liste für SELECTs auf players (ohne password_hash). */
export const PLAYER_COLUMNS = `id, username, email, auth_provider, auth_provider_id,
  faction, village_level, trophies, gold_bars, wood, stone, gold, gems, clan_id,
  last_active, created_at`;

/** Spalten-Liste für SELECTs auf buildings. */
export const BUILDING_COLUMNS = `id, player_id, building_type, level, grid_x, grid_y,
  upgrade_started_at, upgrade_finish_at, is_upgrading, created_at`;

/** Spalten-Liste für SELECTs auf units. */
export const UNIT_COLUMNS = `id, player_id, unit_type, level, quantity, training_finish_at`;

/** Spalten-Liste für SELECTs auf battles. */
export const BATTLE_COLUMNS = `id, attacker_id, defender_id, mode, result,
  attacker_destruction_pct, defender_destruction_pct, loot_wood, loot_stone,
  trophies_change, duration_seconds, started_at, finished_at`;

// --- Clans (Phase 4) ---

/** JSONB-Banner kommt aus pg bereits als Objekt; defensiv normalisieren. */
function asBanner(v: unknown): ClanBanner {
  const b = (typeof v === 'string' ? JSON.parse(v) : v) as Partial<ClanBanner> | null;
  return {
    shape: (b?.shape as string) ?? 'shield',
    primary_color: (b?.primary_color as string) ?? '#2c3e50',
    secondary_color: (b?.secondary_color as string) ?? '#f0c040',
    symbol: (b?.symbol as string) ?? 'sword',
    symbol_color: (b?.symbol_color as string) ?? '#ecf0f1',
  };
}

export function mapClan(row: Record<string, unknown>): Clan {
  return {
    id: row.id as string,
    name: row.name as string,
    tag: row.tag as string,
    banner: asBanner(row.banner),
    leader_id: (row.leader_id as string | null) ?? null,
    season_points: toNum(row.season_points),
    total_wins: toNum(row.total_wins),
    member_count: row.member_count === undefined ? 0 : toNum(row.member_count),
    created_at: toIso(row.created_at),
  };
}

export function mapClanWar(row: Record<string, unknown>): ClanWar {
  return {
    id: row.id as string,
    clan_a_id: row.clan_a_id as string,
    clan_b_id: row.clan_b_id as string,
    clan_a_points: toNum(row.clan_a_points),
    clan_b_points: toNum(row.clan_b_points),
    winner_clan_id: (row.winner_clan_id as string | null) ?? null,
    status: row.status as ClanWar['status'],
    season_number: row.season_number === null || row.season_number === undefined ? null : toNum(row.season_number),
    started_at: toIso(row.started_at),
    ends_at: toIsoOrNull(row.ends_at),
    finished_at: toIsoOrNull(row.finished_at),
  };
}

export function mapCastleDefender(row: Record<string, unknown>): ClanCastleDefender {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    unit_type: row.unit_type as string,
    quantity: toNum(row.quantity),
    donated_by: (row.donated_by as string | null) ?? null,
  };
}

// --- Dungeon & Skins (Phase 5) ---

function jsonbToMap(v: unknown): Record<string, number> {
  const obj = (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown> | null;
  const out: Record<string, number> = {};
  if (obj && typeof obj === 'object') {
    for (const [k, val] of Object.entries(obj)) out[k] = Number(val);
  }
  return out;
}

export function mapDungeonRun(row: Record<string, unknown>): DungeonRun {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    season_week: typeof row.season_week === 'string' ? row.season_week : toIso(row.season_week).slice(0, 10),
    difficulty: (row.difficulty as string) ?? 'normal',
    waves_completed: toNum(row.waves_completed),
    boss_defeated: Boolean(row.boss_defeated),
    gold_earned: toNum(row.gold_earned),
    gems_earned: toNum(row.gems_earned),
    status: row.status as DungeonRun['status'],
    started_at: toIso(row.started_at),
    finished_at: toIsoOrNull(row.finished_at),
  };
}

/** Liest army_remaining/army_snapshot (JSONB) als unit_type -> Anzahl. */
export function mapArmyJson(v: unknown): Record<string, number> {
  return jsonbToMap(v);
}

export function mapSkin(row: Record<string, unknown>): Skin {
  return {
    id: row.id as string,
    name: row.name as string,
    target_type: row.target_type as Skin['target_type'],
    target_id: row.target_id as string,
    rarity: row.rarity as Skin['rarity'],
    price_bars: toNum(row.price_bars),
    preview_data:
      row.preview_data === null || row.preview_data === undefined
        ? null
        : ((typeof row.preview_data === 'string'
            ? JSON.parse(row.preview_data)
            : row.preview_data) as Record<string, unknown>),
  };
}

export const DUNGEON_RUN_COLUMNS = `id, player_id, season_week, difficulty, waves_completed, boss_defeated,
  gold_earned, gems_earned, status, started_at, finished_at`;

/** Spalten-Liste für SELECTs auf clans (member_count separat per JOIN/Subquery). */
export const CLAN_COLUMNS = `id, name, tag, banner, leader_id, season_points, total_wins, created_at`;

/** Spalten-Liste für SELECTs auf clan_wars. */
export const CLAN_WAR_COLUMNS = `id, clan_a_id, clan_b_id, clan_a_points, clan_b_points,
  winner_clan_id, status, season_number, started_at, ends_at, finished_at`;
