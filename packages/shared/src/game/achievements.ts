import type { AchievementDef, AchievementTier } from '../types/gameConfig';
import type { AchievementView } from '../types/api';

/**
 * Reine Achievement-Logik (Roadmap P2): Stufen-Mathematik. Die Metrik-WERTE
 * (Trophäen, gewonnene Kämpfe …) liefert der Server aus dem Spielstand; hier ist
 * nur die plattformunabhängige, testbare Auswertung. Belohnungen/Stufen stammen
 * aus der GameConfig (achievements.definitions).
 */

/** Anzahl erreichter Stufen (alle mit threshold <= value). */
export function reachedTierCount(value: number, tiers: AchievementTier[]): number {
  let n = 0;
  for (const t of tiers) if (value >= t.threshold) n += 1;
  return n;
}

/** Nächste noch nicht erreichte Schwelle (aufsteigend), oder null wenn alle erreicht. */
export function nextThreshold(value: number, tiers: AchievementTier[]): number | null {
  let best: number | null = null;
  for (const t of tiers) {
    if (value < t.threshold && (best === null || t.threshold < best)) best = t.threshold;
  }
  return best;
}

/** Summe der Belohnung für die Stufen-Indizes [claimedTier, reachedTier) (0-basiert). */
export function claimableReward(
  tiers: AchievementTier[],
  claimedTier: number,
  reachedTier: number,
): { gems: number; gold_bars: number } {
  let gems = 0;
  let gold_bars = 0;
  for (let i = Math.max(0, claimedTier); i < reachedTier; i++) {
    const t = tiers[i];
    if (t) {
      gems += t.gems;
      gold_bars += t.gold_bars;
    }
  }
  return { gems, gold_bars };
}

/** Anzeige-Sicht eines Achievements aus Definition + Live-Wert + abgeholter Stufenzahl. */
export function buildAchievementView(
  def: AchievementDef,
  value: number,
  claimedTier: number,
): AchievementView {
  const reached = reachedTierCount(value, def.tiers);
  const claimed = Math.min(Math.max(0, claimedTier), def.tiers.length);
  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    description: def.description,
    metric: def.metric,
    value,
    tiers: def.tiers,
    reached_tier: reached,
    claimed_tier: claimed,
    claimable: reached > claimed,
    next_threshold: nextThreshold(value, def.tiers),
  };
}
