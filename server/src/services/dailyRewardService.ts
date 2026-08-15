import type { PoolClient } from 'pg';
import type {
  DailyRewardClaimResponse,
  DailyRewardStatusResponse,
  DailyRewardView,
} from '@village-wars/shared';
import {
  dailyLadderView,
  decideStreak,
  rewardForStreakDay,
  resourceCap,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { berlinDateString } from '../utils/berlinDate';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Tägliche Login-Belohnung + Streak (Roadmap P1). Server-autoritativ: pro
 * Berlin-Kalendertag genau ein Claim. Ressourcen werden auf den Lager-Cap gekappt
 * (wie PvP-Loot/Dungeon), Gems/Goldbarren sind ungekappt. Goldbarren am Streak-
 * Höhepunkt machen Premium-Währung verdienbar (fair statt P2W). Alle Beträge/Leiter
 * stammen aus der GameConfig (daily_rewards).
 */

interface DailyRow {
  streak: number;
  longest_streak: number;
  last_claim_date: string | null; // YYYY-MM-DD oder null
  total_claims: number;
}

/** Lädt die Daily-Zeile (oder Defaults, falls noch keine existiert). */
async function loadDailyRow(playerId: string, client?: PoolClient): Promise<DailyRow> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(
    `SELECT streak, longest_streak, to_char(last_claim_date, 'YYYY-MM-DD') AS last_claim_date, total_claims
       FROM player_daily_rewards WHERE player_id = $1`,
    [playerId],
  );
  const row = res.rows[0] as
    | { streak: number; longest_streak: number; last_claim_date: string | null; total_claims: number }
    | undefined;
  return {
    streak: row ? Number(row.streak) : 0,
    longest_streak: row ? Number(row.longest_streak) : 0,
    last_claim_date: row?.last_claim_date ?? null,
    total_claims: row ? Number(row.total_claims) : 0,
  };
}

async function townHallLevel(playerId: string, client?: PoolClient): Promise<number> {
  const q = client ? client.query.bind(client) : query;
  const res = await q(`SELECT village_level FROM players WHERE id = $1`, [playerId]);
  const row = res.rows[0] as { village_level: number } | undefined;
  if (!row) throw notFound('Spieler nicht gefunden');
  return Number(row.village_level);
}

/** Status der täglichen Belohnung (für das Popup). */
export async function getDailyStatus(playerId: string): Promise<DailyRewardStatusResponse> {
  const config = getGameConfig();
  const today = berlinDateString();
  const thLevel = await townHallLevel(playerId);
  const row = await loadDailyRow(playerId);
  const decision = decideStreak(row.last_claim_date, row.streak, today);

  return {
    can_claim: decision.canClaim,
    streak: row.streak,
    longest_streak: row.longest_streak,
    next_streak_day: decision.nextStreak,
    streak_reset: decision.reset,
    ladder: dailyLadderView(config, thLevel),
    todays_reward: rewardForStreakDay(config, decision.nextStreak, thLevel),
  };
}

/** Holt die tägliche Belohnung ab (einmal pro Berlin-Tag). */
export async function claimDailyReward(playerId: string): Promise<DailyRewardClaimResponse> {
  const config = getGameConfig();
  const today = berlinDateString();

  return withTransaction(async (client) => {
    // Zeile sperren bzw. anlegen (Defaults), dann erneut sperren.
    await client.query(
      `INSERT INTO player_daily_rewards (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [playerId],
    );
    const locked = await client.query(
      `SELECT streak, longest_streak, to_char(last_claim_date, 'YYYY-MM-DD') AS last_claim_date, total_claims
         FROM player_daily_rewards WHERE player_id = $1 FOR UPDATE`,
      [playerId],
    );
    const r = locked.rows[0] as {
      streak: number;
      longest_streak: number;
      last_claim_date: string | null;
      total_claims: number;
    };

    const decision = decideStreak(r.last_claim_date, Number(r.streak), today);
    if (!decision.canClaim) {
      throw badRequest('Die heutige Belohnung wurde bereits abgeholt');
    }

    const thLevel = await townHallLevel(playerId, client);
    const reward: DailyRewardView = rewardForStreakDay(config, decision.nextStreak, thLevel);

    // Lager-Caps des Spielers (Ressourcen-Anteil wird gekappt; Überschuss verfällt).
    const ar = await client.query(
      `SELECT building_type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings: OwnedBuilding[] = ar.rows.map((b) => ({
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
      [
        reward.wood,
        capWood,
        reward.stone,
        capStone,
        reward.gold,
        capGold,
        reward.gems,
        reward.gold_bars,
        playerId,
      ],
    );
    const player = mapPlayer(pr.rows[0] as Record<string, unknown>);

    const newStreak = decision.nextStreak;
    const longest = Math.max(Number(r.longest_streak), newStreak);
    await client.query(
      `UPDATE player_daily_rewards
          SET streak = $1, longest_streak = $2, last_claim_date = $3::date,
              total_claims = total_claims + 1, updated_at = NOW()
        WHERE player_id = $4`,
      [newStreak, longest, today, playerId],
    );

    return { player, reward, streak: newStreak, longest_streak: longest };
  });
}
