import type { DailyRewardTier, GameConfig } from '../types/gameConfig';
import type { DailyRewardView } from '../types/api';

/**
 * Reine Logik der täglichen Login-Belohnung + Streak (Roadmap P1, Retention).
 * Plattformunabhängig + deterministisch — alle Werte/Leiter stammen aus der
 * GameConfig (daily_rewards). Ein „Tag" ist ein Europe/Berlin-Kalendertag; der
 * Aufrufer reicht die Datums-Strings (YYYY-MM-DD) herein, damit diese Logik
 * zeitzonenfrei und testbar bleibt.
 */

/** Skaliert eine Leiter-Stufe für die Anzeige/Gutschrift (Ressourcen × Rathaus-Level). */
export function scaleTier(
  tier: DailyRewardTier,
  townHallLevel: number,
  scaleResources: boolean,
): DailyRewardView {
  const f = scaleResources ? Math.max(1, Math.floor(townHallLevel)) : 1;
  return {
    day: tier.day,
    wood: Math.round(tier.wood * f),
    stone: Math.round(tier.stone * f),
    gold: Math.round(tier.gold * f),
    gems: tier.gems, // Premium-/Spezialwährung wird NICHT skaliert
    gold_bars: tier.gold_bars,
    label: tier.label,
  };
}

/** Die komplette (skalierte) Belohnungsleiter zur Anzeige. */
export function dailyLadderView(config: GameConfig, townHallLevel: number): DailyRewardView[] {
  const dr = config.daily_rewards;
  const scale = dr.scale_resources_with_town_hall ?? false;
  return dr.ladder.map((t) => scaleTier(t, townHallLevel, scale));
}

/** Belohnung (skaliert) für einen 1-basierten Streak-Tag (Leiter wiederholt sich). */
export function rewardForStreakDay(
  config: GameConfig,
  streakDay: number,
  townHallLevel: number,
): DailyRewardView {
  const ladder = config.daily_rewards.ladder;
  const idx = (Math.max(1, streakDay) - 1) % ladder.length;
  const scale = config.daily_rewards.scale_resources_with_town_hall ?? false;
  return scaleTier(ladder[idx]!, townHallLevel, scale);
}

/** YYYY-MM-DD des Vortags (rein, zeitzonenfrei — Eingabe ist bereits ein Kalendertag). */
export function previousDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export interface StreakDecision {
  /** Kann heute (noch) abgeholt werden? */
  canClaim: boolean;
  /** Streak-Tag, den ein Claim JETZT belegen würde (= Streak NACH dem Claim). */
  nextStreak: number;
  /** Wurde der Streak vor diesem Claim zurückgesetzt (Tag verpasst)? */
  reset: boolean;
}

/**
 * Reine Streak-Entscheidung aus letztem Claim-Datum, aktuellem Streak und heutigem
 * (Berlin-)Datum:
 *  - bereits heute abgeholt        → kein Claim
 *  - zuletzt gestern abgeholt      → Streak +1 (Fortsetzung)
 *  - nie / Lücke (Tag ausgelassen) → Streak startet bei 1 (reset, falls vorher > 0)
 */
export function decideStreak(
  lastClaimDate: string | null,
  currentStreak: number,
  today: string,
): StreakDecision {
  if (lastClaimDate === today) {
    return { canClaim: false, nextStreak: currentStreak, reset: false };
  }
  if (lastClaimDate !== null && lastClaimDate === previousDate(today)) {
    return { canClaim: true, nextStreak: currentStreak + 1, reset: false };
  }
  return { canClaim: true, nextStreak: 1, reset: currentStreak > 0 };
}
