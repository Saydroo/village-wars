import type { PoolClient } from 'pg';
import type { Building, FactionId, InventoryItem, Village } from '@village-wars/shared';
import { getPlacementCost } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { findBuildingDefinition, getGameConfig } from '../gameConfig';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { mapBuilding, mapVillage, BUILDING_COLUMNS } from './mappers';
import { settleResourcesTx } from './resourceService';

interface QueryLike {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

const db: QueryLike = { query: (text, params) => query(text, params as unknown[]) };

/** Adaptiert einen Transaktions-Client auf die QueryLike-Schnittstelle. */
function asExec(client: PoolClient): QueryLike {
  return { query: (text, params) => client.query(text, (params ?? []) as never[]) };
}

/**
 * Legt für einen neuen Spieler das Dorf an und platziert ein Rathaus (Level 1)
 * in der Grid-Mitte. Läuft innerhalb der Registrierungs-Transaktion.
 */
export async function bootstrapNewPlayerVillage(
  client: PoolClient,
  playerId: string,
): Promise<void> {
  const villageRes = await client.query(
    `INSERT INTO villages (player_id) VALUES ($1)
     RETURNING id, grid_width, grid_height`,
    [playerId],
  );
  const village = villageRes.rows[0] as {
    id: string;
    grid_width: number;
    grid_height: number;
  };

  const centerX = Math.floor(village.grid_width / 2);
  const centerY = Math.floor(village.grid_height / 2);

  const buildingRes = await client.query(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
     VALUES ($1, 'town_hall', 1, $2, $3)
     RETURNING id`,
    [playerId, centerX, centerY],
  );
  const townHallId = (buildingRes.rows[0] as { id: string }).id;

  await client.query(`UPDATE villages SET layout = $1, updated_at = NOW() WHERE player_id = $2`, [
    JSON.stringify([{ building_id: townHallId, grid_x: centerX, grid_y: centerY }]),
    playerId,
  ]);
}

export async function getVillageWithBuildings(
  playerId: string,
): Promise<{ village: Village; buildings: Building[] }> {
  const vRes = await db.query(`SELECT * FROM villages WHERE player_id = $1`, [playerId]);
  const vrow = vRes.rows[0];
  if (!vrow) throw notFound('Dorf nicht gefunden');

  const bRes = await db.query(
    `SELECT ${BUILDING_COLUMNS} FROM buildings WHERE player_id = $1 ORDER BY grid_x + grid_y, id`,
    [playerId],
  );

  return {
    village: mapVillage(vrow),
    buildings: bRes.rows.map(mapBuilding),
  };
}

interface PlayerGridInfo {
  faction: FactionId;
  village_level: number;
  grid_width: number;
  grid_height: number;
}

async function loadPlayerGridInfo(playerId: string): Promise<PlayerGridInfo> {
  const res = await db.query(
    `SELECT p.faction, p.village_level, v.grid_width, v.grid_height
       FROM players p
       JOIN villages v ON v.player_id = p.id
      WHERE p.id = $1`,
    [playerId],
  );
  const row = res.rows[0];
  if (!row) throw notFound('Spieler/Dorf nicht gefunden');
  return {
    faction: row.faction as FactionId,
    village_level: Number(row.village_level),
    grid_width: Number(row.grid_width),
    grid_height: Number(row.grid_height),
  };
}

function assertInBounds(x: number, y: number, info: PlayerGridInfo): void {
  if (x < 0 || y < 0 || x >= info.grid_width || y >= info.grid_height) {
    throw badRequest(
      `Koordinaten außerhalb des Grids (0..${info.grid_width - 1} / 0..${info.grid_height - 1})`,
    );
  }
}

async function assertTileFree(
  playerId: string,
  x: number,
  y: number,
  excludeBuildingId?: string,
): Promise<void> {
  const res = await db.query(
    `SELECT id FROM buildings WHERE player_id = $1 AND grid_x = $2 AND grid_y = $3
       AND ($4::uuid IS NULL OR id <> $4)`,
    [playerId, x, y, excludeBuildingId ?? null],
  );
  if (res.rows.length > 0) {
    throw conflict('Auf diesem Feld steht bereits ein Gebäude');
  }
}

async function syncLayout(exec: QueryLike, playerId: string): Promise<void> {
  const res = await exec.query(
    `SELECT id, grid_x, grid_y FROM buildings WHERE player_id = $1`,
    [playerId],
  );
  const layout = res.rows.map((r) => ({
    building_id: r.id as string,
    grid_x: Number(r.grid_x),
    grid_y: Number(r.grid_y),
  }));
  await exec.query(`UPDATE villages SET layout = $1, updated_at = NOW() WHERE player_id = $2`, [
    JSON.stringify(layout),
    playerId,
  ]);
}

export async function placeBuilding(
  playerId: string,
  input: { building_type: string; grid_x: number; grid_y: number },
): Promise<Building> {
  const info = await loadPlayerGridInfo(playerId);

  const def = findBuildingDefinition(input.building_type, info.faction);
  if (!def) {
    throw badRequest(`Unbekannter Gebäudetyp: ${input.building_type}`);
  }
  const unlockLevel =
    def.kind === 'common' ? def.def.unlock_town_hall_level : def.unlock_town_hall_level;
  if (info.village_level < unlockLevel) {
    throw badRequest(
      `Gebäude erst ab Rathaus-Level ${unlockLevel} freigeschaltet (aktuell ${info.village_level})`,
    );
  }

  assertInBounds(input.grid_x, input.grid_y, info);
  await assertTileFree(playerId, input.grid_x, input.grid_y);

  // Baukosten (Stufe 1) inkl. Fraktions-Modifikatoren. null => keine Kostendaten => gratis.
  const cost = getPlacementCost(getGameConfig(), input.building_type, info.faction) ?? {
    wood: 0,
    stone: 0,
    gold: 0,
    build_time_minutes: 0,
  };

  return withTransaction(async (client) => {
    // Produktion verrechnen, damit mit aktuellem Ressourcenstand bezahlt wird.
    await settleResourcesTx(client, playerId);

    const pr = await client.query(
      `SELECT wood, stone, gold FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    const p = pr.rows[0] as { wood: string; stone: string; gold: string };
    if (Number(p.wood) < cost.wood || Number(p.stone) < cost.stone || Number(p.gold) < cost.gold) {
      const parts = [
        `${cost.wood} Holz`,
        `${cost.stone} Stein`,
        cost.gold ? `${cost.gold} Gold` : '',
      ].filter(Boolean);
      throw badRequest(`Nicht genug Ressourcen (benötigt: ${parts.join(', ')})`);
    }

    // Mit Bauzeit: startet auf Stufe 0 (im Bau), der Cron hebt nach Ablauf auf Stufe 1.
    // Ohne Bauzeit (z.B. Holzfäller/Steinbruch): sofort fertig auf Stufe 1.
    const res =
      cost.build_time_minutes > 0
        ? await client.query(
            `INSERT INTO buildings
               (player_id, building_type, level, grid_x, grid_y,
                is_upgrading, upgrade_started_at, upgrade_finish_at)
             VALUES ($1, $2, 0, $3, $4, TRUE, NOW(), NOW() + ($5 * INTERVAL '1 minute'))
             RETURNING ${BUILDING_COLUMNS}`,
            [playerId, input.building_type, input.grid_x, input.grid_y, cost.build_time_minutes],
          )
        : await client.query(
            `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
             VALUES ($1, $2, 1, $3, $4)
             RETURNING ${BUILDING_COLUMNS}`,
            [playerId, input.building_type, input.grid_x, input.grid_y],
          );

    if (cost.wood || cost.stone || cost.gold) {
      await client.query(
        `UPDATE players SET wood = wood - $1, stone = stone - $2, gold = gold - $3 WHERE id = $4`,
        [cost.wood, cost.stone, cost.gold, playerId],
      );
    }

    const building = mapBuilding(res.rows[0] as Record<string, unknown>);
    await syncLayout(asExec(client), playerId);
    return building;
  });
}

