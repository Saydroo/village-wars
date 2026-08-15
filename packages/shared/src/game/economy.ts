import type { CommonBuildingConfig, FactionId, GameConfig } from '../types/gameConfig';
import { mod } from './factions';

/**
 * Reine Ökonomie-Berechnungen für Phase 2 (Produktion, Lager-Cap, Upgrade-Kosten,
 * Bauzeit-Skip). Alle Zahlen stammen aus der GameConfig; Fraktions-Modifikatoren
 * werden überall angewandt. Keine Werte sind hier hartcodiert.
 */

export type ResourceKind = 'wood' | 'stone' | 'gold';

export interface BuildingProduction {
  wood: number;
  stone: number;
  gold: number;
}

function commonBuilding(config: GameConfig, type: string): CommonBuildingConfig | null {
  const def = config.buildings_common[type];
  return def && typeof def === 'object' ? (def as CommonBuildingConfig) : null;
}

/** Produktion eines Gebäudes pro Stunde mit kompoundem Level-Wachstum. */
export function productionPerHour(base: number, growthPercent: number, level: number): number {
  return base * Math.pow(1 + growthPercent / 100, level - 1);
}

/** Produktion (mit Fraktionsbonus) eines Produktionsgebäudes pro Stunde. */
export function buildingProductionPerHour(
  config: GameConfig,
  buildingType: string,
  level: number,
  factionId: FactionId,
): BuildingProduction {
  const out: BuildingProduction = { wood: 0, stone: 0, gold: 0 };
  if (level < 1) return out; // im Bau (Stufe 0): noch keine Produktion
  const def = commonBuilding(config, buildingType);
  if (!def || typeof def.base_production_per_hour !== 'number') return out;
  const growth = def.production_growth_per_level_percent ?? 0;
  const raw = productionPerHour(def.base_production_per_hour, growth, level);

  const m = config.factions[factionId].modifiers;
  const general = mod(m, 'resource_production_multiplier');

  if (buildingType === 'lumber_camp') {
    out.wood = raw * general;
  } else if (buildingType === 'quarry') {
    out.stone = raw * general * mod(m, 'resource_production_multiplier_stone');
  } else if (buildingType === 'gold_mine') {
    out.gold = raw * general * mod(m, 'resource_production_multiplier_gold');
  }
  return out;
}

function storageTypeFor(resource: ResourceKind): string {
  return resource === 'wood' ? 'storage_wood' : resource === 'stone' ? 'storage_stone' : 'storage_gold';
}

export interface OwnedBuilding {
  building_type: string;
  level: number;
}

/** Lagerkapazität für eine Ressource (Grundkapazität + gebaute Lager). */
export function storageCapacity(
  config: GameConfig,
  buildings: OwnedBuilding[],
  resource: ResourceKind,
): number {
  const type = storageTypeFor(resource);
  const def = commonBuilding(config, type);
  if (!def || typeof def.base_capacity !== 'number') return 0;
  const base = def.base_capacity;
  const growth = def.capacity_growth_per_level_percent ?? 0;

  let cap = config.economy.storage_baseline_from_town_hall === false ? 0 : base;
  for (const b of buildings) {
    if (b.building_type === type && b.level >= 1) {
      cap += base * Math.pow(1 + growth / 100, b.level - 1);
    }
  }
  return Math.floor(cap);
}

/** Harte Obergrenze haltbarer Ressourcen = Kapazität × resource_cap_multiplier. */
export function resourceCap(
  config: GameConfig,
  buildings: OwnedBuilding[],
  resource: ResourceKind,
): number {
  return Math.floor(storageCapacity(config, buildings, resource) * config.economy.resource_cap_multiplier);
}

export interface UpgradeCost {
  wood: number;
  stone: number;
  gold: number;
  build_time_minutes: number;
}

/** Basis-Upgrade-Kosten (ohne Fraktion) für die Zielstufe, oder null. */
function baseUpgradeRequirement(
  config: GameConfig,
  buildingType: string,
  targetLevel: number,
): UpgradeCost | null {
  if (buildingType === 'town_hall') {
    const e = config.town_hall_levels.upgrade_requirements.find((r) => r.level === targetLevel);
    if (!e) return null;
    return { wood: e.wood, stone: e.stone, gold: e.gold ?? 0, build_time_minutes: e.build_time_minutes };
  }
  if (buildingType === 'clan_castle') {
    const e = config.clan.clan_castle.levels.find((r) => r.level === targetLevel);
    if (!e) return null;
    return { wood: e.wood, stone: e.stone, gold: e.gold ?? 0, build_time_minutes: e.build_time_minutes };
  }
  // Ressourcengebäude mit Level-Tabelle (Steinbruch nutzt die Tabelle des Holzfällerlagers)
  const src = buildingType === 'quarry' ? 'lumber_camp' : buildingType;
  const def = commonBuilding(config, src);
  if (def && Array.isArray(def.levels)) {
    const e = def.levels.find((l) => l.level === targetLevel);
    if (!e) return null;
    return { wood: e.wood_cost, stone: e.stone_cost, gold: 0, build_time_minutes: e.build_time_minutes };
  }
  return null;
}

/**
 * Upgrade-Kosten/-Zeit für die Zielstufe inkl. Fraktions-Modifikatoren.
 * Liefert null, wenn die Config für diesen Gebäudetyp (noch) keine Kostentabelle
 * definiert (z.B. Mauer, Wachturm, Kanone, Lager — keine erfundenen Werte!).
 */
