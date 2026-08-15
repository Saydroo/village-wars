import type {
  DungeonHistoryResponse,
  DungeonStartResponse,
  DungeonStatusResponse,
  DungeonWavePreview,
  DungeonWaveResponse,
  FactionId,
  GameConfig,
  Player,
} from '@village-wars/shared';
import {
  computeDungeonReward,
  generateDungeonBoss,
  generateDungeonWave,
  makeRunSeed,
  resolveDifficulty,
  resourceCap,
  simulateDungeonWave,
  type DungeonEnemyGroup,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { logger } from '../logger';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { getPlayerById } from './playerService';
import { getReadyArmyMap } from './unitService';
import { addSeasonPassXp } from './seasonPassService';
import { mapDungeonRun, mapArmyJson, mapPlayer, DUNGEON_RUN_COLUMNS, PLAYER_COLUMNS } from './mappers';

/**
 * Dungeon-System (Phase 5, Abschnitt 9). PvE: 5 NPC-Wellen + Endboss, wöchentlich
 * Sa 05:00 → So 00:00 (Europe/Berlin). Server-autoritativ: jede Welle wird per
 * REST ausgelöst und über die reine Engine (shared/game/dungeon.ts) aufgelöst;
 * überlebende Einheiten ziehen weiter. Belohnungen (Gold/Edelsteine) nach
 * höchstem erreichten Tier. Keine Goldbarren aus dem Dungeon. Alle Zahlen aus
 * der game-config.json (dungeon, combat, units_*).
 */

// --- Zeitfenster (Europe/Berlin) ---------------------------------------------

interface BerlinParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=So .. 6=Sa
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Zerlegt einen Zeitpunkt in Europe/Berlin-Bestandteile (DST-korrekt via Intl). */
function berlinParts(now: Date): BerlinParts {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // en-US kann Mitternacht als "24" liefern
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    weekday: WD[get('weekday')] ?? 0,
  };
}

/** Verschiebung Berlin↔UTC (ms) zum gegebenen Zeitpunkt (für die Anzeige-Boundaries). */
function berlinOffsetMs(now: Date): number {
  const p = berlinParts(now);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  // now auf Minuten gerundet, damit die Sekunden sich nicht in die Differenz mischen
  const nowMin = Math.floor(now.getTime() / 60000) * 60000;
  return asUtc - nowMin;
}

/** Baut den UTC-Instant zu einer Berliner Wand-Uhrzeit (y,m,d,h:00). */
function berlinWallToInstant(y: number, m: number, d: number, h: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, 0, 0));
  const off = berlinOffsetMs(guess);
  return new Date(guess.getTime() - off);
}

function weekMinutes(weekday: number, hour: number, minute: number): number {
  return weekday * 1440 + hour * 60 + minute;
}

/** Ist der Dungeon zum Zeitpunkt `now` geöffnet (oder dev_always_open)? */
export function isDungeonOpen(config: GameConfig, now: Date = new Date()): boolean {
  if (config.dungeon.dev_always_open) return true;
  const s = config.dungeon.schedule;
  const p = berlinParts(now);
  const openMin = weekMinutes(s.open_weekday, s.open_hour, 0);
  let closeMin = weekMinutes(s.close_weekday, s.close_hour, 0);
  if (closeMin <= openMin) closeMin += 7 * 1440; // Fenster läuft über das Wochenende
  const nowMin = weekMinutes(p.weekday, p.hour, p.minute);
  return (
    (nowMin >= openMin && nowMin < closeMin) ||
    (nowMin + 7 * 1440 >= openMin && nowMin + 7 * 1440 < closeMin)
  );
}

