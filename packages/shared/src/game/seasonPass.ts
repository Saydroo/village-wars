import type { GameConfig, SeasonPassTier } from '../types/gameConfig';

/**
 * Reine Season-Pass-Logik (Roadmap P7). Plattformunabhängig: leitet erreichte
 * Stufe, nächste Schwelle und Stufen-Definitionen aus der Config + aktueller XP ab.
 * Keine Zahl ist hartcodiert — alles aus config.season_pass.
 */

/** Nach Stufennummer aufsteigend sortierte Pass-Stufen. */
export function seasonPassTiers(config: GameConfig): SeasonPassTier[] {
  const tiers = config.season_pass?.tiers ?? [];
  return [...tiers].sort((a, b) => a.tier - b.tier);
}

/** Höchste Stufennummer im Pass (0 wenn keine Stufen). */
export function maxSeasonPassTier(config: GameConfig): number {
  const tiers = seasonPassTiers(config);
  return tiers.length ? tiers[tiers.length - 1]!.tier : 0;
}

/** Stufen-Definition zu einer Stufennummer (oder undefined). */
export function seasonPassTierDef(config: GameConfig, tier: number): SeasonPassTier | undefined {
  return seasonPassTiers(config).find((t) => t.tier === tier);
}

/** Aktuell erreichte Stufe für eine XP-Menge (höchste mit xp_required <= xp; 0 wenn keine). */
export function currentSeasonPassTier(config: GameConfig, xp: number): number {
  let reached = 0;
  for (const t of seasonPassTiers(config)) {
    if (xp >= t.xp_required) reached = Math.max(reached, t.tier);
  }
  return reached;
}

/** Ist eine bestimmte Stufe bei gegebener XP erreicht? */
export function isSeasonPassTierReached(config: GameConfig, xp: number, tier: number): boolean {
  const def = seasonPassTierDef(config, tier);
  return def ? xp >= def.xp_required : false;
}

/** XP-Schwelle der nächsten noch nicht erreichten Stufe (null = Maximum erreicht). */
export function nextSeasonPassTierXp(config: GameConfig, xp: number): number | null {
  for (const t of seasonPassTiers(config)) {
    if (xp < t.xp_required) return t.xp_required;
  }
  return null;
}
