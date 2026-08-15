import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import {
  getHeroDef,
  getHeroLevelCost,
  heroCurrentHp,
  heroCurrentDps,
  hasHeroHall,
} from '@village-wars/shared';
import type { FactionId } from '@village-wars/shared';
import type { HeroStatusResponse } from '@village-wars/shared';

/**
 * Helden-System (Roadmap P6). Ein Held je Fraktion, persistent, regeneriert
 * sich nach Einsatz. Level-Up wie Gebäude-Upgrades (Queue, Gold-Kosten).
 * Cron schließt fällige Level-Ups ab.
 */

/** Helden-Status eines Spielers laden. */
export async function getHeroStatus(playerId: string): Promise<HeroStatusResponse> {
  const config = getGameConfig();

  // Spieler-Fraktion und Hero Hall prüfen.
  const pr = await query(
    `SELECT faction FROM players WHERE id = $1`,
    [playerId],
  );
  if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');
  const faction = (pr.rows[0] as { faction: FactionId }).faction;

  const def = getHeroDef(config, faction);
  if (!def) {
    return { hero_id: null, display_name: null, level: 0, leveling_until: null, regenerates_until: null, no_hall: false, base_hp: 0, base_dps: 0 };
  }

  // Fällige Level-Ups settlen.
  await settleFinishedLevelUps(playerId);

  const [heroRes, queueRes, bRes] = await Promise.all([
    query(`SELECT level, regenerates_at FROM heroes WHERE player_id = $1`, [playerId]),
    query(`SELECT finishes_at FROM hero_level_queue WHERE player_id = $1`, [playerId]),
    query(`SELECT building_type AS type, level FROM buildings WHERE player_id = $1`, [playerId]),
  ]);

  const buildings = (bRes.rows as Array<{ type: string; level: number }>).map((b) => ({
    type: String(b.type),
    level: Number(b.level),
  }));
  const no_hall = !hasHeroHall(buildings);

  const heroRow = heroRes.rows[0] as { level: number; regenerates_at: string | null } | undefined;
  const level = heroRow ? Number(heroRow.level) : 1;
  const regenerates_at = heroRow?.regenerates_at ?? null;

  const queueRow = queueRes.rows[0] as { finishes_at: string } | undefined;
  const leveling_until = queueRow ? new Date(queueRow.finishes_at).toISOString() : null;

  const regenerates_until =
    regenerates_at && new Date(regenerates_at) > new Date()
      ? new Date(regenerates_at).toISOString()
      : null;

  return {
    hero_id: def.id,
    display_name: def.display_name,
    level,
    leveling_until,
    regenerates_until,
    no_hall,
    base_hp: heroCurrentHp(config, faction, level),
    base_dps: heroCurrentDps(config, faction, level),
  };
}

/**
 * Startet ein Helden-Level-Up.
 * Voraussetzungen: Hero Hall vorhanden, kein Upgrade läuft, Level < max, Gold reicht.
 */