/** Kennung des aktuellen Dungeon-Wochenendes (Datum des Öffnungstags, YYYY-MM-DD). */
function currentDungeonWeek(config: GameConfig, now: Date = new Date()): string {
  const p = berlinParts(now);
  // Tage zurück bis zum Öffnungs-Wochentag (= Samstag); dev: heutiges Datum.
  let backToOpen = (p.weekday - config.dungeon.schedule.open_weekday + 7) % 7;
  // Vor Öffnung am Öffnungstag selbst zählt noch zum Vorwochenende → eine Woche zurück.
  if (backToOpen === 0 && p.hour < config.dungeon.schedule.open_hour && !config.dungeon.dev_always_open) {
    backToOpen = 7;
  }
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() - backToOpen);
  return base.toISOString().slice(0, 10);
}

/** Anzeige-Boundaries (opens_at/closes_at) des aktuellen/nächsten Fensters. */
function windowBounds(config: GameConfig, now: Date = new Date()): { opens: string; closes: string } {
  const s = config.dungeon.schedule;
  const p = berlinParts(now);
  const open = isDungeonOpen(config, now);
  // Tage bis zum (nächsten) Öffnungs-Samstag.
  let toSat = (s.open_weekday - p.weekday + 7) % 7;
  if (open) toSat = -((p.weekday - s.open_weekday + 7) % 7); // Fenster läuft bereits → zurück zum Start
  else if (toSat === 0 && p.hour >= s.open_hour) toSat = 7; // heute Samstag, aber schon vorbei
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() + toSat);
  const opensAt = berlinWallToInstant(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), s.open_hour);
  const closesAt = new Date(opensAt.getTime() + s.duration_hours * 3600 * 1000);
  return { opens: opensAt.toISOString(), closes: closesAt.toISOString() };
}

// --- Wellen-Definitionen -----------------------------------------------------

function totalWaves(config: GameConfig): number {
  return config.dungeon.structure.waves;
}

/** Gegnergruppen einer Welle/Boss aus dem Lauf-Seed + Schwierigkeit (verborgen!). */
function enemyGroupsForWave(
  config: GameConfig,
  seed: number,
  waveNumber: number,
  difficultyId: string,
  isBoss: boolean,
): DungeonEnemyGroup[] {
  const difficulty = resolveDifficulty(config, difficultyId);
  return isBoss
    ? generateDungeonBoss(config, difficulty)
    : generateDungeonWave(config, seed, waveNumber, difficulty);
}

/** Wellen-Übersicht für den Client — Gegner sind VERBORGEN (nur Nummer + Boss-Flag). */
function wavePreview(config: GameConfig): DungeonWavePreview[] {
  const out: DungeonWavePreview[] = [];
  for (let w = 1; w <= totalWaves(config); w++) out.push({ wave: w, is_boss: false });
  if (config.dungeon.structure.final_boss) {
    out.push({ wave: totalWaves(config) + 1, is_boss: true });
  }
  return out;
}

// --- Lauf-Lebenszyklus -------------------------------------------------------

/** Gold-Lager-Cap eines Spielers (3× Lagerkapazität) innerhalb einer Transaktion. */
async function playerGoldCap(
  client: import('pg').PoolClient,
  config: GameConfig,
  playerId: string,
): Promise<number> {
  const br = await client.query(`SELECT building_type, level FROM buildings WHERE player_id = $1`, [
    playerId,
  ]);
  const buildings: OwnedBuilding[] = br.rows.map((r) => ({
    building_type: r.building_type as string,
    level: Number(r.level),
  }));
  return resourceCap(config, buildings, 'gold');
}

async function findActiveRun(playerId: string) {
  const res = await query(
    `SELECT ${DUNGEON_RUN_COLUMNS} FROM dungeon_runs
      WHERE player_id = $1 AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`,
    [playerId],
  );
  return res.rows[0] ? mapDungeonRun(res.rows[0] as Record<string, unknown>) : null;
}

async function findThisWeekRun(playerId: string, week: string) {
  const res = await query(
    `SELECT ${DUNGEON_RUN_COLUMNS} FROM dungeon_runs
      WHERE player_id = $1 AND season_week = $2 ORDER BY started_at DESC LIMIT 1`,
    [playerId, week],
  );
  return res.rows[0] ? mapDungeonRun(res.rows[0] as Record<string, unknown>) : null;
}

