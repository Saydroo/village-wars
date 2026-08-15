import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { badRequest, notFound } from '../utils/httpError';
import { getResearchCost, hasResearchLab } from '@village-wars/shared';
import { incrementQuestProgress } from './questService';

/**
 * Truppen-Level-Forschung (Roadmap P3). Ein Spieler kann max. eine Einheit
 * gleichzeitig erforschen. Kosten werden sofort in Gold abgezogen; fertige
 * Forschungen erhöhen das Level in `unit_research`. Cron ruft
 * `finishDueResearch()` jede Minute auf (wie Upgrades).
 */

export interface ResearchQueueEntry {
  id: string;
  unit_type: string;
  target_level: number;
  started_at: string;
  finishes_at: string;
}

export interface ResearchStatus {
  /** Aktuell erforschte Level je Einheitstyp (fehlend = Level 1). */
  unit_levels: Record<string, number>;
  /** Laufende Forschung (null = keine). */
  active: ResearchQueueEntry | null;
}

/** Lädt den vollständigen Forschungsstand eines Spielers. */
export async function getResearchStatus(playerId: string): Promise<ResearchStatus> {
  const [levelsRes, queueRes] = await Promise.all([
    query(
      `SELECT unit_type, level FROM unit_research WHERE player_id = $1`,
      [playerId],
    ),
    query(
      `SELECT id, unit_type, target_level, started_at, finishes_at
         FROM research_queue WHERE player_id = $1`,
      [playerId],
    ),
  ]);

  // Fertige Forschungen automatisch abschließen (Settle-on-Read).
  const settled = await settleFinished(playerId);

  const unit_levels: Record<string, number> = {};
  for (const r of levelsRes.rows as Array<{ unit_type: string; level: number }>) {
    unit_levels[r.unit_type] = Number(r.level);
  }
  // Neu abgeschlossene Levels ergänzen.
  for (const [type, lvl] of Object.entries(settled)) {
    unit_levels[type] = lvl;
  }

  let active: ResearchQueueEntry | null = null;
  if (queueRes.rows.length > 0) {
    const r = queueRes.rows[0] as Record<string, unknown>;
    const finishesAt = r.finishes_at as string;
    // Nicht mehr zurückliefern, wenn es gerade im Settle abgeschlossen wurde.
    if (new Date(finishesAt) > new Date()) {
      active = {
        id: r.id as string,
        unit_type: r.unit_type as string,
        target_level: Number(r.target_level),
        started_at: r.started_at as string,
        finishes_at: finishesAt,
      };
    }
  }

  return { unit_levels, active };
}

/**
 * Startet eine Forschung für `unitType` auf das nächste Level.
 * Voraussetzungen: research_lab vorhanden, keine laufende Forschung,
 * Einheitstyp bekannt, Level < max, ausreichend Gold.
 */
