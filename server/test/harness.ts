import './setup-env'; // MUSS zuerst stehen (setzt DATABASE_URL vor pool/env)

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import { Client } from 'pg';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FactionId } from '@village-wars/shared';
import { createApp } from '../src/app';
import { pool, query, withTransaction, closePool } from '../src/db/pool';
import { loadGameConfig, getGameConfig } from '../src/gameConfig';
import { seedSkinsFromConfig } from '../src/services/shopService';
import { initSockets, getIO } from '../src/sockets';
import { startMatchmaking, stopMatchmaking } from '../src/services/matchmakingService';

/**
 * E2E-Test-Harness. Fährt die ECHTE Express-App gegen eine **eigene** Test-Datenbank
 * (`village_wars_test`) auf dem portablen Postgres (§2) hoch und treibt sie über echtes
 * HTTP (global `fetch`). Pro Lauf wird die Test-DB frisch angelegt + migriert + geseedet
 * → deterministisch und ohne die Dev-DB zu berühren. Cron/Sockets/Matchmaking werden
 * bewusst NICHT gestartet (Services werden direkt bzw. über REST getestet).
 */

const MIGRATIONS_DIR = resolve(__dirname, '../src/db/migrations');

export const cfg = loadGameConfig();

let server: Server | null = null;
export const ctx = { baseUrl: '' };

/** Admin-Verbindung zur `postgres`-DB (zum Anlegen/Verwerfen der Test-DB). */
function adminConnectionString(): { admin: string; dbName: string } {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.replace(/^\//, '') || 'village_wars_test';
  url.pathname = '/postgres';
  return { admin: url.toString(), dbName };
}

async function recreateTestDatabase(): Promise<void> {
  const { admin, dbName } = adminConnectionString();
  const client = new Client({ connectionString: admin });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Test-Postgres nicht erreichbar (${admin}). Bitte das portable Test-Postgres starten ` +
        `(siehe docs/STATUS.md §2: pg_ctl … -o "-p 55432" start). Ursprung: ${(err as Error).message}`,
    );
  }
  try {
    // Aktive Verbindungen kappen + DB neu anlegen (Postgres 13+: WITH (FORCE)).
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
  } finally {
    await client.end();
  }
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Ungültiger DB-Name: ${name}`);
  return `"${name}"`;
}

async function runMigrations(): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    await withTransaction((client) => client.query(sql));
  }
}

/** Einmaliges Setup vor allen Tests: DB neu, migrieren, seeden, App booten. */
export async function globalSetup(): Promise<void> {
  await recreateTestDatabase();
  await runMigrations(); // erste Pool-Queries → verbinden mit der frischen Test-DB
  await seedSkinsFromConfig();

  const app = createApp();
  server = createServer(app);
  // Socket.io + Matchmaking-Loop für die Live-Kampf-Tests (Cron/Clan-Krieg bleiben aus).
  initSockets(server);
  startMatchmaking(cfg);
  await new Promise<void>((res) => server!.listen(0, '127.0.0.1', res));
  const addr = server!.address();
  if (!addr || typeof addr === 'string') throw new Error('Server-Adresse unbekannt');
  ctx.baseUrl = `http://127.0.0.1:${addr.port}`;
}

export async function globalTeardown(): Promise<void> {
  disconnectAllSockets();
  stopMatchmaking();
  const io = getIO();
  if (io) await new Promise<void>((res) => io.close(() => res()));
  if (server) await new Promise<void>((res) => server!.close(() => res()));
  await closePool().catch(() => undefined);
}

// --- HTTP-Helfer -------------------------------------------------------------

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

export async function api<T = any>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(ctx.baseUrl + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* nicht-JSON (z.B. 204) */
  }
  return { status: res.status, body: body as T };
}

// --- Test-Daten-Helfer -------------------------------------------------------

let counter = 0;
export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}_${counter}`;
}

export interface TestPlayer {
  id: string;
  username: string;
  token: string;
  refreshToken: string;
}

/** Registriert einen frischen Spieler und liefert Tokens. */
export async function registerPlayer(faction: FactionId = 'humans'): Promise<TestPlayer> {
  const s = uniqueSuffix();
  const username = `u_${s}`;
  const res = await api('POST', '/api/auth/register', {
    body: { username, email: `${username}@test.dev`, password: 'password123', faction },
  });
  if (res.status !== 201) {
    throw new Error(`registerPlayer fehlgeschlagen (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    id: res.body.player.id,
    username,
    token: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
  };
}

/** Direkter SQL-Zugriff für „God-Mode"-Setup (z.B. Ressourcen/Level setzen). */
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await query(text, params as unknown[]);
  return res.rows as T[];
}

/** Setzt Rathaus-Level + village_level (z.B. fürs TH5-Clan-Gate). */
export async function setTownHallLevel(playerId: string, level: number): Promise<void> {
  await sql(`UPDATE players SET village_level = $1 WHERE id = $2`, [level, playerId]);
  await sql(`UPDATE buildings SET level = $1 WHERE player_id = $2 AND building_type = 'town_hall'`, [
    level,
    playerId,
  ]);
}

/** Gibt einem Spieler Ressourcen/Währung (für Kauf-/Upgrade-Tests). */
export async function grant(
  playerId: string,
  res: { wood?: number; stone?: number; gold?: number; gold_bars?: number; gems?: number },
): Promise<void> {
  await sql(
    `UPDATE players SET wood = COALESCE($2, wood), stone = COALESCE($3, stone),
       gold = COALESCE($4, gold), gold_bars = COALESCE($5, gold_bars), gems = COALESCE($6, gems)
     WHERE id = $1`,
    [playerId, res.wood ?? null, res.stone ?? null, res.gold ?? null, res.gold_bars ?? null, res.gems ?? null],
  );
}

/** Legt einem Spieler fertige Einheiten in die Armee (für Kampf-/Dungeon-Tests). */
export async function giveUnits(playerId: string, unitType: string, qty: number): Promise<void> {
  await sql(
    `INSERT INTO units (player_id, unit_type, level, quantity) VALUES ($1, $2, 1, $3)
     ON CONFLICT (player_id, unit_type) DO UPDATE SET quantity = units.quantity + EXCLUDED.quantity`,
    [playerId, unitType, qty],
  );
}

// --- Socket.io-Client-Helfer (Live-Kampf-Tests) ------------------------------

const openSockets = new Set<ClientSocket>();

/** Verbindet einen Socket-Client (JWT im Handshake) und wartet auf 'connect'. */
export function connectSocket(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ctx.baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    openSockets.add(socket);
    const to = setTimeout(() => reject(new Error('Socket-Connect-Timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(to);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(to);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** Wartet einmalig auf ein Socket-Event (mit Timeout). */
export function waitEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`Timeout beim Warten auf "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(to);
      resolve(payload);
    });
  });
}

export function disconnectAllSockets(): void {
  for (const s of openSockets) {
    try {
      s.disconnect();
    } catch {
      /* egal */
    }
  }
  openSockets.clear();
}

export type { ClientSocket };
export { getGameConfig };
