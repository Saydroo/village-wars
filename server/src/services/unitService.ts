import type { PoolClient } from 'pg';
import type { FactionId, Player, Unit, UnitTrainingItem } from '@village-wars/shared';
import { findUnitDefinition, getTrainCost } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { incrementQuestProgress } from './questService';
import {
  mapPlayer,
  mapTrainingItem,
  mapUnit,
  PLAYER_COLUMNS,
  UNIT_COLUMNS,
} from './mappers';

/**
 * Einheiten-Training (Phase 3). Trainings laufen zeitbasiert über
 * unit_training_queue; fertige Aufträge werden beim Lesen (oder per Cron) in die
 * units-Tabelle (fertige Armee) verschoben. Kosten/Zeit kommen aus der Config
 * inkl. Fraktions-Rabatt (unit_cost_multiplier).
 */

/** Verschiebt fällige Trainings-Aufträge in die fertige Armee (in Transaktion). */
export async function settleTrainingTx(client: PoolClient, playerId: string): Promise<void> {
  const due = await client.query(
    `DELETE FROM unit_training_queue
       WHERE player_id = $1 AND finish_at <= NOW()
     RETURNING unit_type, quantity`,
    [playerId],
  );
  for (const row of due.rows as Array<{ unit_type: string; quantity: number }>) {
    await client.query(
      `INSERT INTO units (player_id, unit_type, level, quantity)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (player_id, unit_type)
       DO UPDATE SET quantity = units.quantity + EXCLUDED.quantity`,
      [playerId, row.unit_type, Number(row.quantity)],
    );
  }
}

export interface ArmyState {
  units: Unit[];
  training: UnitTrainingItem[];
}

async function loadArmyTx(client: PoolClient, playerId: string): Promise<ArmyState> {
  const u = await client.query(
    `SELECT ${UNIT_COLUMNS} FROM units WHERE player_id = $1 AND quantity > 0 ORDER BY unit_type`,
    [playerId],
  );
  const t = await client.query(
    `SELECT id, player_id, unit_type, quantity, started_at, finish_at
       FROM unit_training_queue WHERE player_id = $1 ORDER BY finish_at`,
    [playerId],
  );
  return {
    units: u.rows.map((r) => mapUnit(r as Record<string, unknown>)),
    training: t.rows.map((r) => mapTrainingItem(r as Record<string, unknown>)),
  };
}

/** Aktuelle Armee + laufende Trainings (verrechnet fällige Trainings vorher). */
export async function getArmy(playerId: string): Promise<ArmyState> {
  return withTransaction(async (client) => {
    await settleTrainingTx(client, playerId);
    return loadArmyTx(client, playerId);
  });
}

export interface TrainResult extends ArmyState {
  player: Player;
}

/**
 * Reiht ein Einheiten-Training ein: prüft Freischaltung (Rathaus-Level), zieht
 * Ressourcen ab (inkl. Fraktions-Rabatt) und setzt finish_at.
 */
export async function trainUnits(
  playerId: string,
  unitType: string,
  quantity: number,
): Promise<TrainResult> {
  const config = getGameConfig();

  const result = await withTransaction(async (client) => {
    await settleTrainingTx(client, playerId);

    const pr = await client.query(
      `SELECT faction, village_level, wood, stone, gold FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    const p = pr.rows[0] as
      | { faction: FactionId; village_level: number; wood: string; stone: string; gold: string }
      | undefined;
    if (!p) throw notFound('Spieler nicht gefunden');

    const def = findUnitDefinition(config, unitType, p.faction);
    if (!def) throw badRequest(`Unbekannte Einheit: ${unitType}`);
    if (Number(p.village_level) < def.unlock_town_hall_level) {
      throw badRequest(
        `Einheit erst ab Rathaus-Level ${def.unlock_town_hall_level} freigeschaltet (aktuell ${p.village_level})`,
      );
    }

    const cost = getTrainCost(config, unitType, quantity, p.faction);
    if (!cost) throw badRequest('Keine Kostendaten für diese Einheit');

    if (Number(p.wood) < cost.wood || Number(p.stone) < cost.stone || Number(p.gold) < cost.gold) {
      const parts = [
        `${cost.wood} Holz`,
        `${cost.stone} Stein`,
        cost.gold ? `${cost.gold} Gold` : '',
      ].filter(Boolean);
      throw badRequest(`Nicht genug Ressourcen (benötigt: ${parts.join(', ')})`);
    }

    await client.query(
      `INSERT INTO unit_training_queue (player_id, unit_type, quantity, finish_at)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))`,
      [playerId, unitType, quantity, cost.train_time_seconds],
    );

    const upd = await client.query(
      `UPDATE players SET wood = wood - $1, stone = stone - $2, gold = gold - $3
        WHERE id = $4 RETURNING ${PLAYER_COLUMNS}`,
      [cost.wood, cost.stone, cost.gold, playerId],
    );

    const army = await loadArmyTx(client, playerId);
    return { ...army, player: mapPlayer(upd.rows[0] as Record<string, unknown>) };
  });
  // Quest-Fortschritt: N Truppen trainiert.
  incrementQuestProgress(playerId, 'troops_trained', quantity).catch(() => {});
  return result;
}

/** Entlässt Einheiten (verringert die Anzahl bzw. löscht die Zeile). */
export async function disbandUnits(
  playerId: string,
  unitId: string,
  quantity?: number,
): Promise<ArmyState> {
  return withTransaction(async (client) => {
    const res = await client.query(
      `SELECT quantity FROM units WHERE id = $1 AND player_id = $2 FOR UPDATE`,
      [unitId, playerId],
    );
    const row = res.rows[0] as { quantity: number } | undefined;
    if (!row) throw notFound('Einheit nicht gefunden');

    const have = Number(row.quantity);
    const remove = quantity === undefined ? have : Math.min(quantity, have);
    const left = have - remove;

    if (left <= 0) {
      await client.query(`DELETE FROM units WHERE id = $1 AND player_id = $2`, [unitId, playerId]);
    } else {
      await client.query(`UPDATE units SET quantity = $1 WHERE id = $2 AND player_id = $3`, [
        left,
        unitId,
        playerId,
      ]);
    }
    return loadArmyTx(client, playerId);
  });
}

/** Cron: verschiebt fällige Trainings aller Spieler in die Armee. */
export async function finishDueTraining(): Promise<number> {
  const players = await query(
    `SELECT DISTINCT player_id FROM unit_training_queue WHERE finish_at <= NOW()`,
  );
  let count = 0;
  for (const row of players.rows) {
    await withTransaction((client) => settleTrainingTx(client, row.player_id as string));
    count += 1;
  }
  return count;
}

/** Liest die fertige Armee als Record<unit_type, quantity> (für den Battle-Start). */
export async function getReadyArmyMap(playerId: string): Promise<Record<string, number>> {
  const army = await getArmy(playerId);
  const map: Record<string, number> = {};
  for (const u of army.units) map[u.unit_type] = u.quantity;
  return map;
}

/** Zieht die im Kampf verbrauchten Einheiten von der Armee ab. */
export async function consumeUnits(
  playerId: string,
  consumed: Record<string, number>,
): Promise<void> {
  await withTransaction(async (client) => {
    for (const [type, qty] of Object.entries(consumed)) {
      if (qty <= 0) continue;
      await client.query(
        `UPDATE units SET quantity = GREATEST(0, quantity - $1)
           WHERE player_id = $2 AND unit_type = $3`,
        [qty, playerId, type],
      );
    }
    await client.query(`DELETE FROM units WHERE player_id = $1 AND quantity <= 0`, [playerId]);
  });
}
