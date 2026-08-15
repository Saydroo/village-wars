import cron from 'node-cron';
import { logger } from '../logger';
import { settleAllPlayers } from '../services/resourceService';
import { finishDueUpgrades } from '../services/upgradeService';
import { finishDueTraining } from '../services/unitService';
import { settleExpiredWars } from '../services/clanWarService';
import { closeOpenDungeonRuns, logDungeonTransition } from '../services/dungeonService';
import { checkAndResetSeason } from '../services/seasonService';
import { finishDueResearch } from '../services/researchService';
import { finishDueHeroLevelUps } from '../services/heroService';

/**
 * Cron-Jobs für Phase 2 + 3 + 4 + 5:
 *  - Ressourcen-Tick alle 5 Minuten (zeitbasiertes Settlement aller Spieler).
 *  - Abschluss fälliger Upgrades jede Minute.
 *  - Abschluss fälliger Einheiten-Trainings jede Minute (Phase 3).
 *  - Abschluss abgelaufener Clan-Kriege jede Minute (Phase 4, Sicherheitsnetz —
 *    der Krieg-Loop verrechnet ohnehin alle 2s).
 *  - Dungeon öffnen (Sa 05:00) / schließen (So 00:00), Europe/Berlin (Phase 5).
 *  - Saison-Reset-Check montags 00:00 (Europe/Berlin) — setzt nach 8 Wochen
 *    zurück und schüttet Top-5-Goldbarren aus (Phase 5).
 */
export function startJobs(): void {
  cron.schedule('*/5 * * * *', () => {
    settleAllPlayers()
      .then((n) => logger.info('Ressourcen-Tick ausgeführt', { players: n }))
      .catch((err) =>
        logger.error('Ressourcen-Tick fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  cron.schedule('* * * * *', () => {
    finishDueUpgrades()
      .then((n) => {
        if (n > 0) logger.info('Upgrades abgeschlossen', { count: n });
      })
      .catch((err) =>
        logger.error('Upgrade-Abschluss fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  cron.schedule('* * * * *', () => {
    finishDueTraining()
      .then((n) => {
        if (n > 0) logger.info('Einheiten-Trainings abgeschlossen', { players: n });
      })
      .catch((err) =>
        logger.error('Trainings-Abschluss fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  cron.schedule('* * * * *', () => {
    finishDueResearch()
      .then(() => { /* success silent */ })
      .catch((err) =>
        logger.error('Forschungs-Abschluss fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  cron.schedule('* * * * *', () => {
    finishDueHeroLevelUps()
      .then(() => { /* success silent */ })
      .catch((err) =>
        logger.error('Helden-Level-Up-Abschluss fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  cron.schedule('* * * * *', () => {
    settleExpiredWars()
      .then((n) => {
        if (n > 0) logger.info('Clan-Kriege abgeschlossen (Cron)', { count: n });
      })
      .catch((err) =>
        logger.error('Clan-Krieg-Abschluss fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  });

  // Dungeon öffnen — Samstag 05:00 Europe/Berlin (Abschnitt 9).
  cron.schedule('0 5 * * 6', () => logDungeonTransition(true), { timezone: 'Europe/Berlin' });

  // Dungeon schließen — Sonntag 00:00 Europe/Berlin: offene Läufe abrechnen.
  cron.schedule(
    '0 0 * * 0',
    () => {
      logDungeonTransition(false);
      closeOpenDungeonRuns().catch((err) =>
        logger.error('Dungeon-Schließung fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    },
    { timezone: 'Europe/Berlin' },
  );

  // Saison-Reset prüfen — Montag 00:00 Europe/Berlin (alle 8 Wochen fällig).
  cron.schedule(
    '0 0 * * 1',
    () => {
      checkAndResetSeason()
        .then((r) => {
          if (r) logger.info('Saison-Reset ausgeführt', { ended: r.ended_season, new: r.new_season });
        })
        .catch((err) =>
          logger.error('Saison-Reset fehlgeschlagen', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    },
    { timezone: 'Europe/Berlin' },
  );

  logger.info(
    'Cron-Jobs gestartet (Ressourcen-Tick 5min, Upgrade-/Trainings-/Kriegs-Abschluss 1min, Dungeon Sa/So, Saison-Reset Mo)',
  );
}
