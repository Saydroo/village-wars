import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { logger } from '../logger';

/**
 * Saison-System (Phase 5, Abschnitt 10/11). Clan-Saisons laufen 8 Wochen
 * (clan.season_reset_weeks). Beim Reset: finalen leaderboard_clan-Snapshot
 * schreiben, die Top-5-Clans mit Goldbarren belohnen (clan.leaderboard_rewards_bars),
 * season_points zurücksetzen und eine neue Saison anlegen. Goldbarren sind neben
 * Echtgeld die EINZIGE Goldbarren-Quelle (kein Pay-to-Win-Verstoß).
 *
 * Verteilung: Jedes Mitglied eines Top-5-Clans erhält den Rang-Betrag (bewusste,
 * klar dokumentierte Entscheidung — die Spec nennt nur „Belohnung für Top-5-Clans").
 */

interface ActiveSeason {
  season_number: number;
  started_at: Date;
}

async function getActiveSeason(): Promise<ActiveSeason | null> {
  const res = await query(
    `SELECT season_number, started_at FROM seasons WHERE is_active = TRUE ORDER BY season_number DESC LIMIT 1`,
  );
  const row = res.rows[0] as { season_number: number; started_at: Date } | undefined;
  return row ? { season_number: Number(row.season_number), started_at: new Date(row.started_at) } : null;
}

export interface SeasonPayout {
  clan_id: string;
  rank: number;
  bars_per_member: number;
  members_rewarded: number;
}

export interface SeasonResetResult {
  ended_season: number;
  new_season: number;
  payouts: SeasonPayout[];
}

/**
 * Cron: prüft, ob die aktive Saison ≥ season_reset_weeks alt ist, und setzt sie
 * dann zurück. Liefert das Reset-Ergebnis oder null (noch nicht fällig).
 */
export async function checkAndResetSeason(now: Date = new Date()): Promise<SeasonResetResult | null> {
  const config = getGameConfig();
  const active = await getActiveSeason();
  if (!active) {
    // Keine aktive Saison → eine anlegen (Selbstheilung).
    await query(
      `INSERT INTO seasons (season_number, started_at, is_active) VALUES (1, NOW(), TRUE)
       ON CONFLICT (season_number) DO NOTHING`,
    );
    return null;
  }
  const ageWeeks = (now.getTime() - active.started_at.getTime()) / (7 * 24 * 3600 * 1000);
  if (ageWeeks < config.clan.season_reset_weeks) return null;
  return resetSeasonNow();
}

/**
 * Führt den Saison-Reset sofort durch (vom Cron oder manuell/Tests). Idempotent
 * pro Saison über die FOR UPDATE-Sperre + is_active-Prüfung.
 */
export async function resetSeasonNow(): Promise<SeasonResetResult | null> {
  const config = getGameConfig();
  const rewards = config.clan.leaderboard_rewards_bars;

  return withTransaction(async (client) => {
    const cur = await client.query(
      `SELECT id, season_number FROM seasons WHERE is_active = TRUE
       ORDER BY season_number DESC LIMIT 1 FOR UPDATE`,
    );
    const season = cur.rows[0] as { id: number; season_number: number } | undefined;
    if (!season) return null;
    const endedSeason = Number(season.season_number);

    // 1) Finalen Snapshot aller Clans in leaderboard_clan schreiben.
    await client.query(
      `INSERT INTO leaderboard_clan (clan_id, season_points, season_number)
         SELECT id, season_points, $1 FROM clans
       ON CONFLICT (clan_id, season_number)
         DO UPDATE SET season_points = EXCLUDED.season_points, updated_at = NOW()`,
      [endedSeason],
    );

    // 2) Top-5-Clans (nur mit Punkten > 0) ermitteln und belohnen.
    const top = await client.query(
      `SELECT id, season_points FROM clans
        WHERE season_points > 0
        ORDER BY season_points DESC, total_wins DESC, created_at ASC, id
        LIMIT 5`,
    );
    const payouts: SeasonPayout[] = [];
    let rank = 0;
    for (const row of top.rows as Array<{ id: string; season_points: number }>) {
      rank += 1;
      const bars = Number(rewards[`rank_${rank}`] ?? 0);
      if (bars <= 0) continue;
      const upd = await client.query(
        `UPDATE players SET gold_bars = gold_bars + $1
          WHERE id IN (SELECT player_id FROM clan_members WHERE clan_id = $2)`,
        [bars, row.id],
      );
      payouts.push({
        clan_id: row.id,
        rank,
        bars_per_member: bars,
        members_rewarded: upd.rowCount ?? 0,
      });
    }

    // 3) season_points zurücksetzen, Saison beenden, neue Saison anlegen.
    await client.query(`UPDATE clans SET season_points = 0`);
    await client.query(
      `UPDATE seasons SET is_active = FALSE, ended_at = NOW() WHERE id = $1`,
      [season.id],
    );
    const newSeasonNumber = endedSeason + 1;
    await client.query(
      `INSERT INTO seasons (season_number, started_at, is_active) VALUES ($1, NOW(), TRUE)
       ON CONFLICT (season_number) DO UPDATE SET is_active = TRUE, started_at = NOW(), ended_at = NULL`,
      [newSeasonNumber],
    );

    logger.info('Saison zurückgesetzt', {
      endedSeason,
      newSeason: newSeasonNumber,
      rewardedClans: payouts.length,
    });
    return { ended_season: endedSeason, new_season: newSeasonNumber, payouts };
  });
}