export async function moveBuilding(
  playerId: string,
  buildingId: string,
  input: { grid_x: number; grid_y: number },
): Promise<Building> {
  const owned = await db.query(
    `SELECT id FROM buildings WHERE id = $1 AND player_id = $2`,
    [buildingId, playerId],
  );
  if (owned.rows.length === 0) throw notFound('Gebäude nicht gefunden');

  const info = await loadPlayerGridInfo(playerId);
  assertInBounds(input.grid_x, input.grid_y, info);
  await assertTileFree(playerId, input.grid_x, input.grid_y, buildingId);

  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE buildings SET grid_x = $1, grid_y = $2 WHERE id = $3 AND player_id = $4
       RETURNING ${BUILDING_COLUMNS}`,
      [input.grid_x, input.grid_y, buildingId, playerId],
    );
    const building = mapBuilding(res.rows[0] as Record<string, unknown>);
    await syncLayout(asExec(client), playerId);
    return building;
  });
}

export async function deleteBuilding(playerId: string, buildingId: string): Promise<void> {
  const res = await db.query(
    `SELECT building_type FROM buildings WHERE id = $1 AND player_id = $2`,
    [buildingId, playerId],
  );
  const row = res.rows[0];
  if (!row) throw notFound('Gebäude nicht gefunden');
  if (row.building_type === 'town_hall') {
    throw badRequest('Das Rathaus kann nicht entfernt werden');
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM buildings WHERE id = $1 AND player_id = $2`, [
      buildingId,
      playerId,
    ]);
    await syncLayout(asExec(client), playerId);
  });
}

