import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { addSeasonPassXp } from './seasonPassService';
import type { QuestType } from '@village-wars/shared';
import type { DailyQuestProgress, DailyQuestsResponse } from '@village-wars/shared';

/** UTC-Datum als ISO-String YYYY-MM-DD. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Vollständigen Quest-Status für einen Spieler laden. */
export async function getQuestStatus(playerId: string): Promise<DailyQuestsResponse> {
  const config = getGameConfig();
  const defs = config.daily_quests.definitions;
  const questDate = todayUtc();

  const res = await query(
    `SELECT quest_id, progress, claimed
       FROM daily_quest_progress
      WHERE player_id = $1 AND quest_date = $2`,
    [playerId, questDate],
  );

  const byId: Record<string, { progress: number; claimed: boolean }> = {};
  for (const r of res.rows as Array<{ quest_id: string; progress: number; claimed: boolean }>) {
    byId[r.quest_id] = { progress: Number(r.progress), claimed: Boolean(r.claimed) };
  }

  const quests: DailyQuestProgress[] = defs.map((def) => {
    const row = byId[def.id] ?? { progress: 0, claimed: false };
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      type: def.type,
      target: def.target,
      progress: row.progress,
      claimed: row.claimed,
      reward_gold: def.reward_gold,
      reward_gems: def.reward_gems,
    };
  });

  return { quests, quest_date: questDate };
}

/**
 * Inkrementiert alle Quests vom angegebenen Typ um `amount`.
 * Erzeugt Zeilen bei Bedarf (ON CONFLICT … DO UPDATE).
 * Wird aus battleService, upgradeService, trainingService, researchService gerufen.
 */
export async function incrementQuestProgress(
  playerId: string,
  type: QuestType,
  amount = 1,
): Promise<void> {
  const config = getGameConfig();
  const questDate = todayUtc();
  const matching = config.daily_quests.definitions.filter((d) => d.type === type);
  for (const def of matching) {
    await query(
      `INSERT INTO daily_quest_progress (player_id, quest_id, quest_date, progress)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (player_id, quest_id, quest_date)
         DO UPDATE SET progress = LEAST(
           daily_quest_progress.progress + $4,
           $5
         )`,
      [playerId, def.id, questDate, amount, def.target],
    );
  }
}

/**
 * Belohnung für eine abgeschlossene Quest einsammeln.
 * Voraussetzungen: quest existiert, progress >= target, noch nicht claimed.
 */
export async function claimQuest(playerId: string, questId: string): Promise<DailyQuestsResponse> {
  const config = getGameConfig();
  const def = config.daily_quests.definitions.find((d) => d.id === questId);
  if (!def) throw badRequest(`Unbekannte Quest: ${questId}`);

  const questDate = todayUtc();

  await withTransaction(async (client) => {
    const pr = await client.query(
      `SELECT id FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');

    const qr = await client.query(
      `SELECT progress, claimed FROM daily_quest_progress
        WHERE player_id = $1 AND quest_id = $2 AND quest_date = $3`,
      [playerId, questId, questDate],
    );

    const row = qr.rows[0] as { progress: number; claimed: boolean } | undefined;
    const progress = row ? Number(row.progress) : 0;
    const claimed = row ? Boolean(row.claimed) : false;

    if (progress < def.target) {
      throw badRequest('Quest noch nicht abgeschlossen');
    }
    if (claimed) {
      throw badRequest('Belohnung bereits eingesammelt');
    }

    // Belohnung gewähren.
    if (def.reward_gold > 0) {
      await client.query(`UPDATE players SET gold = gold + $1 WHERE id = $2`, [
        def.reward_gold,
        playerId,
      ]);
    }
    if (def.reward_gems > 0) {
      await client.query(`UPDATE players SET gems = gems + $1 WHERE id = $2`, [
        def.reward_gems,
        playerId,
      ]);
    }

    // Als claimed markieren.
    await client.query(
      `INSERT INTO daily_quest_progress (player_id, quest_id, quest_date, progress, claimed)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (player_id, quest_id, quest_date)
         DO UPDATE SET claimed = true`,
      [playerId, questId, questDate, progress],
    );
  });

  // Season-Pass-XP fürs Abschließen einer Quest (Roadmap P7, fire-and-forget).
  addSeasonPassXp(playerId, 'quest_claim').catch(() => {});

  return getQuestStatus(playerId);
}
