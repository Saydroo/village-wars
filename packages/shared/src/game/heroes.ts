import type { FactionId, GameConfig, FactionHeroDef, HeroLevelCost } from '../types/gameConfig';
import type { BattleHeroStats } from '../types/combat';

/**
 * Stabiler Reserve-/Deploy-Schlüssel des Helden im Kampf. Bewusst kein echter
 * Einheiten-Typ (so kollidiert er nie mit units_common/exklusiven Einheiten);
 * der Client löst den Anzeigenamen über `BattleSetupPayload.hero` auf.
 */
export const HERO_UNIT_TYPE = 'hero';

/** Helden-Definition für eine Fraktion (null wenn nicht konfiguriert). */
export function getHeroDef(config: GameConfig, faction: FactionId): FactionHeroDef | null {
  return config.heroes?.faction_heroes?.[faction] ?? null;
}

/** Level-Kosten für ein bestimmtes Ziel-Level (null = kein Eintrag). */
export function getHeroLevelCost(config: GameConfig, toLevel: number): HeroLevelCost | null {
  return config.heroes?.level_costs?.find((c) => c.to_level === toLevel) ?? null;
}

/** HP-Multiplikator basierend auf Helden-Level (analog zu researchHpMultiplier). */
export function heroHpMultiplier(config: GameConfig, level: number): number {
  const pct = config.heroes?.hp_bonus_per_level_percent ?? 0;
  return 1 + ((Math.max(1, level) - 1) * pct) / 100;
}

/** DPS-Multiplikator basierend auf Helden-Level. */
export function heroDpsMultiplier(config: GameConfig, level: number): number {
  const pct = config.heroes?.dps_bonus_per_level_percent ?? 0;
  return 1 + ((Math.max(1, level) - 1) * pct) / 100;
}

/** Berechnet die aktuellen HP des Helden (basis × Level-Multiplikator). */
export function heroCurrentHp(config: GameConfig, faction: FactionId, level: number): number {
  const def = getHeroDef(config, faction);
  if (!def) return 0;
  return Math.round(def.base_hp * heroHpMultiplier(config, level));
}

/** Berechnet den aktuellen DPS des Helden. */
export function heroCurrentDps(config: GameConfig, faction: FactionId, level: number): number {
  const def = getHeroDef(config, faction);
  if (!def) return 0;
  return Math.round(def.base_dps * heroDpsMultiplier(config, level) * 10) / 10;
}

/** Regenerationszeit in Minuten (abhängig vom Helden-Level). */
export function heroRegenMinutes(config: GameConfig, level: number): number {
  return (config.heroes?.regen_minutes_per_level ?? 10) * Math.max(1, level);
}

/**
 * Leitet die Kampf-Stats des Helden für die Engine ab (Roadmap P6). Geschwindigkeit
 * wird wie bei Einheiten aus `combat.unit_speed_tiles_per_second[speed]` aufgelöst,
 * Reichweite aus `range_tiles` (Fernkampf) bzw. dem Nahkampf-Fallback. HP/DPS
 * stammen aus der Fraktions-Helden-Definition × Level-Multiplikator. Fraktions-
 * Kampfmodifikatoren werden bewusst NICHT angewandt (die Helden-Werte sind in der
 * Config bereits fraktionsspezifisch). Liefert null, wenn keine Definition existiert.
 */
export function heroCombatStats(
  config: GameConfig,
  faction: FactionId,
  level: number,
): BattleHeroStats | null {
  const def = getHeroDef(config, faction);
  if (!def) return null;
  const isRanged = typeof def.range_tiles === 'number' && def.range_tiles > 0;
  const speedTiles = config.combat.unit_speed_tiles_per_second[def.speed] ?? 0;
  return {
    unit_type: HERO_UNIT_TYPE,
    display_name: def.display_name,
    hp: heroCurrentHp(config, faction, level),
    dps: heroCurrentDps(config, faction, level),
    hps: 0,
    range: isRanged ? (def.range_tiles as number) : config.combat.melee_range_tiles,
    speed: speedTiles,
    splash: Boolean(def.splash_damage),
  };
}

/** Ist der Held einsatzbereit (kein Leveling, keine Regen)? */
export function isHeroReady(levelingUntil: string | null, regeneratesUntil: string | null): boolean {
  const now = Date.now();
  if (levelingUntil && new Date(levelingUntil).getTime() > now) return false;
  if (regeneratesUntil && new Date(regeneratesUntil).getTime() > now) return false;
  return true;
}

/** Hat der Spieler eine Hero Hall gebaut? */
export function hasHeroHall(buildings: Array<{ type: string; level: number }>): boolean {
  return buildings.some((b) => b.type === 'hero_hall' && b.level >= 1);
}
