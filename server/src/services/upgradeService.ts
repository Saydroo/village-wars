import type { Building, Player } from '@village-wars/shared';
import { getUpgradeCost, getBuildingMaxLevel, skipCostBars } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { mapBuilding, mapPlayer, BUILDING_COLUMNS, PLAYER_COLUMNS } from './mappers';
import { settleResourcesTx } from './resourceService';
import { incrementQuestProgress } from './questService';

export interface UpgradeResult {
  building: Building;
  player: Player;
}

/**
 * Startet ein Gebäude-Upgrade: validiert Stufe, zieht Ressourcen ab (inkl.
 * Fraktions-Modifikatoren aus der Config) und setzt den Bauzeit-Timer.
 */
export async function startUpgrade(playerId: string, buildingId: string): Promise<UpgradeResult> {
  const config = getGameConfig();

  const result = await withTransaction(async (client) => {
    // Erst Produktion settlen, damit mit aktuellem Ressourcenstand bezahlt wird.
    await settleResourcesTx(client, playerId);

    const br = await client.query(
      `SELECT ${BUILDING_COLUMNS} FROM buildings WHERE id = $1 AND player_id = $2 FOR UPDATE`,
      [buildingId, playerId],
    );
    const brow = br.rows[0];
    if (!brow) throw notFound('Gebäude nicht gefunden');
    if (brow.is_upgrading) throw conflict('Gebäude wird bereits aufgewertet');

    const pr = await client.query(
      `SELECT faction, wood, stone, gold FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    const p = pr.rows[0] as { faction: Player['faction']; wood: string; stone: string; gold: string };

    const type = brow.building_type as string;
    const targetLevel = Number(brow.level) + 1;

    const maxLevel = getBuildingMaxLevel(config, type);
    if (maxLevel === null) {
      throw badRequest('Für diesen Gebäudetyp sind (noch) keine Upgrade-Kosten konfiguriert');
    }
    if (targetLevel > maxLevel) {
      throw badRequest(`Maximalstufe (${maxLevel}) bereits erreicht`);
    }

    const cost = getUpgradeCost(config, type, targetLevel, p.faction);
    if (!cost) throw badRequest('Keine Upgrade-Kostentabelle für diesen Gebäudetyp');

    const wood = Number(p.wood);
    const stone = Number(p.stone);
    const gold = Number(p.gold);
    if (wood < cost.wood || stone < cost.stone || gold < cost.gold) {
      throw badRequest(
        `Nicht genug Ressourcen (benötigt: ${cost.wood} Holz, ${cost.stone} Stein, ${cost.gold} Gold)`,
      );
    }

    const upd = await client.query(
      `UPDATE buildings
          SET is_upgrading = TRUE,
              upgrade_started_at = NOW(),
              upgrade_finish_at = NOW() + ($1 * INTERVAL '1 minute')
        WHERE id = $2
      RETURNING ${BUILDING_COLUMNS}`,
      [cost.build_time_minutes, buildingId],
    );
    const pupd = await client.query(
      `UPDATE players SET wood = wood - $1, stone = stone - $2, gold = gold - $3
        WHERE id = $4
      RETURNING ${PLAYER_COLUMNS}`,
      [cost.wood, cost.stone, cost.gold, playerId],
    );

    return {
      building: mapBuilding(upd.rows[0] as Record<string, unknown>),
      player: mapPlayer(pupd.rows[0] as Record<string, unknown>),
    };
  });
  // Quest-Fortschritt: 1 Upgrade gestartet.
  incrementQuestProgress(playerId, 'upgrades').catch(() => {});
  return result;
}

/**
 * Schließt ein laufendes Upgrade sofort gegen Goldbarren ab. Kosten aus der
 * degressiven build_time_skip-Staffelung (Mindestkosten gelten).
 */
export async function skipUpgrade(playerId: string, buildingId: string): Promise<UpgradeResult> {
  const config = getGameConfig();

  return withTransaction(async (client) => {
    const br = await client.query(
      `SELECT ${BUILDING_COLUMNS} FROM buildings WHERE id = $1 AND player_id = $2 FOR UPDATE`,
      [buildingId, playerId],
    );
    const brow = br.rows[0];
    if (!brow) throw notFound('Gebäude nicht gefunden');
    if (!brow.is_upgrading || !brow.upgrade_finish_at) {
      throw badRequest('Gebäude wird nicht aufgewertet');
    }

    const remainingMinutes = Math.max(
      0,
      (new Date(brow.upgrade_finish_at as string).getTime() - Date.now()) / 60000,
    );
    const cost = skipCostBars(config, remainingMinutes);

    const pr = await client.query('SELECT gold_bars FROM players WHERE id = $1 FOR UPDATE', [
      playerId,
    ]);
    const bars = Number((pr.rows[0] as { gold_bars: string }).gold_bars);
    if (bars < cost) throw badRequest(`Nicht genug Goldbarren (benötigt: ${cost})`);

    const upd = await client.query(
      `UPDATE buildings
          SET level = level + 1, is_upgrading = FALSE,
              upgrade_started_at = NULL, upgrade_finish_at = NULL
        WHERE id = $1
      RETURNING ${BUILDING_COLUMNS}`,
      [buildingId],
    );
    const newLevel = Number((upd.rows[0] as { level: number }).level);

    if (brow.building_type === 'town_hall') {
      await client.query('UPDATE players SET village_level = $1 WHERE id = $2', [newLevel, playerId]);
    }

    const pupd = await client.query(
      `UPDATE players SET gold_bars = gold_bars - $1 WHERE id = $2 RETURNING ${PLAYER_COLUMNS}`,
      [cost, playerId],
    );

    return {
      building: mapBuilding(upd.rows[0] as Record<string, unknown>),
      player: mapPlayer(pupd.rows[0] as Record<string, unknown>),
    };
  });
}

/**
 * Schließt alle fälligen Upgrades ab (Cron, jede Minute). Hebt die Stufe an und
 * synchronisiert village_level, wenn ein Rathaus fertig wird.
 */
export async function finishDueUpgrades(): Promise<number> {
  const res = await query(
    `UPDATE buildings
        SET level = level + 1, is_upgrading = FALSE,
            upgrade_started_at = NULL, upgrade_finish_at = NULL
      WHERE is_upgrading = TRUE AND upgrade_finish_at <= NOW()
    RETURNING id, player_id, building_type, level`,
  );

  for (const r of res.rows) {
    if (r.building_type === 'town_hall') {
      await query('UPDATE players SET village_level = $1 WHERE id = $2', [
        Number(r.level),
        r.player_id,
      ]);
    }
  }
  return res.rows.length;
}
