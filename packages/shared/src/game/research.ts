import type { GameConfig, ResearchLevelCost } from '../types/gameConfig';

/**
 * Reine Logik für Truppen-Level-Forschung (Roadmap P3).
 * Plattformunabhängig — kein I/O, keine Seiteneffekte.
 */

/** Gibt die Kosten (gold + Forschungszeit) für das Aufsteigen auf `toLevel` zurück. */
export function getResearchCost(
  config: GameConfig,
  toLevel: number,
): ResearchLevelCost | null {
  return config.unit_research.level_costs.find((c) => c.to_level === toLevel) ?? null;
}

/** HP-Multiplikator für ein gegebenes Truppen-Level (Stufe 1 = 1.0). */
export function researchHpMultiplier(config: GameConfig, level: number): number {
  if (level <= 1) return 1;
  return 1 + ((level - 1) * config.unit_research.hp_bonus_per_level_percent) / 100;
}

/** DPS-Multiplikator für ein gegebenes Truppen-Level (Stufe 1 = 1.0). */
export function researchDpsMultiplier(config: GameConfig, level: number): number {
  if (level <= 1) return 1;
  return 1 + ((level - 1) * config.unit_research.dps_bonus_per_level_percent) / 100;
}

/** Gibt das aktuelle Truppen-Level zurück (Standard 1, wenn nicht in der Map). */
export function getUnitLevel(
  unitLevels: Record<string, number> | undefined,
  unitType: string,
): number {
  return unitLevels?.[unitType] ?? 1;
}

/** Prüft, ob ein Spieler das Forschungslabor gebaut hat. */
export function hasResearchLab(
  buildings: Array<{ type: string; level: number }>,
): boolean {
  return buildings.some((b) => b.type === 'research_lab' && b.level >= 1);
}
