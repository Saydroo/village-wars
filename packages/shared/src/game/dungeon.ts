import type { DungeonDifficulty, FactionId, GameConfig } from '../types/gameConfig';
import type { DungeonReplay, DungeonReplayFrame } from '../types/api';
import { getUnitCombatStats } from './units';

/**
 * Reine, deterministische PvE-Wellen-Simulation (Phase 5, Abschnitt 9). Anders
 * als das PvP-Kampfsystem (combat.ts: Einheiten gegen Gebäude) ist der Dungeon
 * ein Einheiten-gegen-Einheiten-Gefecht: die Armee des Spielers gegen eine
 * NPC-Horde. Alle Werte stammen aus der GameConfig (units_common, combat,
 * dungeon, factions) — keine Zahl ist hartcodiert. Eine Welle wird komplett
 * auto-aufgelöst (server-autoritativ); überlebende Einheiten ziehen in die
 * nächste Welle weiter.
 */

const EPS = 1e-6;

interface Fighter {
  id: string;
  type: string;
  side: 'player' | 'enemy';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dps: number;
  hps: number;
  range: number;
  speed: number;
  splash: boolean;
  alive: boolean;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Eine NPC-Gegnergruppe für eine Welle (Typ + Anzahl + Stat-Skalierung). */
export interface DungeonEnemyGroup {
  unit_type: string;
  count: number;
  /** Multiplikator auf HP/Schaden (Wellen-Eskalation bzw. Boss-Verstärkung). */
  hp_multiplier?: number;
  damage_multiplier?: number;
}

export interface DungeonWaveInput {
  /** Spieler-Armee, die in die Welle zieht (unit_type -> Anzahl). */
  playerArmy: Record<string, number>;
  playerFaction: FactionId;
  enemyGroups: DungeonEnemyGroup[];
  enemyFaction: FactionId;
  /** Kampf als Replay aufzeichnen (für die Client-Animation). */
  captureReplay?: boolean;
  /** Jeden N-ten Tick aufzeichnen (Default 1). */
  replayIntervalTicks?: number;
  /** Obergrenze an Frames (Default unbegrenzt). */
  replayMaxFrames?: number;
}

export interface DungeonWaveResult {
  /** true: alle Gegner tot UND mindestens eine Spielereinheit lebt. */
  cleared: boolean;
  /** Überlebende Spielereinheiten (unit_type -> Anzahl). */
  survivors: Record<string, number>;
  /** Überlebende Gegner (unit_type -> Anzahl) — bei cleared leer. */
  enemiesRemaining: Record<string, number>;
  elapsed_seconds: number;
  /** Optional aufgezeichnete Kampf-Animation (nur wenn captureReplay gesetzt). */
  replay?: DungeonReplay;
}

// --- Geseedeter Zufall (deterministisch) -------------------------------------

/** Kleiner, schneller PRNG (mulberry32). Liefert 0..1 für einen 32-bit-Seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mischt Lauf-Seed + Wellennummer zu einem stabilen 32-bit-Seed je Welle. */
function waveSeed(runSeed: number, waveNumber: number): number {
  // einfache, stabile Hash-Kombination
  let h = (runSeed >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (waveNumber + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Liefert einen ganzzahligen Zufalls-Seed für einen neuen Lauf. */
export function makeRunSeed(rand: () => number = Math.random): number {
  return Math.floor(rand() * 0xffffffff) >>> 0;
}

// --- Schwierigkeit -----------------------------------------------------------

/** Schwierigkeitsstufe per id, sonst die Standard-Schwierigkeit (oder erste). */
export function resolveDifficulty(config: GameConfig, id: string | null | undefined): DungeonDifficulty {
  const list = config.dungeon.difficulties;
  const wanted = id ?? config.dungeon.default_difficulty;
  return list.find((d) => d.id === wanted) ?? list.find((d) => d.id === config.dungeon.default_difficulty) ?? list[0]!;
}

// --- Zufällige Wellen-Generierung (geseedet, verborgen) ----------------------

/**
 * Generiert die NPC-Gegner einer Welle deterministisch aus (runSeed, waveNumber,
 * difficulty). Budget-System: zufällige Einheiten aus dem enemy_pool werden
 * gezogen, bis das (mit Welle + Schwierigkeit skalierte) Budget aufgebraucht ist.
 * Stat-Skalierung steigt mit der Welle und der Schwierigkeit.
 */
export function generateDungeonWave(
  config: GameConfig,
  runSeed: number,
  waveNumber: number,
  difficulty: DungeonDifficulty,
): DungeonEnemyGroup[] {
  const gen = config.dungeon.wave_generation;
  const rand = mulberry32(waveSeed(runSeed, waveNumber));

  let budget =
    (gen.base_budget + gen.budget_growth_per_wave * (waveNumber - 1)) * difficulty.wave_budget_multiplier;
  const statMul =
    (1 + (gen.wave_stat_growth_per_wave_percent / 100) * (waveNumber - 1)) *
    difficulty.enemy_strength_multiplier;

  const counts: Record<string, number> = {};
  let total = 0;
  const pool = gen.enemy_pool.filter((p) => p.cost > 0);
  const cheapest = Math.min(...pool.map((p) => p.cost));

  // Ziehen, solange Budget für die günstigste Einheit reicht bzw. Mindestmenge fehlt.
  let guard = 0;
  while (guard++ < 500 && total < gen.max_enemy_units) {
    const needMore = total < gen.min_enemies_per_wave;
    if (budget < cheapest && !needMore) break;
    // Aus den noch bezahlbaren Einheiten zufällig wählen (bei Mindestmenge: günstigste erlauben).
    const affordable = needMore ? pool : pool.filter((p) => p.cost <= budget);
    if (affordable.length === 0) break;
    const pick = affordable[Math.floor(rand() * affordable.length)]!;
    counts[pick.unit_type] = (counts[pick.unit_type] ?? 0) + 1;
    total += 1;
    budget -= pick.cost;
  }

  return Object.entries(counts).map(([unit_type, count]) => ({
    unit_type,
    count,
    hp_multiplier: statMul,
    damage_multiplier: statMul,
  }));
}

/** Generiert den Endboss (Config-Boss, zusätzlich mit der Schwierigkeit skaliert). */
export function generateDungeonBoss(
  config: GameConfig,
  difficulty: DungeonDifficulty,
): DungeonEnemyGroup[] {
  const b = config.dungeon.boss;
  return [
    {
      unit_type: b.unit_type,
      count: b.count,
      hp_multiplier: b.hp_multiplier * difficulty.enemy_strength_multiplier,
      damage_multiplier: b.damage_multiplier * difficulty.enemy_strength_multiplier,
    },
  ];
}

/** Spawnt eine Seite als Fighter-Liste um einen Startpunkt (goldener Winkel). */
function spawnSide(
  config: GameConfig,
  side: 'player' | 'enemy',
  groups: DungeonEnemyGroup[],
  faction: FactionId,
  center: { x: number; y: number },
): Fighter[] {
  const out: Fighter[] = [];
  let i = 0;
  for (const g of groups) {
    const stats = getUnitCombatStats(config, g.unit_type, faction);
    if (!stats || g.count <= 0) continue;
    const hpMul = g.hp_multiplier ?? 1;
    const dmgMul = g.damage_multiplier ?? 1;
    for (let k = 0; k < g.count; k++) {
      const angle = i * 2.399963;
      const r = 0.6 + 0.25 * Math.floor(i / 6);
      const hp = Math.max(1, Math.round(stats.hp * hpMul));
      out.push({
        id: `${side === 'player' ? 'p' : 'e'}${i}`,
        type: g.unit_type,
        side,
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
        hp,
        maxHp: hp,
        dps: stats.dps * dmgMul,
        hps: stats.hps,
        range: stats.range,
        speed: stats.speed,
        splash: stats.splash,
        alive: true,
      });
      i++;
    }
  }
  return out;
}

function nearestEnemy(from: Fighter, all: Fighter[]): Fighter | null {
  let best: Fighter | null = null;
  let bestD = Infinity;
  for (const f of all) {
    if (!f.alive || f.side === from.side) continue;
    const d = dist(from.x, from.y, f.x, f.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function countAlive(list: Fighter[], side: 'player' | 'enemy'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of list) {
    if (f.alive && f.side === side) out[f.type] = (out[f.type] ?? 0) + 1;
  }
  return out;
}

/**
 * Simuliert eine komplette Dungeon-Welle (Auto-Resolve). Spieler-Armee links,
 * NPC-Horde rechts; beide rücken aufeinander zu, kämpfen bis eine Seite fällt
 * oder max_wave_seconds erreicht ist (dann zählt die Seite mit Überlebenden).
 */
export function simulateDungeonWave(
  config: GameConfig,
  input: DungeonWaveInput,
): DungeonWaveResult {
  const playerGroups: DungeonEnemyGroup[] = Object.entries(input.playerArmy)
    .filter(([, n]) => n > 0)
    .map(([unit_type, count]) => ({ unit_type, count }));

  const fighters: Fighter[] = [
    ...spawnSide(config, 'player', playerGroups, input.playerFaction, { x: 6, y: 12 }),
    ...spawnSide(config, 'enemy', input.enemyGroups, input.enemyFaction, { x: 18, y: 12 }),
  ];

  const dt = 1 / config.combat.tick_rate_per_second;
  const maxSeconds = config.dungeon.max_wave_seconds;
  const maxTicks = Math.ceil(maxSeconds * config.combat.tick_rate_per_second);
  const splashRadius = config.combat.splash_radius_tiles;
  const healRange = config.combat.healer_range_tiles;

  // Replay-Aufzeichnung (optional).
  const frames: DungeonReplayFrame[] = [];
  const interval = Math.max(1, input.replayIntervalTicks ?? 1);
  const maxFrames = input.replayMaxFrames ?? Infinity;
  const captureFrame = (t: number) => {
    if (!input.captureReplay || frames.length >= maxFrames) return;
    frames.push({
      t: Math.round(t * 100) / 100,
      units: fighters
        .filter((f) => f.alive)
        .map((f) => ({
          id: f.id,
          unit_type: f.type,
          side: f.side,
          x: Math.round(f.x * 100) / 100,
          y: Math.round(f.y * 100) / 100,
          hp: Math.round((f.hp / f.maxHp) * 100) / 100,
        })),
    });
  };
  captureFrame(0); // Startaufstellung

  let elapsed = 0;
  for (let tick = 0; tick < maxTicks; tick++) {
    const playerAlive = fighters.some((f) => f.alive && f.side === 'player');
    const enemyAlive = fighters.some((f) => f.alive && f.side === 'enemy');
    if (!playerAlive || !enemyAlive) break;

    for (const u of fighters) {
      if (!u.alive) continue;

      // Heiler: heilt nächste beschädigte verbündete Einheit in Reichweite.
      if (u.hps > 0) {
        let ally: Fighter | null = null;
        let bestD = Infinity;
        for (const o of fighters) {
          if (!o.alive || o.side !== u.side || o === u || o.hp >= o.maxHp) continue;
          const d = dist(u.x, u.y, o.x, o.y);
          if (d <= healRange && d < bestD) {
            bestD = d;
            ally = o;
          }
        }
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + u.hps * dt);
        if (u.dps <= 0) continue; // reiner Heiler greift nicht an
      }

      const foe = nearestEnemy(u, fighters);
      if (!foe) continue;
      const d = dist(u.x, u.y, foe.x, foe.y);

      if (d > u.range + EPS) {
        // Auf den Gegner zubewegen (höchstens bis auf Reichweite). + EPS: sonst bleibt
        // die Einheit exakt auf Reichweite durch Float-Rundung hängen und greift nie an.
        const step = u.speed * dt;
        if (step >= d - u.range) {
          const ratio = (d - u.range) / (d || 1);
          u.x += (foe.x - u.x) * ratio;
          u.y += (foe.y - u.y) * ratio;
        } else {
          u.x += ((foe.x - u.x) / (d || 1)) * step;
          u.y += ((foe.y - u.y) / (d || 1)) * step;
        }
      } else if (u.dps > 0) {
        // In Reichweite: angreifen (+ optional Flächenschaden).
        damage(foe, u.dps * dt);
        if (u.splash) {
          for (const o of fighters) {
            if (!o.alive || o.side === u.side || o === foe) continue;
            if (dist(foe.x, foe.y, o.x, o.y) <= splashRadius) damage(o, u.dps * dt * 0.5);
          }
        }
      }
    }
    elapsed += dt;
    if ((tick + 1) % interval === 0) captureFrame(elapsed);
  }

  const survivors = countAlive(fighters, 'player');
  const enemiesRemaining = countAlive(fighters, 'enemy');
  const cleared =
    Object.values(enemiesRemaining).every((n) => n <= 0) &&
    Object.values(survivors).some((n) => n > 0);

  captureFrame(elapsed); // Schlussbild

  const result: DungeonWaveResult = {
    cleared,
    survivors,
    enemiesRemaining,
    elapsed_seconds: Math.round(elapsed),
  };
  if (input.captureReplay) {
    result.replay = { duration_seconds: Math.round(elapsed * 100) / 100, cleared, frames };
  }
  return result;
}

function damage(f: Fighter, amount: number): void {
  if (!f.alive) return;
  f.hp -= amount;
  if (f.hp <= EPS) {
    f.hp = 0;
    f.alive = false;
  }
}

// --- Belohnungs-Logik (Abschnitt 9) -----------------------------------------

export interface DungeonReward {
  gold: number;
  gems: number;
  tier_label: string | null;
}

/**
 * Wählt die höchste erreichte Belohnungs-Stufe (reward_tiers) und würfelt die
 * Belohnung im jeweiligen Bereich aus, multipliziert mit rewardMultiplier der
 * Schwierigkeit (Albtraum gibt mehr als Leicht). randFn erlaubt deterministische
 * Tests. Liefert 0/0, wenn keine Welle abgeschlossen wurde.
 */
export function computeDungeonReward(
  config: GameConfig,
  wavesCompleted: number,
  bossDefeated: boolean,
  rewardMultiplier = 1,
  randFn: () => number = Math.random,
): DungeonReward {
  let best: GameConfig['dungeon']['reward_tiers'][number] | null = null;
  for (const tier of config.dungeon.reward_tiers) {
    if (wavesCompleted < tier.min_waves_completed) continue;
    if (tier.requires_boss && !bossDefeated) continue;
    if (!best) {
      best = tier;
      continue;
    }
    // "Höher" = mehr verlangte Wellen, Boss-Tier schlägt Nicht-Boss bei Gleichstand.
    const better =
      tier.min_waves_completed > best.min_waves_completed ||
      (tier.min_waves_completed === best.min_waves_completed &&
        Number(tier.requires_boss) > Number(best.requires_boss));
    if (better) best = tier;
  }
  if (!best) return { gold: 0, gems: 0, tier_label: null };

  const pick = (min: number, max: number) => min + Math.floor(randFn() * (max - min + 1));
  return {
    gold: Math.round(pick(best.gold_min, best.gold_max) * rewardMultiplier),
    gems: Math.round(pick(best.gems_min, best.gems_max) * rewardMultiplier),
    tier_label: best.label ?? null,
  };
}
