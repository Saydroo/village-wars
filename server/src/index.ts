import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { logger } from './logger';
import { getGameConfig, loadGameConfig } from './gameConfig';
import { closePool, pingDatabase } from './db/pool';
import { closeRedis } from './redis/client';
import { startJobs } from './jobs';
import { initSockets } from './sockets';
import { startMatchmaking } from './services/matchmakingService';
import { startClanWarMatchmaking } from './services/clanWarService';
import { seedSkinsFromConfig } from './services/shopService';

async function main(): Promise<void> {
  // game-config.json beim Start laden & validieren (Fail-Fast bei fehlerhafter Config)
  loadGameConfig();

  const app = createApp();

  // HTTP-Server explizit erstellen, damit Socket.io (Phase 3) daran andocken kann.
  const server = createServer(app);
  initSockets(server);

  server.listen(env.PORT, () => {
    logger.info('Village Wars API gestartet', {
      port: env.PORT,
      env: env.NODE_ENV,
      url: `http://localhost:${env.PORT}`,
    });
  });

  // DB-Status informativ prüfen (Server startet auch ohne DB; Endpunkte melden dann 503)
  void pingDatabase().then((ok) => {
    if (ok) {
      logger.info('PostgreSQL erreichbar');
      // Skin-Katalog aus der Config in die DB spiegeln (Phase 5, idempotent).
      void seedSkinsFromConfig().catch((err) =>
        logger.error('Skin-Seed fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } else {
      logger.warn('PostgreSQL NICHT erreichbar — DB-Endpunkte werden fehlschlagen');
    }
  });

  // Cron-Jobs starten (Ressourcen-Tick, Upgrade-/Trainings-Abschluss)
  startJobs();
  // Matchmaking-Loop starten (Phase 3, in-process Queue)
  startMatchmaking(getGameConfig());
  // Clan-Krieg-Matchmaking + Kriegs-Abschluss (Phase 4, in-process)
  startClanWarMatchmaking(getGameConfig());

  const shutdown = (signal: string) => {
    logger.info(`Shutdown (${signal}) — schließe Verbindungen`);
    server.close(async () => {
      await closePool().catch(() => undefined);
      await closeRedis().catch(() => undefined);
      process.exit(0);
    });
    // Hartes Timeout, falls Verbindungen hängen
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fataler Startfehler', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
