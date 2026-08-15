import type { PoolClient } from 'pg';
import type {
  OnboardingClaimResponse,
  OnboardingResponse,
  OnboardingMetric,
  OnboardingStepDef,
} from '@village-wars/shared';
import {
  buildOnboardingStepView,
  getOnboardingSteps,
  isStepComplete,
  resourceCap,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Onboarding / Tutorial (Roadmap P8). Eine feste, geordnete Schrittfolge wird
 * STRIKT der Reihe nach abgeholt. Der Fortschritt jedes Schritts wird **live aus
 * dem Spielstand** abgeleitet (wie bei Achievements, keine Event-Instrumentierung);
 * gespeichert wird nur die Anzahl abgeholter Schritte (player_onboarding.claimed_steps).
 * Server-autoritativ — ein Schritt lässt sich nur abholen, wenn er der aktuell offene
 * ist UND sein Live-Wert das Ziel erreicht.
 */

/** Live-Werte aller in den Schritten verwendeten Metriken. */
async function loadMetricValue(
  metric: OnboardingMetric,
  playerId: string,
  client?: PoolClient,
): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  switch (metric) {
    case 'none':
      return 0;
    case 'buildings_count': {
      const r = await q(`SELECT COUNT(*)::int AS n FROM buildings WHERE player_id = $1`, [playerId]);
      return Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);
    }
    case 'army_size': {
      const r = await q(
        `SELECT COALESCE(SUM(quantity), 0)::int AS n FROM units WHERE player_id = $1`,
        [playerId],
      );
      return Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);
    }
    case 'battles_won': {
      const r = await q(
        `SELECT COUNT(*)::int AS n FROM battles
          WHERE attacker_id = $1 AND mode = 'solo' AND result = 'attacker_win'`,
        [playerId],
      );
      return Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);
    }
    case 'clan_member': {
      const r = await q(`SELECT (clan_id IS NOT NULL) AS in_clan FROM players WHERE id = $1`, [
        playerId,
      ]);
      return (r.rows[0] as { in_clan: boolean } | undefined)?.in_clan ? 1 : 0;
    }
    default:
      return 0;
  }
}

/** Live-Werte für eine Menge an Metriken (dedupliziert). */
async function loadMetricValues(
  steps: OnboardingStepDef[],
  playerId: string,
  client?: PoolClient,
): Promise<Map<OnboardingMetric, number>> {
  const metrics = [...new Set(steps.map((s) => s.metric))];
  const values = await Promise.all(metrics.map((m) => loadMetricValue(m, playerId, client)));
  const map = new Map<OnboardingMetric, number>();
  metrics.forEach((m, i) => map.set(m, values[i] ?? 0));
  return map;
}

/** Anzahl bereits abgeholter Schritte (0, falls noch keine Zeile existiert). */
async function loadClaimedSteps(playerId: string, client?: PoolClient): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  const r = await q(`SELECT claimed_steps FROM player_onboarding WHERE player_id = $1`, [playerId]);
  return Number((r.rows[0] as { claimed_steps: number } | undefined)?.claimed_steps ?? 0);
}

/** Alle Onboarding-Schritte mit Live-Fortschritt + Status. */
export async function getOnboarding(playerId: string): Promise<OnboardingResponse> {
  const config = getGameConfig();
  const steps = getOnboardingSteps(config);
  const [claimedSteps, values] = await Promise.all([
    loadClaimedSteps(playerId),
    loadMetricValues(steps, playerId),
  ]);
  const stepViews = steps.map((step, index) =>
    buildOnboardingStepView(step, index, values.get(step.metric) ?? 0, claimedSteps),
  );
  const allComplete = claimedSteps >= steps.length;
  return {
    steps: stepViews,
    claimed_steps: claimedSteps,
    all_complete: allComplete,
    active_step_id: steps[claimedSteps]?.id ?? null,
  };
}

/**
 * Holt den aktuell offenen Schritt ab (Belohnung gutschreiben, Ressourcen auf
 * Lager-Cap gekappt). `stepId` muss dem aktiven Schritt entsprechen (verhindert
 * Doppel-/Stale-Claims). Strikt sequentiell.
 */
export async function claimOnboardingStep(
  playerId: string,
  stepId: string,
): Promise<OnboardingClaimResponse> {
  const config = getGameConfig();
  const steps = getOnboardingSteps(config);

  return withTransaction(async (client) => {
    // Zeile anlegen + sperren (Race-frei, idempotenter Start).
    await client.query(
      `INSERT INTO player_onboarding (player_id) VALUES ($1)
       ON CONFLICT (player_id) DO NOTHING`,
      [playerId],
    );
    const cur = await client.query(
      `SELECT claimed_steps FROM player_onboarding WHERE player_id = $1 FOR UPDATE`,
      [playerId],
    );
    const claimedSteps = Number((cur.rows[0] as { claimed_steps: number }).claimed_steps);

    const step = steps[claimedSteps];
    if (!step) {
      throw badRequest('Onboarding bereits abgeschlossen');
    }
    if (step.id !== stepId) {
      throw badRequest('Dieser Schritt ist nicht der aktuell offene Schritt');
    }

    const value = await loadMetricValue(step.metric, playerId, client);
    if (!isStepComplete(value, step.target)) {
      throw badRequest('Dieser Schritt ist noch nicht erfüllt');
    }

    // Belohnung: Ressourcen auf Lager-Cap gekappt (Überschuss verfällt), Gems/Goldbarren ungekappt.
    const reward = step.reward;
    const wood = reward.wood ?? 0;
    const stone = reward.stone ?? 0;
    const gold = reward.gold ?? 0;
    const gems = reward.gems ?? 0;
    const goldBars = reward.gold_bars ?? 0;

    const br = await client.query(
      `SELECT building_type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings: OwnedBuilding[] = br.rows.map((b) => ({
      building_type: b.building_type as string,
      level: Number(b.level),
    }));
    const capWood = resourceCap(config, buildings, 'wood');
    const capStone = resourceCap(config, buildings, 'stone');
    const capGold = resourceCap(config, buildings, 'gold');

    const pr = await client.query(
      `UPDATE players
          SET wood = LEAST(wood + $1, $2),
              stone = LEAST(stone + $3, $4),
              gold = LEAST(gold + $5, $6),
              gems = gems + $7,
              gold_bars = gold_bars + $8
        WHERE id = $9
      RETURNING ${PLAYER_COLUMNS}`,
      [wood, capWood, stone, capStone, gold, capGold, gems, goldBars, playerId],
    );
    const player = mapPlayer(pr.rows[0] as Record<string, unknown>);

    const newClaimed = claimedSteps + 1;
    const allComplete = newClaimed >= steps.length;
    await client.query(
      `UPDATE player_onboarding
          SET claimed_steps = $1,
              completed_at = CASE WHEN $2 THEN NOW() ELSE completed_at END,
              updated_at = NOW()
        WHERE player_id = $3`,
      [newClaimed, allComplete, playerId],
    );

    const stepView = buildOnboardingStepView(step, claimedSteps, value, newClaimed);
    return {
      player,
      step: stepView,
      claimed_wood: wood,
      claimed_stone: stone,
      claimed_gold: gold,
      claimed_gems: gems,
      claimed_gold_bars: goldBars,
      all_complete: allComplete,
    };
  });
}
