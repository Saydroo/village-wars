# Server-E2E-Tests

Permanente **End-to-End-Suite**: fährt die **echte** Express-App gegen eine **eigene**
Test-Datenbank hoch und treibt sie über echtes HTTP (`fetch`). Deckt die volle Schicht
ab — Routing, Auth-Middleware, Zod-Validierung, Services, Postgres-Persistenz und die
zentrale Fehler-Abbildung. Ersetzt die früheren **temporären** Service-/HTTP-Skripte
durch dauerhaften Regressionsschutz.

## Voraussetzung

Das **portable Test-Postgres** muss laufen (siehe [docs/STATUS.md](../../docs/STATUS.md) §2):

```powershell
$bin = "C:\Users\Ufuk\vw_pgtest\pgsql\bin"; $data = "C:\Users\Ufuk\vw_pgtest\data"
& "$bin\pg_ctl.exe" -D $data -o "-p 55432" -l "C:\Users\Ufuk\vw_pgtest\pg.log" start
```

## Ausführen

Vom Repo-Root (nach PATH-Reload für node/npm):

```bash
npm run test:server     # E2E-Suite (echte App + echtes Postgres)
npm run test:types -w @village-wars/server   # typecheckt App + Tests
```

## Funktionsweise

- **Eigene Test-DB** `village_wars_test` — wird pro Lauf **frisch** angelegt (DROP/CREATE),
  migriert und geseedet. Die Dev-DB `village_wars` wird **nie** berührt
  ([setup-env.ts](setup-env.ts) setzt `DATABASE_URL`, bevor der Server-Code lädt).
- **Ein Prozess, ein Einstieg:** [e2e.test.ts](e2e.test.ts) bündelt alle `suites/*.suite.ts`
  und umklammert sie mit `before(globalSetup)`/`after(globalTeardown)` aus
  [harness.ts](harness.ts) (DB anlegen → migrieren → seeden → App + Socket.io auf Ephemeral-Port
  booten). Solo-Matchmaking läuft; Cron + Clan-Krieg-Matchmaking bleiben aus.
- **Helfer** ([harness.ts](harness.ts)): `api()` (HTTP), `registerPlayer()`, `sql()`/`grant()`/
  `setTownHallLevel()`/`giveUnits()` (God-Mode-Setup), `connectSocket()`/`waitEvent()` (Socket-Clients).
  Test-Spieler bekommen eindeutige Namen → keine Kollisionen.
- **Abgedeckt:** Auth (register/login/refresh/401), Dorf (platzieren/upgrade/skip/inventar),
  Einheiten (training/settle/disband/gates), Clans (TH5-Gate/erstellen/beitreten/Burg-Housing/
  Leadership/Ranglisten), Dungeon (Zeitfenster/verborgene Wellen/Volldurchlauf/one-run-per-week),
  Shop+IAP (kaufen/anwenden/**Sandbox-Idempotenz**), Fehler (404/401/**22P02→400**), **Socket.io-Live-Kampf**
  (Handshake/Matchmaking/Deploy/State-Updates/Sieg+Loot/Aufgeben — [battle.suite.ts](suites/battle.suite.ts)),
  **Clan-Krieg-Duell** (`clanwar:join` → Punkte=Zerstörung, keine Trophäen/Loot — [clanwar.suite.ts](suites/clanwar.suite.ts)).

## Hinweis

Die gesamte Echtzeit-Kampf-Schicht (Solo **und** Clan-Krieg) ist abgedeckt; die reine Kampf-Engine
zusätzlich über die Shared-Tests (`npm test`).
