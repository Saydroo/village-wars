import type {
  CommonUnitConfig,
  ExclusiveUnitConfig,
  FactionId,
  GameConfig,
} from '../types/gameConfig';
import { mod } from './factions';
import { researchHpMultiplier, researchDpsMultiplier } from './research';

/**
 * Reine Einheiten-Berechnungen (Phase 3): Definitionen finden, Trainingskosten/
 * -zeit und Kampfwerte mit Fraktions-Modifikatoren. Alle Zahlen stammen aus der
 * GameConfig (units_common, factions_exclusive_content, factions, combat).
 */

/** Normalisierte Einheiten-Definition (gemeinsam ODER fraktionsexklusiv). */
export interface UnitDefinition {
  id: string;
  display_name: string;
  unlock_town_hall_level: number;
  role: string;
  housing_space: number;
  hp: number;
  damage_per_second: number;
  heal_per_second: number;
  range_tiles: number | null;
  splash_damage: boolean;
  speed: string;
  cost: { wood: number; stone: number; gold: number };
  train_time_seconds: number;
  exclusive: boolean;
}

function normalizeCommon(id: string, u: CommonUnitConfig): UnitDefinition {
  return {
    id,
    display_name: u.display_name,
    unlock_town_hall_level: u.unlock_town_hall_level,
    role: u.role,
    housing_space: u.housing_space,
    hp: u.hp,
    damage_per_second: u.damage_per_second ?? 0,
    heal_per_second: u.heal_per_second ?? 0,
    range_tiles: typeof u.range_tiles === 'number' ? u.range_tiles : null,
    splash_damage: Boolean(u.splash_damage),
    speed: u.speed,
    cost: { wood: u.cost.wood ?? 0, stone: u.cost.stone ?? 0, gold: u.cost.gold ?? 0 },
    train_time_seconds: u.train_time_seconds,
    exclusive: false,
  };
}

function normalizeExclusive(u: ExclusiveUnitConfig): UnitDefinition {
  return {
    id: u.id,
    display_name: u.display_name,
    unlock_town_hall_level: u.unlock_town_hall_level,
    role: u.role,
    housing_space: u.housing_space,
    hp: u.hp,
    damage_per_second: u.damage_per_second ?? 0,
    heal_per_second: 0,
    range_tiles: typeof u.range_tiles === 'number' ? u.range_tiles : null,
    splash_damage: Boolean(u.splash_damage),
    speed: u.speed,
    cost: { wood: u.cost.wood ?? 0, stone: u.cost.stone ?? 0, gold: u.cost.gold ?? 0 },
    train_time_seconds: u.train_time_seconds,
    exclusive: true,
  };
}

/** Sucht eine Einheit in den gemeinsamen ODER fraktionsexklusiven Definitionen. */
export function findUnitDefinition(
  config: GameConfig,
  unitType: string,
  faction: FactionId,
): UnitDefinition | null {
  const common = config.units_common[unitType];
  if (common && typeof common === 'object') {
    return normalizeCommon(unitType, common as CommonUnitConfig);
  }
  const ex = config.factions_exclusive_content[faction]?.exclusive_units.find(
    (u) => u.id === unitType,
  );
  return ex ? normalizeExclusive(ex) : null;
}

/** Alle für eine Fraktion rekrutierbaren Einheiten (gemeinsam + exklusiv). */
export function unitsForFaction(config: GameConfig, faction: FactionId): UnitDefinition[] {
  const out: UnitDefinition[] = [];
  for (const [id, def] of Object.entries(config.units_common)) {
    if (id === 'description' || typeof def !== 'object') continue;
    out.push(normalizeCommon(id, def as CommonUnitConfig));
  }
  for (const u of config.factions_exclusive_content[faction]?.exclusive_units ?? []) {
    out.push(normalizeExclusive(u));
  }
  return out.sort((a, b) => a.unlock_town_hall_level - b.unlock_town_hall_level);
}

export interface TrainCost {
  wood: number;
  stone: number;
  gold: number;
  train_time_seconds: number;
}

/**
 * Trainingskosten und -zeit für `quantity` Einheiten inkl. Fraktions-Rabatt
 * (unit_cost_multiplier, z.B. Untote 0.85). Liefert null bei unbekannter Einheit.
 */
export function getTrainCost(
  config: GameConfig,
  unitType: string,
  quantity: number,
  faction: FactionId,
): TrainCost | null {
  const def = findUnitDefinition(config, unitType, faction);
  if (!def) return null;
  const m = config.factions[faction].modifiers;
  const costMul = mod(m, 'unit_cost_multiplier');
  return {
    wood: Math.ceil(def.cost.wood * costMul * quantity),
    stone: Math.ceil(def.cost.stone * costMul * quantity),
    gold: Math.ceil(def.cost.gold * costMul * quantity),
    train_time_seconds: def.train_time_seconds * quantity,
  };
}

/** Kampfwerte einer Einheit inkl. Fraktions-Modifikatoren (für die Simulation). */
export interface UnitCombatStats {
  hp: number;
  dps: number;
  hps: number;
  range: number;
  speed: number;
  splash: boolean;
}

/**
 * Kampfwerte einer Einheit inkl. Fraktions-Modifikatoren und optionalem
 * Truppen-Level (Roadmap P3: +hp_bonus_per_level_percent / +dps_bonus_per_level_percent
 * pro Level über 1, aus unit_research-Config). level=1 → kein Bonus.
 */
export function getUnitCombatStats(
  config: GameConfig,
  unitType: string,
  faction: FactionId,
  level = 1,
): UnitCombatStats | null {
  const def = findUnitDefinition(config, unitType, faction);
  if (!def) return null;
  const m = config.factions[faction].modifiers;

  const isRanged = def.range_tiles !== null && def.range_tiles > 0;
  const dmgMul =
    mod(m, 'unit_damage_multiplier') *
    (isRanged ? mod(m, 'ranged_unit_damage_multiplier') : mod(m, 'melee_unit_damage_multiplier'));

  const speedTiles = config.combat.unit_speed_tiles_per_second[def.speed] ?? 0;

  return {
    hp: def.hp * mod(m, 'unit_hp_multiplier') * researchHpMultiplier(config, level),
    dps: def.damage_per_second * dmgMul * researchDpsMultiplier(config, level),
    hps: def.heal_per_second,
    range: isRanged ? (def.range_tiles as number) : config.combat.melee_range_tiles,
    speed: speedTiles * mod(m, 'unit_speed_multiplier'),
    splash: def.splash_damage,
  };
}
