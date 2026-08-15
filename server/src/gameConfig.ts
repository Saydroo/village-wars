import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  GameConfig,
  FactionId,
  FactionConfig,
  CommonBuildingConfig,
  CommonUnitConfig,
} from '@village-wars/shared';
import { FACTION_IDS } from '@village-wars/shared';
import { logger } from './logger';

/**
 * Lädt `server/config/game-config.json` — die EINZIGE Quelle aller Zahlenwerte.
 * Wird einmalig beim Start gelesen und gecached. Kein Zahlenwert wird im Code
 * dupliziert; alles kommt aus dieser Datei.
 */

// __dirname = server/src  ->  server/config/game-config.json
const CONFIG_PATH = resolve(__dirname, '../config/game-config.json');

let cached: GameConfig | null = null;

export function loadGameConfig(): GameConfig {
  if (cached) return cached;
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as GameConfig;
  validateGameConfig(parsed);
  cached = parsed;
  logger.info('game-config.json geladen', {
    version: parsed._meta.version,
    path: CONFIG_PATH,
  });
  return cached;
}

export function getGameConfig(): GameConfig {
  return cached ?? loadGameConfig();
}

/** Liefert das rohe Config-Objekt für GET /api/config. */
export function getRawGameConfig(): GameConfig {
  return getGameConfig();
}

function validateGameConfig(cfg: GameConfig): void {
  if (!cfg._meta?.version) {
    throw new Error('game-config.json: _meta.version fehlt');
  }
  for (const id of FACTION_IDS) {
    if (!cfg.factions[id]) {
      throw new Error(`game-config.json: Fraktion "${id}" fehlt`);
    }
  }
}

// --- Typsichere Zugriffshelfer (kapseln das dynamische Indexing) ---

export function isFactionId(value: string): value is FactionId {
  return (FACTION_IDS as readonly string[]).includes(value);
}

export function getFaction(id: FactionId): FactionConfig {
  return getGameConfig().factions[id];
}

/** Sucht ein Gebäude in den gemeinsamen ODER fraktionsexklusiven Definitionen. */
export function findBuildingDefinition(
  buildingType: string,
  faction: FactionId,
):
  | { kind: 'common'; def: CommonBuildingConfig }
  | { kind: 'exclusive'; unlock_town_hall_level: number; display_name: string }
  | null {
  const cfg = getGameConfig();

  const common = cfg.buildings_common[buildingType];
  if (common && typeof common === 'object') {
    return { kind: 'common', def: common as CommonBuildingConfig };
  }

  const exclusive = cfg.factions_exclusive_content[faction]?.exclusive_buildings.find(
    (b) => b.id === buildingType,
  );
  if (exclusive) {
    return {
      kind: 'exclusive',
      unlock_town_hall_level: exclusive.unlock_town_hall_level,
      display_name: exclusive.display_name,
    };
  }

  return null;
}

export function getCommonUnit(unitType: string): CommonUnitConfig | null {
  const u = getGameConfig().units_common[unitType];
  return u && typeof u === 'object' ? (u as CommonUnitConfig) : null;
}

export function getFactionChangeCostBars(): number {
  return getGameConfig().faction_change.cost_bars;
}
