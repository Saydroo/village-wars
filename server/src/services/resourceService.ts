import type { PoolClient } from 'pg';
import type { FactionId, ResourceCapacities } from '@village-wars/shared';
import {
  buildingProductionPerHour,
  resourceCap,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';

/**
 * Zeitbasierte Ressourcenproduktion. Statt fester Tick-Beträge wird die seit
 * resources_updated_at verstrichene Zeit gutgeschrieben — robust gegen
 * verpasste Cron-Ticks und Server-Downtime. Fraktions-Modifikatoren und
 * Lager-Caps (Abschnitt 4) werden angewandt.
 */

const MIN_SETTLE_SECONDS = 60; // unter 1 Min keine Produktion gutschreiben (vermeidet Churn/Rundungsverluste)

export interface SettleResult {
  wood: number;
  stone: number;
  gold: number;
  capacities: ResourceCapacities;
}

/** Harte Obergrenze: Bestand + Produktion, auf den Cap gekappt (Überschuss verfällt). */
function clampToCap(current: number, produced: number, cap: number): number {
  return Math.min(Math.floor(current + produced), cap);
}

/** Settlement innerhalb einer bestehenden Transaktion (mit Zeilensperre). */
export async function settleResourcesTx(
  client: PoolClient,
  playerId: string,
): Promise<SettleResult | null> {
  const config = getGameConfig();

  const pr = await client.query(
    `SELECT faction, wood, stone, gold, resources_updated_at
       FROM players WHERE id = $1 FOR UPDATE`,
    [playerId],
  );
  const p = pr.rows[0] as
    | { faction: FactionId; wood: string; stone: string; gold: string; resources_updated_at: Date }
    | undefined;
  if (!p) return null;

  const br = await client.query(
    `SELECT building_type, level FROM buildings WHERE player_id = $1`,
    [playerId],
  );
  const buildings: OwnedBuilding[] = br.rows.map((r) => ({
    building_type: r.building_type as string,
    level: Number(r.level),
  }));

  const capacities: ResourceCapacities = {
    wood: resourceCap(config, buildings, 'wood'),
    stone: resourceCap(config, buildings, 'stone'),
    gold: resourceCap(config, buildings, 'gold'),
  };

  const rawWood = Number(p.wood);
  const rawStone = Number(p.stone);
  const rawGold = Number(p.gold);

  // 1) Harte Obergrenze IMMER durchsetzen — Überschuss verfällt (Abschnitt 4), auch
  //    wenn der Cap z.B. durch Einlagern/Entfernen eines Lagers gesunken ist.
  let wood = Math.min(rawWood, capacities.wood);
  let stone = Math.min(rawStone, capacities.stone);
  let gold = Math.min(rawGold, capacities.gold);
  const trimmed = wood !== rawWood || stone !== rawStone || gold !== rawGold;

  // 2) Zeitbasierte Produktion erst ab MIN_SETTLE_SECONDS gutschreiben (ebenfalls gekappt).
  const elapsedSeconds = (Date.now() - new Date(p.resources_updated_at).getTime()) / 1000;
  const credit = elapsedSeconds >= MIN_SETTLE_SECONDS;
  if (credit) {
    const elapsedHours = elapsedSeconds / 3600;
    let prodW = 0;
    let prodS = 0;
    let prodG = 0;
    for (const b of buildings) {
      const prod = buildingProductionPerHour(config, b.building_type, b.level, p.faction);
      prodW += prod.wood;
      prodS += prod.stone;
      prodG += prod.gold;
    }
    wood = clampToCap(wood, prodW * elapsedHours, capacities.wood);
    stone = clampToCap(stone, prodS * elapsedHours, capacities.stone);
    gold = clampToCap(gold, prodG * elapsedHours, capacities.gold);
  }

  // 3) Schreiben, wenn Produktion gutgeschrieben ODER Überschuss gekappt wurde.
  //    resources_updated_at nur beim Gutschreiben vorrücken (sonst Produktionszeit behalten).
  if (credit || trimmed) {
    await client.query(
      `UPDATE players SET wood = $1, stone = $2, gold = $3${
        credit ? ', resources_updated_at = NOW()' : ''
      } WHERE id = $4`,
      [wood, stone, gold, playerId],
    );
  }

  return { wood, stone, gold, capacities };
}

export function settlePlayerResources(playerId: string): Promise<SettleResult | null> {
  return withTransaction((client) => settleResourcesTx(client, playerId));
}

/** Berechnet nur die Kapazitäten (3× Lagerkapazität) ohne Settlement. */
export function capacitiesForBuildings(buildings: OwnedBuilding[]): ResourceCapacities {
  const config = getGameConfig();
  return {
    wood: resourceCap(config, buildings, 'wood'),
    stone: resourceCap(config, buildings, 'stone'),
    gold: resourceCap(config, buildings, 'gold'),
  };
}

/** Ressourcen-Tick für alle Spieler (Cron). Liefert Anzahl verarbeiteter Spieler. */
export async function settleAllPlayers(): Promise<number> {
  const res = await query('SELECT id FROM players');
  let count = 0;
  for (const row of res.rows) {
    await settlePlayerResources(row.id as string);
    count += 1;
  }
  return count;
}