export function getUpgradeCost(
  config: GameConfig,
  buildingType: string,
  targetLevel: number,
  factionId: FactionId,
): UpgradeCost | null {
  const base = baseUpgradeRequirement(config, buildingType, targetLevel);
  if (!base) return null;
  const m = config.factions[factionId].modifiers;
  const costMul = mod(m, 'upgrade_cost_multiplier');
  const timeMul = mod(m, 'build_time_multiplier');
  return {
    wood: Math.ceil(base.wood * costMul),
    stone: Math.ceil(base.stone * costMul),
    gold: Math.ceil(base.gold * costMul),
    build_time_minutes: Math.ceil(base.build_time_minutes * timeMul),
  };
}

/** Basis-Baukosten (ohne Fraktion) zum Platzieren eines NEUEN Gebäudes (Stufe 1). */
function basePlacementRequirement(
  config: GameConfig,
  buildingType: string,
  factionId: FactionId,
): UpgradeCost | null {
  if (buildingType === 'town_hall') return null; // wird nie vom Spieler platziert

  // Clan-Burg: Stufe-1-Eintrag der eigenen Level-Tabelle.
  if (buildingType === 'clan_castle') {
    const e = config.clan.clan_castle.levels.find((r) => r.level === 1);
    if (!e) return null;
    return { wood: e.wood, stone: e.stone, gold: e.gold ?? 0, build_time_minutes: e.build_time_minutes };
  }

  // Gemeinsame Gebäude (Steinbruch teilt sich die Tabelle des Holzfällerlagers).
  const src = buildingType === 'quarry' ? 'lumber_camp' : buildingType;
  const def = commonBuilding(config, src);
  if (def) {
    if (Array.isArray(def.levels)) {
      const e = def.levels.find((l) => l.level === 1);
      if (e) return { wood: e.wood_cost, stone: e.stone_cost, gold: 0, build_time_minutes: e.build_time_minutes };
    }
    if (
      typeof def.wood_cost === 'number' ||
      typeof def.stone_cost === 'number' ||
      typeof def.gold_cost === 'number'
    ) {
      return {
        wood: def.wood_cost ?? 0,
        stone: def.stone_cost ?? 0,
        gold: def.gold_cost ?? 0,
        build_time_minutes: def.build_time_minutes ?? 0,
      };
    }
    if (def.cost_per_segment_level_1) {
      const c = def.cost_per_segment_level_1;
      return { wood: c.wood ?? 0, stone: c.stone ?? 0, gold: c.gold ?? 0, build_time_minutes: 0 };
    }
    return null;
  }

  // Fraktionsexklusives Gebäude (pauschale Kosten direkt am Eintrag).
  const ex = config.factions_exclusive_content[factionId]?.exclusive_buildings.find(
    (b) => b.id === buildingType,
  );
  if (ex) {
    return {
      wood: ex.wood_cost ?? 0,
      stone: ex.stone_cost ?? 0,
      gold: ex.gold_cost ?? 0,
      build_time_minutes: ex.build_time_minutes ?? 0,
    };
  }

  return null;
}

/**
 * Baukosten/-zeit zum Platzieren eines NEUEN Gebäudes (Stufe 1) inkl.
 * Fraktions-Modifikatoren. Liefert null, wenn die Config keine Kostendaten hat.
 * Holzfäller/Steinbruch sind regulär 0 (gratis).
 */
export function getPlacementCost(
  config: GameConfig,
  buildingType: string,
  factionId: FactionId,
): UpgradeCost | null {
  const base = basePlacementRequirement(config, buildingType, factionId);
  if (!base) return null;
  const m = config.factions[factionId].modifiers;
  const costMul = mod(m, 'build_cost_multiplier');
  const timeMul = mod(m, 'build_time_multiplier');
  return {
    wood: Math.ceil(base.wood * costMul),
    stone: Math.ceil(base.stone * costMul),
    gold: Math.ceil(base.gold * costMul),
    build_time_minutes: Math.ceil(base.build_time_minutes * timeMul),
  };
}

/** Maximalstufe eines Gebäudes, oder null wenn unbekannt. */
export function getBuildingMaxLevel(
  config: GameConfig,
  buildingType: string,
): number | null {
  if (buildingType === 'town_hall') return config.town_hall_levels.max_level;
  if (buildingType === 'clan_castle') return config.clan.clan_castle.levels.length;
  const src = buildingType === 'quarry' ? 'lumber_camp' : buildingType;
  const def = commonBuilding(config, src);
  return def && typeof def.max_level === 'number' ? def.max_level : null;
}

/**
 * Goldbarren-Kosten für einen Bauzeit-Skip bei `remainingMinutes` Restzeit.
 * Degressive Staffelung aus build_time_skip; Mindestkosten gelten immer.
 */
export function skipCostBars(config: GameConfig, remainingMinutes: number): number {
  const minimum = config.build_time_skip.minimum_cost_bars;
  if (remainingMinutes <= 0) return minimum;

  const tiers = Object.values(config.build_time_skip.cost_per_minute_remaining)
    .slice()
    .sort((a, b) => a.max_minutes - b.max_minutes);

  let rate = tiers.length > 0 ? tiers[tiers.length - 1]!.bars_per_minute : 0;
  for (const t of tiers) {
    if (remainingMinutes <= t.max_minutes) {
      rate = t.bars_per_minute;
      break;
    }
  }
  return Math.max(Math.ceil(remainingMinutes * rate), minimum);
}
