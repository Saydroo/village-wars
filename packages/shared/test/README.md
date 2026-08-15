# Tests — reine Spiellogik (`@village-wars/shared`)

Permanente **Regressions-Test-Suite** für die plattformunabhängige Spiellogik
(Combat-Engine, Ökonomie, Einheiten, Dungeon, Clans, Fraktionen, Render-Geometrie,
Tier-Namen). Ersetzt die früheren **temporären** Verifikations-Skripte (die nach
jeder Phase wieder gelöscht wurden) durch eine dauerhafte Absicherung — wichtig,
während die laufende Grafik-Überarbeitung gemeinsame Renderer/Logik anfasst.

## Ausführen

Vom Repo-Root (oder aus `packages/shared`), nachdem der PATH node/npm kennt (siehe
`docs/STATUS.md` §2):

```bash
npm test            # alle Tests (Node-Test-Runner via tsx)
npm run test:types  # typecheckt zusätzlich die Tests (tsconfig.test.json)
```

- **Kein Emulator, kein Postgres, kein Redis nötig** — alles sind reine Funktionen.
- Läuft über `tsx --test` (Node-eigener Test-Runner, `node:test` + `node:assert`),
  keine zusätzliche Test-Library.

## Prinzip

Die Tests laden die **echte** `server/config/game-config.json` (die eine Quelle der
Wahrheit) und leiten ihre Erwartungen **aus der Config** ab — sie schreiben keine
Spielzahlen hart fest. Geprüft wird damit die **Transformations-/Regel-Logik**
(Fraktions-Modifikatoren, Caps, Aufrundung, Tabellen-Lookups, Determinismus,
Endbedingungen), nicht eine eingefrorene Zahl. Passt man die Config an, bleiben die
Tests gültig, solange die Logik stimmt.

## Was NICHT hier liegt

Backend-Service-/HTTP-E2E (Auth, Routen, DB-Persistenz) lief bisher über temporäre
Skripte gegen das portable Test-Postgres (§2). Diese Suite deckt bewusst nur die
**reine** Logik ab; ein dauerhaftes Server-E2E wäre ein nächster, separater Schritt.