export async function getDungeonStatus(playerId: string): Promise<DungeonStatusResponse> {
  const config = getGameConfig();
  const now = new Date();
  const open = isDungeonOpen(config, now);
  const bounds = windowBounds(config, now);
  const week = currentDungeonWeek(config, now);

  const run = await findActiveRun(playerId);
  const weekRun = await findThisWeekRun(playerId, week);
  const completedThisWeek =
    config.dungeon.one_run_per_week && weekRun !== null && weekRun.status !== 'in_progress';

  return {
    open,
    opens_at: bounds.opens,
    closes_at: bounds.closes,
    total_waves: totalWaves(config),
    has_boss: config.dungeon.structure.final_boss,
    run,
    completed_this_week: completedThisWeek,
  };
}

export async function startDungeonRun(
  playerId: string,
  difficultyId?: string,
): Promise<DungeonStartResponse> {
  const config = getGameConfig();
  const now = new Date();
  if (!isDungeonOpen(config, now)) {
    throw badRequest('Der Dungeon ist gerade geschlossen (öffnet Sa 05:00 Europe/Berlin)');
  }
  const week = currentDungeonWeek(config, now);

  // Laufenden Lauf fortsetzen statt neu starten.
  const active = await findActiveRun(playerId);
  if (active) {
    const army = mapArmyJson(
      (
        await query(`SELECT army_remaining FROM dungeon_runs WHERE id = $1`, [active.id])
      ).rows[0]?.army_remaining,
    );
    return { run: active, waves: wavePreview(config), army };
  }

  if (config.dungeon.one_run_per_week) {
    const weekRun = await findThisWeekRun(playerId, week);
    if (weekRun && weekRun.status !== 'in_progress') {
      throw conflict('Dieses Dungeon-Wochenende wurde bereits abgeschlossen');
    }
  }

  const army = await getReadyArmyMap(playerId);
  const totalUnits = Object.values(army).reduce((s, n) => s + n, 0);
  if (totalUnits <= 0) throw badRequest('Keine Einheiten für den Dungeon — rekrutiere zuerst eine Armee');

  // Schwierigkeit auflösen (auf gültige id normalisieren) + Zufalls-Seed ziehen.
  const difficulty = resolveDifficulty(config, difficultyId);
  const seed = makeRunSeed();

  const ins = await query(
    `INSERT INTO dungeon_runs (player_id, season_week, difficulty, seed, waves_completed, boss_defeated, status, army_snapshot, army_remaining)
     VALUES ($1, $2, $3, $4, 0, FALSE, 'in_progress', $5, $5)
     RETURNING ${DUNGEON_RUN_COLUMNS}`,
    [playerId, week, difficulty.id, seed, JSON.stringify(army)],
  );
  const run = mapDungeonRun(ins.rows[0] as Record<string, unknown>);
  logger.info('Dungeon-Lauf gestartet', { playerId, runId: run.id, units: totalUnits, difficulty: difficulty.id });
  return { run, waves: wavePreview(config), army };
}