export async function startHeroLevelUp(playerId: string): Promise<HeroStatusResponse> {
  const config = getGameConfig();
  const maxLevel = config.heroes.max_level;

  await withTransaction(async (client) => {
    const pr = await client.query(
      `SELECT gold, faction FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');
    const gold = Number((pr.rows[0] as Record<string, unknown>).gold);
    const faction = (pr.rows[0] as Record<string, unknown>).faction as FactionId;

    // Hero Hall prüfen.
    const bRes = await client.query(
      `SELECT building_type AS type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings = (bRes.rows as Array<{ type: string; level: number }>).map((b) => ({
      type: String(b.type),
      level: Number(b.level),
    }));
    if (!hasHeroHall(buildings)) {
      throw badRequest('Heldenhalle benötigt (erst bauen)');
    }

    // Kein laufendes Upgrade.
    const qRes = await client.query(
      `SELECT 1 FROM hero_level_queue WHERE player_id = $1`,
      [playerId],
    );
    if (qRes.rows.length > 0) throw badRequest('Held wird bereits aufgewertet');

    // Aktuelles Level.
    const hRes = await client.query(
      `SELECT level FROM heroes WHERE player_id = $1`,
      [playerId],
    );
    const currentLevel = hRes.rows[0] ? Number((hRes.rows[0] as Record<string, unknown>).level) : 1;
    const targetLevel = currentLevel + 1;

    if (currentLevel >= maxLevel) {
      throw badRequest(`Held ist bereits auf Maximum-Level ${maxLevel}`);
    }

    const cost = getHeroLevelCost(config, targetLevel);
    if (!cost) throw badRequest(`Keine Kosten für Level ${targetLevel} definiert`);

    if (gold < cost.gold) {
      throw badRequest(`Nicht genug Gold (benötigt: ${cost.gold}, vorhanden: ${gold})`);
    }

    // Gold abziehen.
    await client.query(`UPDATE players SET gold = gold - $1 WHERE id = $2`, [cost.gold, playerId]);

    // Held anlegen falls noch nicht vorhanden.
    await client.query(
      `INSERT INTO heroes (player_id, level) VALUES ($1, 1) ON CONFLICT DO NOTHING`,
      [playerId],
    );

    const finishesAt = new Date(Date.now() + cost.minutes * 60 * 1000);
    await client.query(
      `INSERT INTO hero_level_queue (player_id, target_level, finishes_at)
         VALUES ($1, $2, $3)`,
      [playerId, targetLevel, finishesAt.toISOString()],
    );

    void faction; // genutzt für Typcheck
  });

  return getHeroStatus(playerId);
}

/** Bricht das laufende Helden-Level-Up ab. Kein Gold zurück. */
export async function cancelHeroLevelUp(playerId: string): Promise<HeroStatusResponse> {
  const res = await query(
    `DELETE FROM hero_level_queue WHERE player_id = $1 RETURNING target_level`,
    [playerId],
  );
  if (res.rows.length === 0) throw badRequest('Kein laufendes Helden-Upgrade');
  return getHeroStatus(playerId);
}

/**
 * Setzt den Helden nach einem Kampf in Regen-Modus.
 * Wird von battleService fire-and-forget gerufen.
 */
export async function setHeroRegenAfterBattle(playerId: string): Promise<void> {
  const config = getGameConfig();
  const pr = await query(`SELECT faction FROM players WHERE id = $1`, [playerId]);
  if (!pr.rows[0]) return;

  const hRes = await query(`SELECT level FROM heroes WHERE player_id = $1`, [playerId]);
  const level = hRes.rows[0] ? Number((hRes.rows[0] as Record<string, unknown>).level) : 1;
  const regenMin = (config.heroes?.regen_minutes_per_level ?? 10) * level;
  const regenAt = new Date(Date.now() + regenMin * 60 * 1000);

  await query(
    `INSERT INTO heroes (player_id, level, regenerates_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id)
       DO UPDATE SET regenerates_at = $3`,
    [playerId, level, regenAt.toISOString()],
  );
}

/**
 * Prüft ob der Held des Spielers einsatzbereit ist (keine Regen, kein Upgrade).
 * Gibt { heroId, level, stats } zurück, oder null wenn nicht verfügbar.
 */
export async function loadHeroForBattle(
  playerId: string,
): Promise<{ heroId: string; level: number; base_hp: number; base_dps: number; range_tiles: number; speed: string; splash: boolean; housing_space: number } | null> {
  const config = getGameConfig();

  const [pr, hRes, qRes, bRes] = await Promise.all([
    query(`SELECT faction FROM players WHERE id = $1`, [playerId]),
    query(`SELECT level, regenerates_at FROM heroes WHERE player_id = $1`, [playerId]),
    query(`SELECT 1 FROM hero_level_queue WHERE player_id = $1`, [playerId]),
    query(`SELECT building_type AS type, level FROM buildings WHERE player_id = $1`, [playerId]),
  ]);

  if (!pr.rows[0]) return null;
  const faction = (pr.rows[0] as { faction: FactionId }).faction;
  const def = getHeroDef(config, faction);
  if (!def) return null;

  // Heldenhalle erforderlich — sonst kein Held (konsistent mit getHeroStatus/UI).
  const buildings = (bRes.rows as Array<{ type: string; level: number }>).map((b) => ({
    type: String(b.type),
    level: Number(b.level),
  }));
  if (!hasHeroHall(buildings)) return null;

  // Levelt gerade?
  if (qRes.rows.length > 0) return null;

  // Kein heroes-Eintrag = Held auf Level 1 (Heldenhalle steht), nicht in Regen.
  // Die Zeile entsteht erst beim ersten Level-Up bzw. nach dem ersten Einsatz.
  const heroRow = hRes.rows[0] as { level: number; regenerates_at: string | null } | undefined;
  const regenAt = heroRow?.regenerates_at ?? null;
  if (regenAt && new Date(regenAt) > new Date()) return null;

  const level = heroRow ? Number(heroRow.level) : 1;
  return {
    heroId: def.id,
    level,
    base_hp: heroCurrentHp(config, faction, level),
    base_dps: heroCurrentDps(config, faction, level),
    range_tiles: def.range_tiles ?? 1,
    speed: def.speed,
    splash: def.splash_damage ?? false,
    housing_space: def.housing_space,
  };
}

/** Cron: Fällige Level-Ups global abschließen. */
export async function finishDueHeroLevelUps(): Promise<void> {
  const done = await query(
    `DELETE FROM hero_level_queue WHERE finishes_at <= NOW()
       RETURNING player_id, target_level`,
  );
  for (const r of done.rows as Array<{ player_id: string; target_level: number }>) {
    await query(
      `INSERT INTO heroes (player_id, level)
         VALUES ($1, $2)
         ON CONFLICT (player_id)
         DO UPDATE SET level = GREATEST(heroes.level, EXCLUDED.level)`,
      [r.player_id, Number(r.target_level)],
    );
  }
}

/** Settle fällige Level-Ups für einen Spieler (Settle-on-Read). */
async function settleFinishedLevelUps(playerId: string): Promise<void> {
  const done = await query(
    `DELETE FROM hero_level_queue WHERE player_id = $1 AND finishes_at <= NOW()
       RETURNING target_level`,
    [playerId],
  );
  for (const r of done.rows as Array<{ target_level: number }>) {
    await query(
      `INSERT INTO heroes (player_id, level)
         VALUES ($1, $2)
         ON CONFLICT (player_id)
         DO UPDATE SET level = GREATEST(heroes.level, EXCLUDED.level)`,
      [playerId, Number(r.target_level)],
    );
  }
}