// --- Gebäude-Inventar (Erweiterung: Einlagern statt endgültigem Löschen) ---

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    building_type: row.building_type as string,
    level: Number(row.level),
    stored_at: row.stored_at instanceof Date ? row.stored_at.toISOString() : String(row.stored_at),
  };
}

/** Inhalt des Gebäude-Inventars (zuletzt eingelagert zuerst). */
export async function listInventory(playerId: string): Promise<InventoryItem[]> {
  const res = await db.query(
    `SELECT id, player_id, building_type, level, stored_at
       FROM building_inventory WHERE player_id = $1 ORDER BY stored_at DESC`,
    [playerId],
  );
  return res.rows.map(mapInventoryItem);
}

/** Lagert ein Gebäude ein (vom Grid ins Inventar). Stufe bleibt erhalten. */
export async function storeBuilding(playerId: string, buildingId: string): Promise<void> {
  const res = await db.query(
    `SELECT building_type, level, is_upgrading FROM buildings WHERE id = $1 AND player_id = $2`,
    [buildingId, playerId],
  );
  const row = res.rows[0];
  if (!row) throw notFound('Gebäude nicht gefunden');
  // Das Rathaus darf eingelagert werden (jederzeit aus dem Inventar wieder platzierbar);
  // nur das endgültige Löschen bleibt für das Rathaus gesperrt (siehe deleteBuilding).
  if (row.is_upgrading) {
    throw conflict('Gebäude im Bau/Upgrade kann nicht eingelagert werden');
  }

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO building_inventory (player_id, building_type, level) VALUES ($1, $2, $3)`,
      [playerId, row.building_type, Number(row.level)],
    );
    await client.query(`DELETE FROM buildings WHERE id = $1 AND player_id = $2`, [
      buildingId,
      playerId,
    ]);
    await syncLayout(asExec(client), playerId);
  });
}

/** Platziert ein eingelagertes Gebäude wieder aufs Grid (kostenlos, behält Stufe). */
export async function placeFromInventory(
  playerId: string,
  inventoryId: string,
  input: { grid_x: number; grid_y: number },
): Promise<Building> {
  const info = await loadPlayerGridInfo(playerId);
  assertInBounds(input.grid_x, input.grid_y, info);
  await assertTileFree(playerId, input.grid_x, input.grid_y);

  return withTransaction(async (client) => {
    const inv = await client.query(
      `SELECT building_type, level FROM building_inventory
         WHERE id = $1 AND player_id = $2 FOR UPDATE`,
      [inventoryId, playerId],
    );
    const item = inv.rows[0] as { building_type: string; level: number } | undefined;
    if (!item) throw notFound('Inventar-Gebäude nicht gefunden');

    const res = await client.query(
      `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${BUILDING_COLUMNS}`,
      [playerId, item.building_type, Number(item.level), input.grid_x, input.grid_y],
    );
    await client.query(`DELETE FROM building_inventory WHERE id = $1 AND player_id = $2`, [
      inventoryId,
      playerId,
    ]);
    const building = mapBuilding(res.rows[0] as Record<string, unknown>);
    await syncLayout(asExec(client), playerId);
    return building;
  });
}