export async function completeDungeonWave(playerId: string): Promise<DungeonWaveResponse> {
  const config = getGameConfig();
  const faction = (await getPlayerById(playerId)).faction as FactionId;

  // Lauf laden (mit Armee-Snapshots + Seed) und sperren.
  const result = await withTransaction(async (client) => {
    const cur = await client.query(
      `SELECT ${DUNGEON_RUN_COLUMNS}, seed, army_snapshot, army_remaining
         FROM dungeon_runs WHERE player_id = $1 AND status = 'in_progress'
         ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [playerId],
    );
    const row = cur.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw notFound('Kein laufender Dungeon-Lauf');

    const run = mapDungeonRun(row);
    const seed = Number(row.seed);
    const snapshot = mapArmyJson(row.army_snapshot);
    const remaining = mapArmyJson(row.army_remaining);

    const total = totalWaves(config);
    const isBossWave = run.waves_completed >= total; // alle Wellen geschafft → Boss
    if (isBossWave && (!config.dungeon.structure.final_boss || run.boss_defeated)) {
      throw badRequest('Dungeon-Lauf bereits abgeschlossen');
    }
    const waveNumber = isBossWave ? total + 1 : run.waves_completed + 1;
    // Gegner deterministisch aus dem Lauf-Seed generieren (verborgen bis zum Kampf).
    const groups = enemyGroupsForWave(config, seed, waveNumber, run.difficulty, isBossWave);
    const enemiesFaced: Record<string, number> = {};
    for (const g of groups) enemiesFaced[g.unit_type] = (enemiesFaced[g.unit_type] ?? 0) + g.count;

    const sim = simulateDungeonWave(config, {
      playerArmy: remaining,
      playerFaction: faction,
      enemyGroups: groups,
      enemyFaction: config.dungeon.npc_faction as FactionId,
      captureReplay: true,
      replayIntervalTicks: config.dungeon.replay_capture_interval_ticks,
      replayMaxFrames: config.dungeon.replay_max_frames,
    });

    let wavesCompleted = run.waves_completed;
    let bossDefeated = run.boss_defeated;
    let status: 'in_progress' | 'won' | 'lost' = 'in_progress';
    const armyAfter = sim.cleared ? sim.survivors : remaining;

    if (sim.cleared) {
      if (isBossWave) {
        bossDefeated = true;
        status = 'won';
      } else {
        wavesCompleted += 1;
        // Letzte Welle ohne Boss-Phase → Lauf gewonnen.
        if (wavesCompleted >= total && !config.dungeon.structure.final_boss) status = 'won';
      }
    } else {
      status = 'lost'; // Armee aufgerieben
    }

    const finished = status !== 'in_progress';
    let rewards: DungeonWaveResponse['rewards'] = null;
    let player: Player;

    if (finished) {
      const rewardMul = resolveDifficulty(config, run.difficulty).reward_multiplier;
      const reward = computeDungeonReward(config, wavesCompleted, bossDefeated, rewardMul);
      rewards = { gold: reward.gold, gems: reward.gems, tier_label: reward.tier_label };

      // Gefallene Einheiten = Snapshot − Überlebende (best-effort von der Armee abziehen).
      const consumed: Record<string, number> = {};
      for (const [type, init] of Object.entries(snapshot)) {
        const left = armyAfter[type] ?? 0;
        const used = init - left;
        if (used > 0) consumed[type] = used;
      }

      await client.query(
        `UPDATE dungeon_runs
            SET waves_completed = $1, boss_defeated = $2, status = $3,
                gold_earned = $4, gems_earned = $5, army_remaining = $6, finished_at = NOW()
          WHERE id = $7`,
        [
          wavesCompleted,
          bossDefeated,
          status,
          reward.gold,
          reward.gems,
          JSON.stringify(armyAfter),
          run.id,
        ],
      );
      // Gold respektiert den Lager-Cap (Überschuss verfällt, Abschnitt 4) — konsistent
      // mit dem PvP-Loot und dem Ressourcen-Settlement. Ohne Kappung würde der nächste
      // /me-Tick das über dem Cap liegende Gold still wieder abräumen (Bug). Edelsteine
      // haben KEIN Lager → bleiben ungekappt (Dungeon-exklusiv, sehr selten).
      const goldCap = await playerGoldCap(client, config, playerId);
      await client.query(
        `UPDATE players SET gold = LEAST(gold + $1, $2), gems = gems + $3 WHERE id = $4`,
        [reward.gold, goldCap, reward.gems, playerId],
      );
      // Einheiten-Verbrauch außerhalb dieser Transaktion (eigene withTransaction);
      // reihenfolgenkritisch nach Commit, daher hier merken.
      if (Object.keys(consumed).length > 0) {
        // direkt im selben Client abziehen, damit alles atomar bleibt
        for (const [type, qty] of Object.entries(consumed)) {
          await client.query(
            `UPDATE units SET quantity = GREATEST(0, quantity - $1) WHERE player_id = $2 AND unit_type = $3`,
            [qty, playerId, type],
          );
        }
        await client.query(`DELETE FROM units WHERE player_id = $1 AND quantity <= 0`, [playerId]);
      }
      logger.info('Dungeon-Lauf beendet', {
        playerId,
        runId: run.id,
        status,
        wavesCompleted,
        bossDefeated,
        reward,
      });
    } else {
      await client.query(
        `UPDATE dungeon_runs SET waves_completed = $1, boss_defeated = $2, army_remaining = $3 WHERE id = $4`,
        [wavesCompleted, bossDefeated, JSON.stringify(armyAfter), run.id],
      );
    }

    const pr = await client.query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [playerId]);
    player = mapPlayer(pr.rows[0] as Record<string, unknown>);

    const updated = await client.query(
      `SELECT ${DUNGEON_RUN_COLUMNS} FROM dungeon_runs WHERE id = $1`,
      [run.id],
    );

    return {
      run: mapDungeonRun(updated.rows[0] as Record<string, unknown>),
      cleared: sim.cleared,
      wave: waveNumber,
      is_boss: isBossWave,
      enemies_faced: enemiesFaced,
      army_remaining: armyAfter,
      enemies_remaining: sim.enemiesRemaining,
      replay: sim.replay ?? { duration_seconds: 0, cleared: sim.cleared, frames: [] },
      finished,
      rewards,
      player,
    };
  });

  // Season-Pass-XP für einen siegreich abgeschlossenen Dungeon-Lauf (Roadmap P7,
  // fire-and-forget nach Commit, damit die XP-Gutschrift sichtbar ist).
  if (result.run.status === 'won') {
    addSeasonPassXp(playerId, 'dungeon_clear').catch(() => {});
  }

  return result;
}

export async function getDungeonHistory(playerId: string, limit = 20): Promise<DungeonHistoryResponse> {
  const res = await query(
    `SELECT ${DUNGEON_RUN_COLUMNS} FROM dungeon_runs WHERE player_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [playerId, limit],
  );
  return { runs: res.rows.map((r) => mapDungeonRun(r as Record<string, unknown>)) };
}

// --- Cron-Hooks (Öffnen/Schließen) ------------------------------------------

let lastOpenState: boolean | null = null;

/** Cron-Aufruf: protokolliert Öffnen/Schließen (Status wird ohnehin live berechnet). */
export function logDungeonTransition(opening: boolean): void {
  const config = getGameConfig();
  const open = isDungeonOpen(config);
  if (lastOpenState === open) return;
  lastOpenState = open;
  logger.info(opening ? 'Dungeon geöffnet' : 'Dungeon geschlossen', { open });
}

/** Bei laufender Schließung: offene Läufe als beendet markieren (Belohnung nach Stand). */
export async function closeOpenDungeonRuns(): Promise<number> {
  const config = getGameConfig();
  const open = await query(
    `SELECT ${DUNGEON_RUN_COLUMNS}, army_snapshot, army_remaining FROM dungeon_runs WHERE status = 'in_progress'`,
  );
  let count = 0;
  for (const row of open.rows as Array<Record<string, unknown>>) {
    const run = mapDungeonRun(row);
    const rewardMul = resolveDifficulty(config, run.difficulty).reward_multiplier;
    const reward = computeDungeonReward(config, run.waves_completed, run.boss_defeated, rewardMul);
    await withTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE dungeon_runs SET status = 'lost', gold_earned = $1, gems_earned = $2, finished_at = NOW()
          WHERE id = $3 AND status = 'in_progress'`,
        [reward.gold, reward.gems, run.id],
      );
      if (upd.rowCount === 0) return;
      if (reward.gold > 0 || reward.gems > 0) {
        const goldCap = await playerGoldCap(client, config, run.player_id);
        await client.query(
          `UPDATE players SET gold = LEAST(gold + $1, $2), gems = gems + $3 WHERE id = $4`,
          [reward.gold, goldCap, reward.gems, run.player_id],
        );
      }
      count += 1;
    });
  }
  if (count > 0) logger.info('Offene Dungeon-Läufe beim Schließen beendet', { count });
  return count;
}
