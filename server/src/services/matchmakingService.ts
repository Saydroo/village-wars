import type { GameConfig } from '@village-wars/shared';
import { logger } from '../logger';

/**
 * Matchmaking (Phase 3). In-Memory-Queue mit Online-Tracking und zeitbasierter
 * Toleranz-Erweiterung (Abschnitt 8 / config.pvp.matchmaking). Es werden nur
 * aktuell verbundene (Online-)Gegner gematcht; nach bot_after_seconds wird ein
 * Bot mit gespeichertem Layout erstellt.
 *
 * Bewusst in-process gehalten (ein Server-Prozess = autoritativ), damit Phase 3
 * lokal ohne Redis testbar bleibt. Das Redis-Schlüsselschema aus der Spec
 * (matchmaking:queue:{trophy_range}) ließe sich hier 1:1 hinterlegen, sobald
 * mehrere Instanzen skaliert werden — die Pairing-Logik bliebe identisch.
 */

export interface MatchOutcome {
  defenderId: string | null;
  isBot: boolean;
}

interface QueueEntry {
  playerId: string;
  trophies: number;
  joinedAt: number;
  onMatched: (outcome: MatchOutcome) => void;
}

const online = new Map<string, { trophies: number; sockets: number }>();
const queue = new Map<string, QueueEntry>();
const attacking = new Set<string>(); // Spieler, die gerade aktiv angreifen
let loopHandle: ReturnType<typeof setInterval> | null = null;

export function setPlayerOnline(playerId: string, trophies: number): void {
  const cur = online.get(playerId);
  if (cur) {
    cur.sockets += 1;
    cur.trophies = trophies;
  } else {
    online.set(playerId, { trophies, sockets: 1 });
  }
}

/** Aktualisiert die Trophäen eines Online-Spielers, ohne den Socket-Zähler zu ändern. */
export function setOnlineTrophies(playerId: string, trophies: number): void {
  const cur = online.get(playerId);
  if (cur) cur.trophies = trophies;
  const q = queue.get(playerId);
  if (q) q.trophies = trophies;
}

export function setPlayerOffline(playerId: string): void {
  const cur = online.get(playerId);
  if (!cur) return;
  cur.sockets -= 1;
  if (cur.sockets <= 0) online.delete(playerId);
  queue.delete(playerId);
}

export function markAttackStart(playerId: string): void {
  attacking.add(playerId);
}
export function markAttackEnd(playerId: string): void {
  attacking.delete(playerId);
}

export function joinQueue(
  playerId: string,
  trophies: number,
  onMatched: (outcome: MatchOutcome) => void,
): void {
  queue.set(playerId, { playerId, trophies, joinedAt: Date.now(), onMatched });
}

export function leaveQueue(playerId: string): void {
  queue.delete(playerId);
}

export function isQueued(playerId: string): boolean {
  return queue.has(playerId);
}

/** Aktuelle Toleranz für einen Wartenden anhand der verstrichenen Wartezeit. */
function currentTolerance(config: GameConfig, waitedSeconds: number): number {
  const mm = config.pvp.matchmaking;
  let tol = mm.base_tolerance_trophies;
  for (const e of mm.expansions) {
    if (waitedSeconds >= e.after_seconds) tol = e.tolerance_trophies;
  }
  return tol;
}

/** Sucht einen Online-Gegner innerhalb der Toleranz (nächster Trophäenwert zuerst). */
function findOpponent(entry: QueueEntry, tolerance: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const [pid, info] of online) {
    if (pid === entry.playerId) continue;
    if (attacking.has(pid)) continue; // greift selbst gerade an
    const diff = Math.abs(info.trophies - entry.trophies);
    if (diff <= tolerance && diff < bestDiff) {
      bestDiff = diff;
      best = pid;
    }
  }
  return best;
}

function tick(config: GameConfig): void {
  const now = Date.now();
  const botAfterMs = config.pvp.matchmaking.bot_after_seconds * 1000;

  for (const entry of [...queue.values()]) {
    const waitedSeconds = (now - entry.joinedAt) / 1000;
    const tol = currentTolerance(config, waitedSeconds);
    const opponent = findOpponent(entry, tol);

    if (opponent) {
      queue.delete(entry.playerId);
      entry.onMatched({ defenderId: opponent, isBot: false });
      continue;
    }
    if (now - entry.joinedAt >= botAfterMs) {
      queue.delete(entry.playerId);
      entry.onMatched({ defenderId: null, isBot: true });
    }
  }
}

export function startMatchmaking(config: GameConfig): void {
  if (loopHandle) return;
  const intervalMs = Math.max(250, config.pvp.matchmaking.tick_seconds * 1000);
  loopHandle = setInterval(() => {
    try {
      tick(config);
    } catch (err) {
      logger.error('Matchmaking-Tick fehlgeschlagen', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, intervalMs);
  logger.info('Matchmaking-Loop gestartet', { tick_ms: intervalMs });
}

export function stopMatchmaking(): void {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
}
