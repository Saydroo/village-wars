import type { PoolClient } from 'pg';
import type {
  AchievementClaimResponse,
  AchievementMetric,
  AchievementsResponse,
} from '@village-wars/shared';
import { buildAchievementView, claimableReward, reachedTierCount } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Achievements (Roadmap P2). Die Metrik-Werte werden **live aus dem Spielstand**
 * berechnet (keine Event-Instrumentierung nötig); gespeichert wird nur die höchste
 * abgeholte Stufe (player_achievements.claimed_tier). Belohnungen (Gems + verdienbare
 * Goldbarren) stammen aus der GameConfig. Server-autoritativ — Stufen werden nur
 * abgeholt, wenn der Live-Wert die Schwelle erreicht.
 */

type Metrics = Record<AchievementMetric, number>;

async function loadMetrics(playerId: string, client?: PoolClient): Promise<Metrics> {
  const q = client ? client.query.bind(client) : query;

  const pr = await q(
    `SELECT trophies, village_level, (clan_id IS NOT NULL) AS in_clan FROM players WHERE id = $1`,
    [playerId],
  );
  const p = pr.rows[0] as
    | { trophies: number; village_level: number; in_clan: boolean }
    | undefined;
  if (!p) throw notFound('Spieler nicht gefunden');

  const [battles, streak, dungeons, buildings] = await Promise.all([
    q(`SELECT COUNT(*)::int AS n FROM battles WHERE attacker_id = $1 AND mode = 'solo' AND result = 'attacker_win'`, [playerId]),
    q(`SELECT COALESCE(longest_streak, 0) AS n FROM player_daily_rewards WHERE player_id = $1`, [playerId]),
    q(`SELECT COUNT(*)::int AS n FROM dungeon_runs WHERE player_id = $1 AND status = 'won'`, [playerId]),
    q(`SELECT COUNT(*)::int AS n FROM buildings WHERE player_id = $1`, [playerId]),
  ]);

  return {
    trophies: Number(p.trophies),
    town_hall_level: Number(p.village_level),
    battles_won: Number((battles.rows[0] as { n: number } | undefined)?.n ?? 0),
    longest_daily_streak: Number((streak.rows[0] as { n: number } | undefined)?.n ?? 0),
    dungeons_cleared: Number((dungeons.rows[0] as { n: number } | undefined)?.n ?? 0),
    clan_member: p.in_clan ? 1 : 0,
    buildings_count: Number((buildings.rows[0] as { n: number } | undefined)?.n ?? 0),
  };
}

/** Abgeholte Stufen je Achievement-ID. */
async function loadClaimed(playerId: string, client?: PoolClient): Promise<Map<string, number>> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT achievement_id, claimed_tier FROM player_achievements WHERE player_id = $1`,
    [playerId],
  );
  const map = new Map<string, number>();
  for (const r of res.rows as Array<{ achievement_id: string; claimed_tier: number }>) {
    map.set(r.achievement_id, Number(r.claimed_tier));
  }
  return map;
}

/** Alle Achievements mit Live-Fortschritt + Anspruch. */
export async function getAchievements(playerId: string): Promise<AchievementsResponse> {
  const config = getGameConfig();
  const [metrics, claimed] = await Promise.all([loadMetrics(playerId), loadClaimed(playerId)]);
  const achievements = config.achievements.definitions.map((def) =>
    buildAchievementView(def, metrics[def.metric] ?? 0, claimed.get(def.id) ?? 0),
  );
  return { achievements };
}

/** Holt alle neu erreichten Stufen eines Achievements ab (Gems + Goldbarren gutschreiben). */
export async function claimAchievement(
  playerId: string,
  achievementId: string,
): Promise<AchievementClaimResponse> {
  const config = getGameConfig();
  const def = config.achievements.definitions.find((d) => d.id === achievementId);
  if (!def) throw notFound('Achievement nicht gefunden');

  return withTransaction(async (client) => {
    const metrics = await loadMetrics(playerId, client);
    const value = metrics[def.metric] ?? 0;
    const reached = reachedTierCount(value, def.tiers);

    // Aktuelle abgeholte Stufe sperren/anlegen.
    await client.query(
      `INSERT INTO player_achievements (player_id, achievement_id) VALUES ($1, $2)
       ON CONFLICT (player_id, achievement_id) DO NOTHING`,
      [playerId, achievementId],
    );
    const cur = await client.query(
      `SELECT claimed_tier FROM player_achievements WHERE player_id = $1 AND achievement_id = $2 FOR UPDATE`,
      [playerId, achievementId],
    );
    const claimedTier = Number((cur.rows[0] as { claimed_tier: number }).claimed_tier);

    if (reached <= claimedTier) {
      throw badRequest('Keine neue Stufe zum Abholen');
    }

    const reward = claimableReward(def.tiers, claimedTier, reached);
    const pr = await client.query(
      `UPDATE players SET gems = gems + $1, gold_bars = gold_bars + $2 WHERE id = $3 RETURNING ${PLAYER_COLUMNS}`,
      [reward.gems, reward.gold_bars, playerId],
    );
    const player = mapPlayer(pr.rows[0] as Record<string, unknown>);

    await client.query(
      `UPDATE player_achievements SET claimed_tier = $1, updated_at = NOW()
        WHERE player_id = $2 AND achievement_id = $3`,
      [reached, playerId, achievementId],
    );

    const achievement = buildAchievementView(def, value, reached);
    return { player, achievement, claimed_gems: reward.gems, claimed_gold_bars: reward.gold_bars };
  });
}
