/**
 * botfull_presence.ts — PRÄSENZ-CONNECTOR für den Vollbasis-Bot "botfull".
 *
 * Zweck: hält den Spieler `botfull` (80-Gebäude-Kopie des emuclan-Layouts) als
 * ONLINE-Verteidiger im Matchmaking, ohne selbst je anzugreifen. Ohne diese
 * Präsenz findet ein Angreifer keinen Online-Gegner in Reichweite und bekommt
 * nach `bot_after_seconds` (90s) einen zufälligen Ein-Gebäude-Bot statt botfull.
 *
 * Wie: öffnet EINE Socket.io-Verbindung mit einem serverseitig signierten
 * botfull-Access-Token (gleiches JWT-Secret wie das Backend → kein Passwort
 * nötig). Der Server ruft beim Connect `setPlayerOnline(botfull)` auf; damit ist
 * botfull als Verteidiger matchbar (matchmakingService.findOpponent). Es wird
 * BEWUSST kein `matchmaking:join` gesendet — botfull verteidigt nur, greift nie an.
 *
 * Robustheit (der Grund, warum das jetzt als sessionfester Daemon läuft):
 *   - Token wird bei JEDEM (Re-)Connect frisch über den auth-Callback signiert.
 *     Der Server prüft nur beim Handshake → eine stehende Verbindung kann durch
 *     den 15m-Ablauf NICHT brechen, und jeder Reconnect nutzt automatisch ein
 *     frisches Token.
 *   - Auto-Reconnect unbegrenzt: Backend-Neustarts/kurze Ausfälle werden
 *     überbrückt (der Connector verbindet sich neu, sobald das Backend wieder da ist).
 *   - Beim Start wird gewartet, bis die botfull-ID aus der DB steht (PG ist evtl.
 *     noch nicht hochgefahren).
 *   - Der Prozess bleibt am Leben (Socket + Heartbeat-Timer) → die Scheduled Task
 *     VW_BotPresence bleibt "Running"; stirbt der Prozess doch, startet die Task neu.
 *
 * Start (cwd = server/, damit dotenv server/.env mit dem passenden Secret lädt):
 *   npm run presence -w @village-wars/server
 * Als Daemon:  botpresence-daemon.ps1  (Scheduled Task VW_BotPresence, via dev-up.ps1)
 */
import { Client } from 'pg';
import { io, type Socket } from 'socket.io-client';
import { env } from '../src/env';
import { signAccessToken } from '../src/utils/jwt';

const USERNAME = 'botfull';
const BACKEND_URL = process.env.PRESENCE_BACKEND_URL ?? `http://localhost:${env.PORT}`;
const DB = env.DATABASE_URL || 'postgresql://postgres@localhost:55432/village_wars';

function log(msg: string, extra?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const tail = extra ? ' ' + JSON.stringify(extra) : '';
  // eslint-disable-next-line no-console
  console.log(`[botfull-presence ${ts}] ${msg}${tail}`);
}

/** botfull-Spieler-ID holen; wartet (mit Backoff), bis die DB erreichbar ist. */
async function resolveBotfullId(): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const c = new Client({ connectionString: DB });
    try {
      await c.connect();
      const { rows } = await c.query('SELECT id FROM players WHERE username = $1', [USERNAME]);
      if (!rows.length) throw new Error(`Spieler "${USERNAME}" existiert nicht in der DB`);
      const id = (rows[0] as { id: string }).id;
      log('botfull-ID aufgelöst', { id });
      return id;
    } catch (err) {
      log(`DB-Lookup fehlgeschlagen (Versuch ${attempt}) — neuer Versuch in 3s`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise((r) => setTimeout(r, 3000));
    } finally {
      await c.end().catch(() => undefined);
    }
  }
}

async function main(): Promise<void> {
  log('Starte Präsenz-Connector', { backend: BACKEND_URL, db: DB.replace(/:[^:@/]*@/, ':***@') });
  const botfullId = await resolveBotfullId();

  const socket: Socket = io(BACKEND_URL, {
    // Frischer Token bei JEDEM (Re-)Connect — der 15m-Ablauf kann die Präsenz nie brechen.
    auth: (cb: (data: { token: string }) => void) => cb({ token: signAccessToken(botfullId) }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 8000,
  });

  socket.on('connect', () => {
    log('ONLINE — botfull ist jetzt als Verteidiger matchbar', {
      socketId: socket.id,
      backend: BACKEND_URL,
    });
  });
  socket.on('disconnect', (reason: string) => {
    log('getrennt — Auto-Reconnect folgt', { reason });
  });
  socket.io.on('reconnect', (n: number) => {
    log('reconnected', { attempt: n });
  });
  socket.on('connect_error', (err: Error) => {
    // Erwartbar, solange das Backend (noch) nicht erreichbar ist — der Manager versucht es weiter.
    log('connect_error — erneuter Versuch', { error: err.message });
  });

  // Heartbeat, damit der Task-Status/Log sichtbar bleibt, dass die Präsenz steht.
  setInterval(() => {
    log(socket.connected ? 'heartbeat: verbunden (online)' : 'heartbeat: getrennt (Reconnect läuft)');
  }, 60_000);

  const shutdown = (sig: string) => {
    log('Shutdown', { sig });
    socket.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main().catch((err) => {
  log('FATAL', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