export async function startResearch(playerId: string, unitType: string): Promise<ResearchStatus> {
  const config = getGameConfig();
  const maxLevel = config.unit_research.max_level;

  await withTransaction(async (client) => {
    // Spieler + Gold sperren.
    const pr = await client.query(
      `SELECT gold, village_level FROM players WHERE id = $1 FOR UPDATE`,
      [playerId],
    );
    if (!pr.rows[0]) throw notFound('Spieler nicht gefunden');
    const gold = Number((pr.rows[0] as Record<string, unknown>).gold);

    // Research-Lab prüfen.
    const bRes = await client.query(
      `SELECT building_type AS type, level FROM buildings WHERE player_id = $1`,
      [playerId],
    );
    const buildings = (bRes.rows as Array<{ type: string; level: number }>).map((b) => ({
      type: String(b.type),
      level: Number(b.level),
    }));
    if (!hasResearchLab(buildings)) {
      throw badRequest('Forschungslabor benötigt (erst bauen)');
    }

    // Keine laufende Forschung.
    const qRes = await client.query(
      `SELECT id FROM research_queue WHERE player_id = $1`,
      [playerId],
    );
    if (qRes.rows.length > 0) {
      throw badRequest('Es läuft bereits eine Forschung');
    }

    // Aktuelles Level für diesen Einheitstyp.
    const lvRes = await client.query(
      `SELECT level FROM unit_research WHERE player_id = $1 AND unit_type = $2`,
      [playerId, unitType],
    );
    const currentLevel = lvRes.rows[0] ? Number((lvRes.rows[0] as Record<string, unknown>).level) : 1;
    const targetLevel = currentLevel + 1;

    if (currentLevel >= maxLevel) {
      throw badRequest(`${unitType} ist bereits auf dem maximalen Level (${maxLevel})`);
    }

    const cost = getResearchCost(config, targetLevel);
    if (!cost) {
      throw badRequest(`Keine Kosten für Level ${targetLevel} definiert`);
    }

    if (gold < cost.gold) {
      throw badRequest(`Nicht genug Gold (benötigt: ${cost.gold}, vorhanden: ${gold})`);
    }

    // Gold abziehen.
    await client.query(
      `UPDATE players SET gold = gold - $1 WHERE id = $2`,
      [cost.gold, playerId],
    );

    const finishesAt = new Date(Date.now() + cost.minutes * 60 * 1000);

    // Forschungs-Queue-Eintrag anlegen.
    await client.query(
      `INSERT INTO research_queue (player_id, unit_type, target_level, finishes_at)
         VALUES ($1, $2, $3, $4)`,
      [playerId, unitType, targetLevel, finishesAt.toISOString()],
    );
  });

  // Status nach Commit lesen (Transaction muss committed sein, damit der neue
  // Queue-Eintrag für die separate Pool-Verbindung sichtbar ist).
  // Quest-Fortschritt: 1 Forschung gestartet.
  incrementQuestProgress(playerId, 'researches').catch(() => {});
  return getResearchStatus(playerId);
}

/** Bricht die laufende Forschung ab (kein Gold-Rückerstattung — wie in CoC). */
export async function cancelResearch(playerId: string): Promise<ResearchStatus> {
  const qRes = await query(
    `DELETE FROM research_queue WHERE player_id = $1 RETURNING unit_type, target_level`,
    [playerId],
  );
  if (qRes.rows.length === 0) {
    throw badRequest('Keine laufende Forschung');
  }
  return getResearchStatus(playerId);
}

/**
 * Schließt alle fälligen Forschungen eines Spielers ab (Settle-on-Read).
 * Gibt die neu gesetzten Levels zurück.
 */
async function settleFinished(playerId: string): Promise<Record<string, number>> {
  const done = await query(
    `DELETE FROM research_queue
      WHERE player_id = $1 AND finishes_at <= NOW()
      RETURNING unit_type, target_level`,
    [playerId],
  );
  const result: Record<string, number> = {};
  for (const r of done.rows as Array<{ unit_type: string; target_level: number }>) {
    const level = Number(r.target_level);
    await query(
      `INSERT INTO unit_research (player_id, unit_type, level)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, unit_type)
         DO UPDATE SET level = GREATEST(unit_research.level, EXCLUDED.level)`,
      [playerId, r.unit_type, level],
    );
    result[r.unit_type] = level;
  }
  return result;
}

/**
 * Cron-Job: Schließt alle weltweit fälligen Forschungen ab.
 * Läuft jede Minute (wie finishDueUpgrades).
 */
export async function finishDueResearch(): Promise<void> {
  const done = await query(
    `DELETE FROM research_queue WHERE finishes_at <= NOW()
       RETURNING player_id, unit_type, target_level`,
  );
  for (const r of done.rows as Array<{ player_id: string; unit_type: string; target_level: number }>) {
    await query(
      `INSERT INTO unit_research (player_id, unit_type, level)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, unit_type)
         DO UPDATE SET level = GREATEST(unit_research.level, EXCLUDED.level)`,
      [r.player_id, r.unit_type, Number(r.target_level)],
    );
  }
}

/**
 * Lädt die Einheits-Levels eines Spielers für die Kampfsimulation.
 * Liefert nur Einheiten mit Level > 1 (Standard ist 1, braucht kein Eintrag).
 */
export async function loadUnitLevels(playerId: string): Promise<Record<string, number>> {
  const res = await query(
    `SELECT unit_type, level FROM unit_research WHERE player_id = $1`,
    [playerId],
  );
  const out: Record<string, number> = {};
  for (const r of res.rows as Array<{ unit_type: string; level: number }>) {
    out[r.unit_type] = Number(r.level);
  }
  return out;
}
