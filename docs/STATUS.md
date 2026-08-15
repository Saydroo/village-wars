# Village Wars — Projekt-Status & Handoff

> **Zweck:** Diese Datei fasst den kompletten Stand zusammen, damit in einer neuen
> Claude-Code-Session nahtlos weitergearbeitet werden kann. **Bei Sessionstart
> zuerst diese Datei lesen**, dann [BRIEFING.md](../BRIEFING.md) (die vollständige Spec)
> und [README.md](../README.md) (Setup).

**Stand:** 2026-06-28 · **Fertig:** Phase 1–6 + Politur · **Programm „CoC-Level"** ([ROADMAP.md](ROADMAP.md), 10 Pillars): **P1–P9 FERTIG + Emulator-verifiziert**; **Limited-Time-Events (P7-Folge) FERTIG + Emulator-verifiziert**. **Grafik-Track (P10) parallel aktiv** (wartet auf Sprites). Test-Suiten: **208 Shared** + **170 Server-E2E** (`npm test` / `npm run test:server`). DB **Migration 020**. · **Als Nächstes:** P10-Sprites sobald geliefert; sonst Politur/Balance — Retention-/Sozial-/Tiefe-Pillars sind alle fertig.

---

## 1. Projektüberblick

- **Was:** Mobiles Aufbau-/Echtzeit-PvP-Strategiespiel (Clash of Clans × Age of Empires).
- **Spec:** [BRIEFING.md](../BRIEFING.md) ist die **einzige Quelle der Wahrheit**. 6 Phasen
  (siehe Abschnitt 16 + die „Befehle" am Dateianfang).
- **Projektordner:** `C:\Users\Ufuk\Claude Code\Village-Wars`
- **Monorepo (npm workspaces):** `apps/mobile` (Expo/React Native + Skia),
  `packages/shared` (TS-Typen, Validierung, reine Spiel-Logik), `server` (Express/PG/Redis).
- **Eiserne Regel:** **Alle Zahlenwerte leben in `server/config/game-config.json`** —
  niemals hartcodieren. Backend lädt sie beim Start, liefert sie via `GET /api/config`,
  App cached sie. Fraktions-Modifikatoren werden bei **jeder** Berechnung angewandt.

---

## 2. Umgebung (WICHTIG — diese Maschine)

- **Node:** v26.3.1 installiert unter `C:\Program Files\nodejs`, npm 11.x.
  ⚠️ **Node ist NICHT im Shell-PATH der Tool-Sessions.** Jeder PowerShell-Befehl, der
  node/npm braucht, muss den PATH zuerst neu laden:
  ```powershell
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  ```
- **Kein Docker, kein system-PostgreSQL, kein psql im PATH.**
- **Portable Test-PostgreSQL 17.2** liegt unter `C:\Users\Ufuk\vw_pgtest` (vom Nutzer
  ausdrücklich behalten). Kein Dienst, kein Admin. Bedienung:
  ```powershell
  $bin = "C:\Users\Ufuk\vw_pgtest\pgsql\bin"; $data = "C:\Users\Ufuk\vw_pgtest\data"
  & "$bin\pg_ctl.exe" -D $data -o "-p 55432" -l "C:\Users\Ufuk\vw_pgtest\pg.log" start   # starten
  & "$bin\pg_ctl.exe" -D $data stop -m fast                                              # stoppen
  & "$bin\psql.exe" -h localhost -p 55432 -U postgres -d village_wars -c "\dt"           # psql
  ```
  Port **55432**, User `postgres` (trust-Auth, kein Passwort), DB `village_wars`
  (migriert, enthält ein paar Test-Spieler). `server/.env` zeigt bereits darauf.
- **Redis:** nicht installiert, lazy. **Auch Phase 3 läuft ohne Redis** — Matchmaking + Battle-State
  sind bewusst in-process (siehe §5). Redis würde erst beim Multi-Instanz-Skalieren nötig.

### Standard-Workflow-Befehle (aus dem Repo-Root, nach PATH-Reload)
```powershell
npm install                                   # alle Workspaces (mobile = groß)
npm run typecheck --workspace @village-wars/shared
npm run typecheck --workspace @village-wars/server
npm run typecheck --workspace @village-wars/mobile
$env:DATABASE_URL="postgresql://postgres@localhost:55432/village_wars"
npm run migrate --workspace @village-wars/server      # Migrationen anwenden
npm run dev:server                            # Backend (tsx watch) auf :4000
cd apps/mobile; npm start                     # Expo (Gerät: EXPO_PUBLIC_API_URL = LAN-IP)
```

---

## 3. Was ist fertig

### Phase 1 — Fundament ✅ (Typecheck + E2E gegen echtes PG verifiziert)
- Monorepo, `tsconfig.base.json`, npm workspaces, `.gitignore`, `.env.example`(s), README.
- **DB-Migrations:** `server/src/db/migrations/001_initial_schema.sql` (alle Tabellen aus
  Briefing Abschnitt 3). Eigener Runner `server/src/db/migrate.ts` (`schema_migrations`-Tabelle,
  jede `.sql` in Transaktion). Zirkulärer FK `players.clan_id ↔ clans` per `ALTER TABLE` am Ende.
- **Auth:** JWT (Access/Refresh), E-Mail-Register/Login (bcryptjs), Apple/Google OAuth-Verifizierung.
- **Endpunkte:** `/api/health`, `/api/config`, `/api/auth/*`, `/api/player/me`,
  `/api/player/faction`, `/api/village/:playerId`, `/api/village/buildings` (POST/PATCH move/DELETE).
- Querschnitt: helmet, cors, rate-limit, zentrales Error-Handling, strukturiertes Logging,
  graceful shutdown, lazy Redis-Client.

### Phase 2 — Dorf ✅ (Backend E2E verifiziert; Frontend nur typgeprüft, **nicht** auf Gerät)
- **Shared-Logikschicht** `packages/shared/src/game/`: `factions.ts` (Modifikator-Helfer),
  `economy.ts` (Produktion, Lager-Cap, Upgrade-Kosten, Skip-Kosten), `render.ts`
  (Iso-Geometrie `gridToScreen`/`screenToGrid`, Tier-/Farbsystem `lerpColor`, Auren-Schwellen),
  `tierNames.ts` (Abschnitt 13).
- **Backend:**
  - Migration `002_resource_tick.sql` → `players.resources_updated_at`.
  - `resourceService.ts`: **zeitbasiertes** Settlement (Produktion = Rate × verstrichene Zeit),
    Fraktionsbonus, Cap = 3× Lagerkapazität, Settle-on-Read + Settle-all (Cron).
  - `upgradeService.ts`: `startUpgrade` (Kosten/Zeit aus Config + Fraktions-Mod.),
    `skipUpgrade` (Goldbarren, degressiv), `finishDueUpgrades` (Cron, synct `village_level`).
  - `jobs/index.ts`: node-cron — Ressourcen-Tick alle 5 min, Upgrade-Abschluss jede Minute.
  - Neue Routen: `POST /api/village/buildings/:id/upgrade/start` + `/skip`.
    `GET /api/player/me` verrechnet jetzt Produktion und liefert `capacities`.
- **Frontend (Expo/Skia):** `rendering/buildingSprite.tsx` (Iso-Gebäude, konstante Größe,
  Material/Dach/Gold/Magie/Aura je Level), `components/village/` (VillageCanvas mit Pan +
  Tap→Grid, ResourceHeader, PlacementBar, BuildingInfoSheet), `screens/VillageScreen.tsx` +
  `screens/AuthScreen.tsx` (Dev-Login), Zustand-Store, erweiterter API-Client, `App.tsx`.

**Verifikation:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. Backend Phase 1 & 2 per HTTP-E2E
gegen echtes Postgres geprüft (Register→Dorf, CRUD, Upgrade start/skip, Produktion, Cap,
Riesen-Modifikatoren exakt, Cron-Abschluss).

### Phase 3 — Kampf ✅ (Backend E2E gegen echtes PG verifiziert; Frontend nur typgeprüft, **nicht** auf Gerät)
- **Shared-Logik** `packages/shared/src/`:
  - `game/units.ts`: Einheiten-Definitionen (gemeinsam + fraktionsexklusiv), Trainingskosten/-zeit
    (inkl. `unit_cost_multiplier`), Kampfwerte mit Fraktions-Modifikatoren (HP/Schaden/Speed,
    melee/ranged, attack_speed).
  - `game/combat.ts`: **reine, deterministische Echtzeit-Engine** — `initBattleState`, `deployUnit`,
    `stepBattle` (Bewegung, Zielwahl, Nah-/Fernkampf, Verteidigungstürme feuern, Splash, Heiler),
    `determineResult`, `computeLoot`, `computeTrophyDelta`, `defenderTrophyDelta`, `toStateUpdate`.
    Gebäude-HP/-DPS aus Config + Fraktions-Mod. (building_hp/wall_hp).
  - `types/combat.ts`: Battle-State + Socket-Payloads. Validierung: `trainUnitsSchema`,
    `disbandUnitsSchema`, `deployUnitSchema`.
- **Backend:**
  - Migration `004_unit_training.sql` (`unit_training_queue`, Unique-Index `units(player_id,unit_type)`,
    `battles.is_bot_defender`) + `005_fix_battle_result_length.sql` (`battles.result` → VARCHAR(20)).
  - `unitService.ts`: zeitbasiertes Training (Settle-on-Read + Cron), `getArmy`, `trainUnits`,
    `disbandUnits`, `consumeUnits` (Verbrauch nach Kampf).
  - `matchmakingService.ts`: **in-memory** Queue mit Online-Tracking + zeitbasierter Toleranz-
    Erweiterung (±100→±200 nach 30s→±500 nach 60s) + Bot-Fallback nach 90s. Bewusst in-process
    (ein Server = autoritativ), damit lokal **ohne Redis** testbar — siehe §5.
  - `battleService.ts`: Battle-Lebenszyklus — Verteidiger-Layout/Bot laden, Tick-Loop (server-
    autoritativ), Deploy, Aufgeben, Abschluss (Loot 20 % gedeckelt, Trophäen-Delta, `battles`-Zeile,
    `leaderboard_solo`-Upsert, Einheiten-Verbrauch).
  - `sockets/index.ts`: JWT-Handshake-Auth + Events (Abschnitt 8): `matchmaking:join/cancel`,
    `battle:start/deploy_unit/surrender` ↔ `matchmaking:matched`, `battle:setup/state_update/ended/error`.
  - REST: `GET /api/units/me`, `POST /api/units/train`, `DELETE /api/units/:id`,
    `POST /api/battle/find` (verweist auf Socket-Transport), `GET /api/battle/history`.
  - `index.ts` nutzt jetzt `http.createServer(app)` + Socket.io; Cron um Trainings-Abschluss erweitert.
- **Frontend (Expo):** `api/socket.ts` (socket.io-client-Wrapper), Store um Armee-/Kampf-State +
  Aktionen erweitert, `screens/BattleScreen.tsx` (Suche→Vorschau→Kampf→Ende), `components/battle/`
  (BattleCanvas mit Skia-Live-Rendering + Tap-Deploy, DeployBar), `components/units/ArmyPanel.tsx`
  (Rekrutierung), VillageScreen-Buttons „⚔️ Angreifen" + „🛡 Armee".

**Verifikation Phase 3:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. Reine Engine per Logik-
Smoke-Test geprüft (Loot exakt 20 %, Trophäen-Deltas exakt Abschnitt 8: +28/+35/+18/−14/−30).
Voller Socket-E2E gegen echtes PG: 2 Spieler online → Matchmaking-Match → Deploy 40 Milizionäre →
Sieg bei 99 % → Loot gutgeschrieben+gedeckelt (Angreifer +1000/+600), beim Verteidiger abgezogen,
Armee verbraucht, `battles`-Zeile + Historie persistiert, +28 Trophäen. Socket.io = `4.8.3`
(Server), `socket.io-client` (App).

**Emulator-Verifikation Phase 3 ✅ (2026-06-20, nativer Dev-Build auf `vw_pixel`):** Kompletter
Flow visuell + interaktiv geprüft — Login → Dorf → **Armee-Panel** (nur Milizionär auf TH1 frei,
restliche korrekt 🔒, Hauptmann ★ exklusiv; +5 trainiert → Holz 3000→2850, „im Training: 5") →
**⚔️ Angreifen** → Matchmaking matcht echten Online-Gegner (kein Bot, `is_bot_defender=f`) →
**Setup-Vorschau** (humans · 9 Gebäude) → **Live-Kampf** (Skia: Einheiten-Marker + HP-Balken,
Gebäude-HP, Zerstörung 0→5→52→100 %, Timer, Reserve ×35→×0) → **🏆 Sieg!** (Beute 1600/1000 =
exakt 20 %, +28 Trophäen) → zurück im Dorf mit gutgeschriebener Beute (Holz 4450, Stein 3000) und
verbrauchter Armee (🛡 0). DB bestätigt: Loot beim Verteidiger abgezogen, `battles`-Zeile persistiert.

**Weitere Kampf-Tests auf dem Emulator ✅ (2026-06-20):**
- **Niederlage (Angreifer):** Mini-Armee (3 Milizionäre) gegen starke Verteidigung → alle sterben,
  Kampf endet früh, „💀 Niederlage", −23 Trophäen, **kein Loot**. Gleichzeitig **Verteidiger-Sieg-Pfad**
  geprüft: emudef gewann als Verteidiger +12 Trophäen (`defenderTrophyDelta`).
- **Verteidiger-Rolle:** emu1 (online, im Dorf) wurde von einem headless-Angreifer angegriffen und
  **geplündert** — Holz/Stein −20 % (4450→3560 / 3000→2400), Trophäen −5; `battles`-Zeile mit
  `defender_id=emu1`; Auto-Refresh zeigt den reduzierten Stand im Dorf.
- **Bot-Fallback:** Angriff ohne Online-Gegner → nach 90s Bot-Match (nutzt gespeichertes Layout eines
  echten Spielers, `is_bot_defender=true`, `defender_id=NULL`, 🤖-Kennzeichnung).
- **Aufgeben (Surrender):** beendet den Kampf sofort als `defender_win` (überschreibt das
  Zerstörungs-Ergebnis, auch bei 58 %).
- **Einheiten entlassen** (DELETE `/units/:id`): Menge 5→4. **Kampf-Historie** (GET `/battle/history`)
  liefert Angriffe **und** Verteidigungen.

> **3 Bugs gefunden & behoben beim Emulator-Test:**
> 1. **Socket-Handler-Race** (`sockets/index.ts`): `onConnection` war `async` und machte vor dem
>    Registrieren der Handler ein `await query(...)`; ein direkt nach Connect gepuffertes
>    `matchmaking:join` ging verloren → Matchmaking hängt. Fix: Handler **synchron** registrieren,
>    Trophäen danach asynchron nachladen. (Headless-E2E hatte den Race nicht getriggert.)
> 2. **Veraltete Matchmaking-Trophäen:** Online-Trophäen wurden nur beim Connect gesetzt und drifteten
>    über die Session. Fix: `setOnlineTrophies` nach jedem Kampf in `battleService.finalizeBattle`.
> 3. **Socket-Präsenz fehlte:** Der Socket verband sich nur beim Angreifen → ein Spieler im Dorf war
>    nicht als Verteidiger matchbar. Fix: `connectPresence()` beim Login/Refresh (App), sodass ein
>    eingeloggter Spieler online & angreifbar ist. ~~Hinweis: Access-Token läuft nach 15 min ab; die App
>    hat noch kein Auto-Refresh~~ → **ERLEDIGT 2026-06-21** (siehe Nachträge §3: Axios-Interceptor refresht
>    bei 401 automatisch via `POST /api/auth/refresh` und wiederholt den Request).

### Phase 4 — Clans & Ranglisten ✅ (Backend E2E + HTTP-Smoke gegen echtes PG verifiziert; **Frontend auf Emulator visuell+interaktiv verifiziert**)
- **Shared-Logik** `packages/shared/src/`:
  - `game/clans.ts`: reine Housing-Helfer (`clanCastleHousing`, `unitHousing`, `defendersHousingUsed`)
    + `validateBanner` (gegen `clan.banner_options`). Front-/Backend teilen die Stellplatz-Mathematik.
  - `types/models.ts`: `Clan`, `ClanBanner`, `ClanRole`, `ClanMember`, `ClanCastleDefender`, `ClanWar`,
    `LeaderboardSoloEntry`, `LeaderboardClanEntry`, `Season`. `types/api.ts`: Clan-/Leaderboard-DTOs.
    `validation/index.ts`: `createClanSchema`, `clanBannerSchema`, `donateUnitsSchema`.
- **Backend:**
  - Migration `006_clan_phase4.sql` (`clan_wars.status/ends_at/season_number`, Index `clan_members(player_id)`,
    Unique-Index `clan_castle_defenders(player_id,unit_type)`, aktive Saison 1 geseedet) +
    `007_clan_war_fk_on_delete.sql` (`clan_wars`→`clans`-FKs auf **ON DELETE SET NULL**, damit ein
    Clan mit Kriegshistorie auflösbar bleibt).
  - `clanService.ts`: erstellen (Tag/Name-**Profanity** via `bad-words` + `clan.profanity_extra_words`,
    Banner-Baukasten-Validierung, Unique-Konflikte), beitreten (Voll/bereits-Mitglied), verlassen
    (**Leader-Transfer** an Dienstältesten/Co-Leader bzw. **Disband** des letzten Mitglieds), Detail,
    Liste/Suche, **Clan-Burg-Stationierung** mit Housing-Cap (eigene Burg oder Clan-Kamerad).
    `players.clan_id` ↔ `clan_members` synchron.
  - `clanWarService.ts`: **in-memory** Kriegs-Queue (Clan-Matchmaking, FIFO-Pairing alle 2s),
    Krieg-Lebenszyklus (`clan_wars`, `ends_at`), **Punkte = Summe der Zerstörung**
    (`recordClanWarAttack`), Abschluss bei Ablauf (Sieger nach Punkten → `clans.season_points` +
    `total_wins`, `leaderboard_clan`-Upsert je aktiver Saison). Bewusst in-process wie das Solo-MM.
  - `leaderboardService.ts`: Solo (live aus `players`, dauerhaft) + Clan (live aus `clans` für aktive
    Saison, sonst `leaderboard_clan`-Snapshot) — beide paginiert (`leaderboard.*`-Config) inkl. eigener
    Position (`me`) per `RANK()`-Window.
  - `battleService.ts` erweitert: `warContext` durch `prepareBattle`/Session/`finalizeBattle`. Clan-Krieg-
    Duelle zählen **nur Zerstörung** (keine Solo-Trophäen/kein Loot), persistieren `mode='clan_war'` +
    `clan_war_id`. `sockets/index.ts`: neues Event **`clanwar:join`** (Gegner = zufälliges feindliches
    Clan-Mitglied) wiederverwendet die Battle-Pipeline.
  - REST: `/api/clan/*` (create, `?search=`, `:clanId`, join/:clanId, leave, castle, castle/donate,
    wars/current, wars/start) + `/api/leaderboard/{solo,clan}`. Cron um Kriegs-Abschluss (1min, Sicherheitsnetz)
    erweitert; Krieg-Loop in `index.ts` gestartet.
- **Frontend (Expo):** `api/client.ts` + Store (Clan-/Leaderboard-State, `activeScreen`-Navigation,
  `startClanWarBattle`), `screens/ClanScreen.tsx` (Erstellen mit **Banner-Editor**, Beitreten/Suche,
  Mitglieder, **Burg/Housing** mit Stationieren aus der Armee, **Krieg**-Tab), `screens/LeaderboardScreen.tsx`
  (Solo/Clan-Toggle, Paginierung, eigene Position hervorgehoben), `components/clan/` (`ClanBannerView`,
  `BannerEditor`), VillageScreen-Buttons „🏰"/„🏆", `App.tsx`-Routing.

**Verifikation Phase 4:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. **Service-E2E gegen echtes PG (36/36)**:
Clan erstellen/Validierung (Profanity-Tag, ungültige Bannerfarbe, doppelter Tag), beitreten/Detail/Doppel-
Beitritt-Block/Suche, **Clan-Burg-Housing** (Burg L2 = 15 Stellplätze, 5 Mili stationiert, Über-Cap- und
Über-Armee-Ablehnung), **Clan-Krieg** (Queue → Pairing → Punkte 130:30 → Ablauf → Sieger A → +100 season_points,
+1 total_wins), **beide Ranglisten** (Solo sortiert + `me`, Clan saisonbasiert + `me`), Verlassen + **Disband
mit Kriegshistorie** (FKs genullt). **HTTP-Smoke (17/17)**: Routing/Auth/Zod, Routen-Reihenfolge
(`/castle` & `/wars/current` **vor** `/:clanId`), TH5-Gate (create<TH5 → 400), Leadership-Gate
(wars/start als member → 403). Beide Testskripte waren temporär und wurden nach der Verifikation entfernt.

**Bug-Hunt Phase 4 ✅ (2026-06-21, 82 Edge-Case-Checks gegen den laufenden Server, 82/82):** erschöpfende
Tests für Clan-CRUD (Profanity/Banner/Duplikate, Name/Tag-Zod-Grenzen), Beitreten (Doppel, nicht-existent,
**voller Clan = 50→409**), Burg/Housing (Kapazität, Über-Cap, Über-Armee, **gemischte Einheiten** Ritter=3,
Cross-Clan-Donate 403, Donate ohne Clan/ohne Burg), Krieg (**Sieg** +100/+1 Win + leaderboard_clan,
**Unentschieden** = beide +draw_points, Leave-während-Krieg 409), **Battle-Persistenz** (`mode='clan_war'`,
clan_war_id, 0 Trophäen/Loot, Angreifer-Trophäen unverändert, +Zerstörungspunkte), **Verlassen/Leader-
Transfer/Disband** (Member-Leave, co_leader-Promotion, letzter→Auflösung), Ranglisten-Paginierung/Clamping,
Auth-Gates.
> **1 Bug-Klasse gefunden & behoben:** Nicht-UUID-Pfadparameter (z. B. `GET /clan/<müll>`, aber auch
> `GET /village/:id`, `DELETE /units/:id` aus Phase 1–3) lösten einen ungefangenen Postgres-Fehler
> **22P02** → **HTTP 500** (mit DB-Fehlerleck) aus. Fix **an einer Stelle** im zentralen Error-Handler
> (`middleware/error.ts`): `22P02` → **400** (analog zur vorhandenen `23505`→409-Abbildung) — deckt die
> **gesamte API** ab. Zusätzlich räumt `leaveClan` beim Disband den Kriegs-Queue-Eintrag auf
> (`cancelWarRequest`), damit kein Pairing auf einen gelöschten Clan verweist.

**Nachträge Phase 4 (2026-06-21):**
- **Clan-Burg-Verteidiger im Kampf** implementiert (Details §5) — Engine + battleService + BattleCanvas
  (Verteidiger als krimsonrote Marker). Headless-Test 16/16: bidirektionaler Kampf, Verteidiger sterben,
  `clan_castle_defenders` sinkt um die Gefallenen, auch im Clan-Krieg; Splash trifft mehrere, Heiler heilt,
  Centroid-Spawn-Fallback ohne Burg-Gebäude, Bots ohne Verteidiger.
- **Rollen-Verwaltung** ergänzt: `POST /api/clan/members/:playerId/{promote,demote}` (`changeMemberRole`):
  Mitglied→Co-Leader (Leader/Co-Leader), Co-Leader→Leader = **Führungsübergabe** (nur Leader, degradiert
  sich selbst zu Co-Leader), Co-Leader→Mitglied (nur Leader). Frontend: ⬆/⬇-Buttons in der Mitgliederliste.
- **Abschluss-Tests 32/32** (Rollen-Edge-Cases + bisher ungetestete Faktoren). **2 weitere Bugs gefunden
  & behoben:** (a) `clan_castle_defenders.donated_by` FK **ohne ON DELETE** → Löschen eines Spenders schlug
  fehl → Migration **008** (`ON DELETE SET NULL`, wie 007). (b) **Leaderboard-Gleichstand**: `RANK()`
  sortierte `created_at` mit → unterschiedliche Ränge bei gleichem Stand; jetzt `RANK()` nur über die
  Punktzahl (geteilter Rang), `created_at`/`id` nur als stabile Anzeige-Sortierung.
- **Ressourcen-Cap-Bug gefunden & behoben (Phase-2-Ökonomie, 2026-06-21):** `resourceService.applyProduction`
  hatte `if (current >= cap) return current` — d. h. ein Bestand **über** dem Cap wurde **nie abgebaut**.
  Real erreichbar, wenn der Cap sinkt (Lager **einlagern/entfernen** → 3×-Cap fällt), sodass Ressourcen
  dauerhaft über der Grenze blieben (Spec Abschnitt 4: „Was über das Cap geht, verfällt"). Fix: das
  Settlement **kappt jetzt bei jedem Lauf** auf den Cap (Überschuss verfällt), auch ohne neue Produktion;
  Produktion unter dem Cap akkumuliert unverändert. Verifiziert: über Cap (99999/88888/77777) → 6000/4500/1500,
  unter Cap (1000/500/100) → unverändert; Emulator-Header zeigt nach Re-Login 6.000/6.000 statt 50.000/6.000.
- **Token-Auto-Refresh ✅ (Phase-1-Lücke geschlossen, 2026-06-21):** Die App hatte das 15-min-Access-Token
  nicht erneuert → nach Ablauf veraltete Daten + „Ungültiges/abgelaufenes Access-Token". Jetzt: `api/client.ts`
  speichert Access- **und** Refresh-Token (`setTokens`), ein **Axios-Response-Interceptor** fängt **401** ab,
  holt via `POST /api/auth/refresh` ein neues Paar (parallele 401 teilen ein In-Flight-Promise) und wiederholt
  den Original-Request einmal; scheitert auch das Refresh, wird sauber ausgeloggt (`onAuthFailure` → Store-Logout
  → AuthScreen). Socket nutzt weiter `getAccessToken()` (frisches Token bei Reconnect). Verifiziert am Emulator
  mit verkürztem `JWT_ACCESS_EXPIRES=20s`: nach Ablauf lud der Clan-Tab transparent frische Daten (kein Fehler).
- **Emulator-Verifikation der Nachträge ✅ (vw_pixel):** **Rollen-UI** — emumate per ⬆ zu Co-Leader (⭐)
  befördert, ⬇ degradiert zurück zu Mitglied. **Verteidiger im Kampf** — emuclan griff den **echten online**
  Gegner emudef2 (6 Burg-Milizen) an: krimsonrote Verteidiger erschienen, kämpften gegen die blauen
  Angreifer, fielen; Kampf endete als **Niederlage/3 % Zerstörung** (Dorf erfolgreich verteidigt), DB
  bestätigte `clan_castle_defenders` **6 → 0**.

**Emulator-Verifikation Phase 4 ✅ (2026-06-21, nativer Dev-Build auf `vw_pixel`):** Da Phase 4 nur
JS/TS änderte, genügte ein neues Metro-Bundle (kein Gradle-Rebuild) auf der bereits installierten
APK (`com.villagewars.app`). Kompletter Flow visuell + interaktiv via `adb`-Screencap/-Input geprüft
(Testspieler **`emuclan`** / `emuclan123`, TH5, Clan-Burg L2, 10 Milizionäre): Login → Dorf zeigt die
neuen Kopf-Buttons **🏰**/**🏆** → **🏰 Clan**: „Keine Clans" → **Erstellen**-Tab mit **Banner-Editor**
(Form/Symbol/Farben aus `clan.banner_options`, Live-Vorschau) → Clan „EmuGarde [EMU]" gegründet →
**Mitglieder** (👑 emuclan (du), Menschen RH5, 1100🏆) → **Burg**: „Stellplätze 0/15 (Burg Lvl 2)",
„Aus Armee stationieren: Milizionär (×10)" → 2× stationiert → **1/15 → 2/15**, Stationiert „Milizionär
×2", Armee →„×8" (Housing-Cap-Logik live) → **Krieg**: „🔍 Kriegsgegner suchen" (nur als Leader) →
**🏆 Rangliste**: **Solo** (#1 emuclan (du) 1100🏆 gelb hervorgehoben, darunter echte Spieler, „Dein
Rang #1") + **Clans** (#1 EmuGarde mit Banner, „Dein Clan #1 · 0 Pkt"). Hinweis: Im Dev-Client erscheint
gelegentlich der Toast „Cannot connect to Metro" (HMR-Websocket) — rein kosmetisch, alle REST-Aufrufe
liefen erfolgreich (Daten geladen/persistiert). Clan-Krieg-**Kampf** wurde am Emulator nicht ausgefahren
(braucht zwei Clans mit Online-Mitgliedern); der interaktive Pfad entspricht dem verifizierten Solo-Kampf.

### Phase 5 — Dungeon & Monetarisierung ✅ (Backend Service-E2E 50/50 + Bug-Hunt 57/57 + HTTP-Edge 10/10 gegen echtes PG; **Frontend auf Emulator visuell+interaktiv verifiziert**)
- **Shared-Logik** `packages/shared/src/`:
  - `game/dungeon.ts`: **reine, deterministische PvE-Wellen-Simulation** (`simulateDungeonWave`) —
    Einheiten-gegen-Einheiten-Gefecht (Spieler-Armee vs. NPC-Horde), reuse von `getUnitCombatStats`,
    eigener Tick-Loop (Zielwahl nächster Gegner, Bewegung, Nah-/Fernkampf, Splash, Heiler). `cleared`
    = alle Gegner tot UND ≥1 Spielereinheit lebt. Plus `computeDungeonReward` (höchstes erreichtes
    Tier aus Abschnitt 9, deterministisch testbar via `randFn`).
  - `types/gameConfig.ts`: `DungeonConfig`/`SkinsConfig`/`IapConfig` + Sub-Typen (vorher
    `Record<string, unknown>`). `types/models.ts`: `DungeonRun`, `Skin`, `ShopSkin`. `types/api.ts`:
    Dungeon-/Shop-/IAP-DTOs. `validation/index.ts`: `iapPurchaseSchema`.
- **Backend:**
  - Migration `009_phase5_dungeon_shop_iap.sql`: `dungeon_runs.status/army_snapshot/army_remaining`
    (mehrwellen-Lauf, server-autoritativ), `player_skins.is_active` (angewandter Skin je Ziel),
    `iap_transactions` (idempotente Goldbarren-Gutschrift, `transaction_id` UNIQUE).
  - `dungeonService.ts`: **Zeitfenster** (`isDungeonOpen` — DST-korrekt via `Intl`-Berlin-Zerlegung,
    Fenster Sa 05:00 → So 00:00; `dev_always_open`-Override für Tests), `getDungeonStatus`
    (open + opens_at/closes_at + laufender Lauf + completed_this_week), `startDungeonRun`
    (Armee-Snapshot, `one_run_per_week`), `completeDungeonWave` (löst Welle/Boss auf, überlebende
    Armee zieht weiter, Belohnung+Verbrauch bei Run-Ende), `getDungeonHistory`, `closeOpenDungeonRuns`
    (Cron beim Schließen). **Keine Goldbarren aus dem Dungeon** (nur Gold/Edelsteine).
  - `shopService.ts`: `seedSkinsFromConfig` (Katalog aus Config → skins-Tabelle, idempotent beim Start),
    `listSkins` (mit owned/applied), `buySkin` (Goldbarren-Abzug, Conflict bei Besitz), `applySkin`
    (nur EIN Skin je Ziel aktiv). **Rein kosmetisch.**
  - `iapService.ts` + `iap/verify.ts`: Beleg-Verifizierung Apple/Google mit **Sandbox-Modus**
    (`sandbox:<product_id>:<transaction_id>`, gated über `IAP_ALLOW_SANDBOX`), Produkt→Paket aus
    Config, **idempotente** Goldbarren-Gutschrift. Produktiv-Pfade (echte verifyReceipt/Play-API)
    sind strukturiert hinterlegt und lehnen ohne Credentials bewusst ab (keine erfundene Gutschrift).
  - `seasonService.ts`: `checkAndResetSeason` (alle 8 Wochen fällig) + `resetSeasonNow` — finaler
    `leaderboard_clan`-Snapshot, **Top-5-Clans Goldbarren** (`clan.leaderboard_rewards_bars`, je
    Mitglied), `season_points`-Reset, neue Saison. Idempotent über `FOR UPDATE` + `is_active`-Prüfung.
  - REST: `/api/dungeon/{status,start,wave/complete,history}` + `/api/shop/{skins,skins/:id/buy,
    skins/:id/apply,skins/:id/unapply,bars/packages,bars/purchase}`. Cron erweitert: Dungeon
    öffnen `0 5 * * 6` / schließen `0 0 * * 0` + Saison-Reset-Check `0 0 * * 1` (alle Europe/Berlin).
    Skin-Seed beim Start (nach DB-Ping).
- **Frontend (Expo):** `api/client.ts` + Store (`ActiveScreen` um `'dungeon'`/`'shop'`, Dungeon-/Shop-State
  + Aktionen), `screens/DungeonScreen.tsx` (Zeitfenster-Banner, Lauf starten, Welle-für-Welle-Kampf
  mit Live-Armee, Boss, Belohnungs-Karte, Wellen-Übersicht), `screens/ShopScreen.tsx` (Skin-Galerie
  Kauf/Anwenden + Goldbarren-Pakete via Sandbox-IAP), VillageScreen-Buttons „🗝️"/„🛒", App.tsx-Routing.

**Verifikation Phase 5:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. **Service-E2E gegen echtes PG (50/50)**:
Dungeon voller Durchlauf (5 Wellen + Boss → „Alle 5 + Boss"-Tier 345 Gold/10 💎 gutgeschrieben, **keine
Goldbarren**, Armee verbraucht), Niederlage mit Mini-Armee (0 Wellen → keine Belohnung), `one_run_per_week`-Block,
geschlossenes-Fenster-Block; Shop Kauf/Anwenden/Doppelkauf-Conflict/nur-1-Skin-je-Ziel/zu-wenig-Goldbarren;
IAP Sandbox-Gutschrift + **Idempotenz** (gleiche txid → keine zweite Gutschrift) + Produkt-/Beleg-Validierung;
Saison-Reset (Top-5-Goldbarren je Mitglied gleich, season_points→0, neue Saison, leaderboard_clan-Snapshot).
**HTTP-Smoke (9/9 fachlich)**: Auth-Gate (401), Routing/Reihenfolge (`/shop/bars/*` vs. `/shop/skins/:id/*`),
Zeitfenster-Boundaries korrekt (nächste Öffnung Sa **27.06.** 05:00 Europe/Berlin = 03:00 UTC CEST,
Schließung So 00:00 = 22:00 UTC). Beide Testskripte waren temporär und wurden nach der Verifikation entfernt.
> **Nebeneffekt der Saison-Reset-Verifikation:** Die E2E-/Bug-Hunt-Tests riefen `resetSeasonNow()` echt auf →
> die Dev-DB steht jetzt auf **Saison 4** (frühere Saisons beendet, `leaderboard_clan`-Snapshots vorhanden, alle
> `clans.season_points` = 0). Das ist korrektes Phase-5-Verhalten, nur fürs Wiederaufsetzen gut zu wissen.

**Bug-Hunt Phase 5 ✅ (2026-06-21, erschöpfende Edge-Case-Suite, 57/57 + 10/10 HTTP-Edge):** Zeitfenster
(`isDungeonOpen`) gegen Sommer-/Winter-DST + alle Grenzen (Sa 04:59 zu / 05:00 offen / So 00:00 zu / Mi zu),
alle 4 Belohnungs-Tiers (0/1-2/3-4/5/5+Boss inkl. min/max), Simulation (Determinismus, leere Armee, keine Gegner,
Heiler-only, 1-vs-Boss), Lauf-Flow (Start ohne Armee, **Resume** = gleiche Run-ID, completeWave ohne Lauf,
Teilsieg-Tier, `one_run_per_week`, **3 parallele completeWave** ohne Doppel-/Sprung-Welle), Shop (alle Skins,
Mehr-Ziel-aktiv, idempotentes unapply/apply, exakt/zu-wenig Goldbarren), IAP (alle 5 Pakete, **Cross-Player-txid-Reuse**
abgewehrt, Produkt/Beleg-Mismatch, Produktiv-Pfad lehnt ohne Credentials ab), Saison (leere Liga ohne Crash,
Gleichstand). **1 echter Bug gefunden & behoben:**
> **Dungeon-Gold-Cap-Bug:** `completeDungeonWave`/`closeOpenDungeonRuns` schrieben Gold ungekappt gut
> (`gold = gold + reward`), aber `resourceService` kappt Gold bei **jedem** Settlement auf den 3×-Lager-Cap
> (Phase-4-Fix). Folge: Dungeon-Gold über dem Cap (z.B. 1400 + 393 = 1793) wurde beim nächsten `/me`-Tick
> still auf 1500 zurückgenommen — der Spieler sah kurz mehr, dann verschwand es. **Fix:** Dungeon kappt Gold
> jetzt beim Gutschreiben (`LEAST(gold + reward, goldCap)`, Helfer `playerGoldCap`), exakt wie der PvP-Loot.
> Edelsteine bleiben ungekappt (kein Edelstein-Lager). Verifiziert: 1400 → 1500 direkt, kein Verlust beim Settle.

**Emulator-Verifikation Phase 5 ✅ (2026-06-21, nativer Dev-Build `com.villagewars.app` auf `vw_pixel`):** Da Phase 5
nur JS/TS änderte, genügte ein neues Metro-Bundle (Node 20) auf der bestehenden APK. Kompletter Flow visuell +
interaktiv via `adb` geprüft (Testspieler **`emuclan`**, TH5, Armee 40 Mili/20 Bogen/8 Ritter, 2000 Goldbarren):
Login → Dorf mit neuen Buttons **🗝️**/**🛒** → **🗝️ Dungeon**: Zeitfenster-Banner, **Wellen-Übersicht** exakt aus
Config (Welle 1–5 + Endboss Ritter ×14 HP, deutsche Namen) → **Lauf starten** → **Welle-für-Welle-Kampf**
(„✅ Welle N bezwungen", Live-Armee schrumpft, Button wechselt bei Welle 5 zu „☠️ Boss angreifen") → **🏆 Sieg**
(„Alle 5 + Boss": +317 Gold/+8 💎) → zurück im Dorf mit gutgeschriebener Belohnung (Gold 100→417, 💎 5→13) und
verbrauchter Armee (🛡 68→50); DB bestätigt `dungeon_runs` status=won/boss_defeated. **🛒 Shop**: Skin **kaufen**
(Goldbarren 2000→1800) → **Anwenden** („✓ Aktiv"); **Goldbarren-Tab** alle 5 IAP-Pakete → **Kaufen** (Mittel:
1800→3000, `iap_transactions`-Zeile + Header-Update). **2 UI-Bugs am Emulator gefunden & behoben:**
> 1. **Header-Layout:** Die zwei neuen Buttons (🗝️/🛒) sprengten die Aktionsleiste → der Spielername wurde auf ~0
>    Breite gequetscht und brach **zeichenweise senkrecht** um. Fix (`VillageScreen.tsx`): Name auf eigene Zeile
>    (`numberOfLines`), Buttons in horizontalem **ScrollView** (`thRow`→`thCol`).
> 2. **Dungeon-Zeitanzeige:** `fmtDate` formatierte `opens_at`/`closes_at` in **Geräte-Zeitzone** → auf dem
>    UTC-Emulator stand „öffnet 03:00" statt „05:00". Fix (`DungeonScreen.tsx`): `timeZone: 'Europe/Berlin'` +
>    „ Uhr"-Suffix (der Zeitplan ist Berlin-basiert). Verifiziert: zeigt jetzt „schließt So., 00:00 Uhr".

> **Stolperfalle Emulator-Login (Phase 5):** `adb shell am force-stop` löscht das **In-Memory-Token** → die App
> startet ausgeloggt (kein Token-Persist). Nach App-Neustart erneut anmelden. `dev_always_open` wird **nicht** per
> `tsx watch` neu geladen (es liest `game-config.json` via `readFileSync`, kein importiertes Modul) → für den
> offenen-Dungeon-Test den **Server neu starten**. `dev_always_open` steht wieder auf **`false`** (committet).
> ⚠️ Beim Server-Neustart auf einen **Orphan-Prozess auf :4000** achten (alte Config, dev_always_open zeigt
> dann nicht) — vor dem Start sicher killen (`Get-NetTCPConnection -LocalPort 4000 ...`).

### Phase 5 — Dungeon-Erweiterung ✅ (2026-06-21: Schwierigkeiten, Zufallswellen, versteckte Gegner, Kampf-Animation)
Auf Nutzerwunsch wurde der Dungeon deutlich aufgewertet (Backend Bug-Hunt **32/32**, Frontend **am Emulator visuell verifiziert**):
- **Schwierigkeitsstufen** (`dungeon.difficulties`): Leicht/Normal/Schwer/Albtraum — bei Start wählbar. Jede skaliert
  Gegnerstärke (`enemy_strength_multiplier`), Gegner-Menge (`wave_budget_multiplier`) **und** Belohnung
  (`reward_multiplier` 0.6/1.0/1.6/2.4). `computeDungeonReward` multipliziert die Tier-Belohnung damit. Verifiziert:
  Leicht 240 / Normal 400 / Schwer 640 / Albtraum 960 Gold (max-Wurf); dieselbe Armee **gewinnt auf Leicht, verliert
  auf Albtraum** in Welle 2.
- **Zufalls-Wellen, geseedet** (`dungeon.wave_generation` + `shared/game/dungeon.ts` `generateDungeonWave`): Pro Lauf
  wird ein **Seed** gezogen (`dungeon_runs.seed`, Migration 010); jede Welle wird daraus deterministisch über ein
  Budget-System aus dem `enemy_pool` generiert (mulberry32-PRNG). Gleicher Seed → gleiche Wellen, anderer Lauf →
  andere. Budget/Stat steigen mit Welle + Schwierigkeit. Min-/Max-Gegner-Grenzen eingehalten.
- **Versteckte Gegner:** `wavePreview` + `DungeonStartResponse.waves` enthalten **nur** Wellennummer + Boss-Flag
  (kein `enemies`-Feld mehr). UI zeigt „Welle N · ❓ unbekannt". Erst **nach** dem Kampf werden die Gegner über
  `DungeonWaveResponse.enemies_faced` enthüllt („Gegner: Milizionär ×3 · Ritter ×1").
- **Kampf-Animation (Replay):** `simulateDungeonWave` zeichnet den Kampf optional als **Replay** auf
  (`captureReplay`, Frames mit Einheiten-Positionen/HP, `dungeon.replay_capture_interval_ticks`/`replay_max_frames`).
  `completeDungeonWave` liefert das Replay mit; die neue **`components/battle/DungeonBattleView.tsx`** (Skia) spielt
  es animiert ab (Spieler **blau** links, Gegner **rot/rollenfarbig** rechts, Bewegung interpoliert, HP-Balken,
  „Überspringen"-Button), **danach** erscheint das Ergebnis. Der Store hält das Ergebnis zurück
  (`dungeonBattlePlaying` + `finishDungeonBattle`), damit Armee/Fortschritt/Belohnung den Ausgang nicht vorwegnehmen.
- **Migration 010** (`dungeon_runs.difficulty` + `seed`). Config: `dungeon.waves` (feste Liste) **entfernt** →
  Generierung; `default_difficulty`, `difficulties`, `wave_generation`, `replay_*` ergänzt. Schema-/Typ-Anpassungen
  in `gameConfig.ts`/`models.ts`/`api.ts`/`validation` (`startDungeonSchema`).
- **Emulator (vw_pixel, emuclan):** Schwierigkeit „Schwer" gewählt → Lauf „Schwer" → **versteckte Wellen** (❓) →
  „Nächste Welle" → **animierter Kampf** (70 blaue vs. rote/orange Gegner, Einheiten rücken auf, HP-Balken) → Ergebnis
  mit **enthüllten** Gegnern (Welle 1 = Milizionär ×3 · Ritter ×1, Welle 2 = anderer Mix mit Bogenschütze) → Fortschritt
  1/5 · Schwer. Keine neuen Bugs am Emulator.

### Phase 5 — Dungeon-Portal in der Welt ✅ (2026-06-21, Nutzerwunsch; am Emulator verifiziert)
Statt nur über den Kopf-Button erreicht man den Dungeon jetzt über ein **animiertes Portal in der Dorf-Welt** — es
**erscheint nur, während die Dungeon-Phase offen ist** (Wochenende) und **verschwindet automatisch, wenn sie endet**
(bis zum nächsten Wochenende). Umsetzung: **`components/village/DungeonPortal.tsx`** — eigenes kleines Skia-Overlay
(lila/cyane, pulsierende Ellipse aus gestauchten Kreisen + Wirbel-Funken + Steinplattform + „🗝️ Dungeon"-Label),
absolut am oberen Kartenrand positioniert („außerhalb der Map"), eigene Animations-Schleife (rendert NICHT den
Dorf-Canvas mit). `VillageScreen` lädt den Dungeon-Status (`loadDungeon` beim Mount + im 30-s-Refresh) und rendert das
Portal nur bei `dungeonStatus.open === true && !placing`; Tap → `setScreen('dungeon')`. Verifiziert: Portal sichtbar
bei offenem Dungeon, Tap öffnet den Dungeon-Screen, Portal **weg** nach Schließen (dev_always_open=false).
> **Sackgasse vermieden:** Ein erster Versuch, das Portal als Welt-Objekt **im** VillageCanvas (gepanntes Skia-Group,
> mit `Oval`) zu zeichnen, rendete nicht sichtbar (Koordinaten-/`Oval`-Verdacht in Skia 1.2.3). Lösung: separates
> Overlay mit nur sicheren Primitiven (`Circle` in skaliertem `Group` statt `Oval`) — zuverlässig + performanter.

### Phase 6 — Grafik & Effekte / Game Juice ✅ (2026-06-21; Engine-Logiktest 32/32 + am Emulator visuell+interaktiv verifiziert)
Rein **kosmetische** Effektschicht (TEIL-2-Spec „GRAFIK, ANIMATION & GAME JUICE") — **beeinflusst keine Balance**.
Implementiert in der Spec-Reihenfolge (Abschnitt 10):
- **Config + Typen:** neue Sektion **`effects`** in `game-config.json` (eiserne Regel — alle Effekt-Zahlen zentral:
  `particle_cap` 200 / `particle_cap_reduced` 80, `screenshake`-Intensitäten je Ereignis, `floating_text`,
  `squash`, `idle`, 7 Partikel-`presets`, `screen_transition_ms`) + `EffectsConfig` in `shared/types/gameConfig.ts`.
  Server reicht sie unverändert über `GET /api/config` durch (keine Server-Logik-Änderung).
- **Effekt-Engine** `apps/mobile/src/rendering/effects/` (rein, React-frei wo möglich, ein RAF-Loop pro Canvas —
  kein reanimated, konsistent mit DungeonBattleView): `easing.ts` (easeOutBack/Cubic/InOutQuad/Elastic),
  `particles.ts` (`ParticleSystem` + 7 Presets `upgradeBurst/levelUpAura/coinRain/hitSpark/deploySpawn/destroyBurst/
  magicAmbient`, globale Obergrenze + „ältester verdrängt", Reduce halbiert Anzahl + nutzt reduzierten Cap),
  `floatingText.ts` (aufsteigende Zahlen, Farben aus Config), `shake.ts` (`ScreenShake`, max-gewinnt, Abkling ×0.85),
  `sound.ts` (Cue-Abstraktion — **Playback bewusst zurückgestellt**, siehe §4/§5), `useAnimationFrame.ts` (gedrosselter
  RAF-Hook), `ParticleField.tsx` (Skia-Kreise/gestauchte Münz-Ellipsen) + `FloatingTextLayer.tsx` (RN-Text-Overlay,
  kein Skia-Font-Loading nötig).
- **Wiring:** `JuicyButton` (Knopf-Druck-Squash via RN `Animated` + Sound-Cue) für prominente Buttons (Angreifen,
  Kampf-starten, Ergebnis). `buildingSprite.tsx` um **Idle-Atmung** (Sinus-Skalierung), **wehende Fahne**,
  **animierte Magie-Aura/-Funken (Lvl 7–10, pulsierend)**, externen `extraScale` (Pop-In/Upgrade-Squash/Einsturz) und
  **Hit-Flash** (weiße Flächen) erweitert. `VillageCanvas`: Idle-Loop (30 FPS), Neubau-**Pop-In** (easeOutBack),
  **Upgrade-Abschluss** = `upgradeBurst` + Squash-Puls + „LEVEL UP!"-Floating-Text (Diff auf `buildings`).
  `BattleCanvas`: Diff auf `battle:state_update` → **Deploy-Funken + Spawn-Squash**, **Hit-Flash + hitSpark +
  Floating-Schaden** bei HP-Verlust (Krit ab 300), **Einsturz-Squash + destroyBurst + Screenshake** (Rathaus=20)
  bei Zerstörung, HP-Balken grün→gelb→rot. **`BattleResultOverlay`** = Sieg-Sequenz (goldener Glow, „SIEG!"-Karte
  federt mit easeOutElastic ein, Trophäen-Zähler tickt hoch) / sachliche Niederlage. **`ScreenFade`** (Fade+Slide,
  240 ms) für alle Bildschirmwechsel in `App.tsx`.
- **Performance-Leitplanke:** Store-Flag **`reduceEffects`** (+ `soundEnabled`) mit **`SettingsSheet`** (⚙️ im
  Dorf-Header): deaktiviert Screenshake, halbiert Partikel, friert Idle-Atmung/Fahnen ein. Default aus
  `effects.reduce_effects_default`.

**Verifikation Phase 6:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. **Engine-Logik-Smoke-Test 32/32** (temporär,
nach Lauf entfernt): Easing-Grenzwerte/Überschwingen, Partikel (Preset-Anzahl exakt, Cap 200 + reduziert 80, Reduce
halbiert, unbekanntes Preset = No-Op, Gravitation/Lebensdauer, coinRain fällt / magicAmbient steigt), Floating-Text
(Farbe aus Config, Krit größer, Aufstieg/Ablauf), Screenshake (Intensität ±, max-gewinnt, Abkling, disabled=No-Op).
Server-Config-Pipeline geprüft (`loadGameConfig` liefert `effects` mit korrekten Werten; `GET /api/config` ebenfalls).
**Emulator (vw_pixel, `emuclan`):** Login → Dorf (rendert, neuer ⚙️-Button) → **⚙️ Einstellungen** (beide Schalter
binden korrekt, Reduce an/aus ohne Crash) → **⚔️ Angreifen** (Fade-Übergang) → Bot-Match → **Kampf** mit sichtbarem
**Hit-Flash (Gebäude blitzt weiß)** + **gold/orangen Funken** ums getroffene Rathaus → 100 % → **🏆 SIEG!-Sequenz**
mit **goldenem Vollbild-Glow** + Trophäen +18 → zurück im Dorf (Fade) mit **gutgeschriebener Beute** (Holz +100,
Stein +60) und verbrauchter Armee (🛡 70→62). Keine neuen Bugs.

### Visuelle Politur — CoC-Anmutung ✅ (2026-06-21, Nutzerwunsch „Grafik 1000× besser, Icons zusammenfassen")
Großer Optik-Durchgang über **alle** Spielbereiche (rein kosmetisch, keine Logik-/Balance-Änderung; typgeprüft +
am Emulator verifiziert):
- **Gebäude** ([buildingSprite.tsx](../apps/mobile/src/rendering/buildingSprite.tsx) komplett neu): statt flacher
  Farbflächen jetzt **verlaufsschattierte Körperflächen** (Skia `LinearGradient` je Wand, Sonne oben-links),
  **weicher Boden-Schatten**, **überstehendes Dach mit First-Lichtkante + Traufe**, **Türen, Fenster** (leuchten
  ab Lvl 6, magisch ab Lvl 9), **Kantenlichter**. Typabhängige Details: Wachturm-**Zinnen**, Kanonen-**Lauf + Rad**,
  Minen-**Eingang + Erzhügel**, Lager-**Bänder**, Mauer-**Steinzinnen**, wehende **Fahne mit Verlauf**, Burg-Variante.
  Level-Progression (Material-Tier, Gold-Trim ab 5, **Radial-Glow-Aura** Magie/Legendär ab 7/9) erhalten + reicher.
- **Terrain** (neu [rendering/terrain.tsx](../apps/mobile/src/rendering/terrain.tsx)): erhöhtes **Plateau mit weichem
  Rand**, **gekacheltes Gras** (Schachbrett-Schattierung) + Vertikal-Verlauf, ein paar **Bäume/Felsen** am Saum.
  Performance: alle Kacheln zu EINEM Pfad zusammengefasst (statt Hunderte Nodes). `variant: 'grass' | 'battle'`
  (Dorf grün / Kampf rötlich). Ersetzt die flache Fläche + harten Gitterlinien in beiden Canvases.
- **Kampf-Einheiten** ([BattleCanvas.tsx](../apps/mobile/src/components/battle/BattleCanvas.tsx)): statt nackter
  Kreise kleine **Figuren** (Boden-Schatten + Körper + Kopf + Outline, rollenfarbig) mit **Lauf-Wippen** (Sinus)
  und grün→rot HP-Balken; Verteidiger weiter krimson.
- **Header zusammengefasst** (Nutzerwunsch „Icons zusammenfassen, übersichtlicher"): die früher **8 gequetschten
  Icon-Buttons** sind jetzt **3 klare Buttons** — **⚔️ Angreifen** (Primär) · **🛡 Armee** · **☰ Menü**. Das Menü
  öffnet ein aufgeräumtes **Raster-Bottom-Sheet** ([MenuSheet.tsx](../apps/mobile/src/components/ui/MenuSheet.tsx))
  mit Clan / Rangliste / Dungeon / Shop / Inventar (Badge) / Einstellungen. Ressourcen-Kopfzeile als **Chip-Leiste**
  ([ResourceHeader.tsx](../apps/mobile/src/components/village/ResourceHeader.tsx)).
- **Emulator (vw_pixel, emuclan):** Dorf zeigt detaillierte Häuser (rote Dächer, Türen, Fenster, Kanonenlauf,
  Fahnen) auf gekacheltem Gras; Header sauber 3-teilig; Menü-Raster mit vollen Labels; Kampf gegen Bot mit
  gekacheltem Schlachtfeld + Figuren-Einheiten + intakter Kampf-Juice (Hit-Flash, Floating-Damage, Funken). Sieg →
  Beute gutgeschrieben, zurück im Dorf. Keine neuen Bugs.
> **Stolperfalle (gelöst):** RN-Prozentbreite (`width: '30%'`) greift durch den `JuicyButton`-Wrapper nicht
> zuverlässig → Menü-Kacheln waren zu schmal (Labels abgeschnitten). Fix: Kacheln als einfaches `Pressable` mit
> eigenem Press-Highlight statt `JuicyButton`.

### Visuelle Politur 2 — TYP-EIGENE Gebäude-Silhouetten ✅ (2026-06-22, Nutzerwunsch „Gebäude sehen alle gleich aus")
Nach Rückmeldung, dass alle Gebäude denselben Würfel-mit-Dach-Umriss teilten, wurde [buildingSprite.tsx](../apps/mobile/src/rendering/buildingSprite.tsx)
**komplett neu** auf **pro-Typ-Silhouette + Ikonografie** umgebaut (angelehnt an Clash of Clans — sofort erkennbar):
- Gemeinsame Iso-Bausteine: `Box` (3 verlaufsschattierte Wände), `Roof` (Walmdach) / `GableRoof` (Satteldach),
  `Cylinder`, `Log`, `battlements` (Zinnen), `door`, `windows`. Pro-Typ-**Palette** (Identität dominiert über Tier).
- **Eigene Form je Typ:** Rathaus = zweistöckig + Golddach + Wappen + Fahne · Clan-Burg = Stein + **Zinnen** +
  **Eckturm** + Torbogen + Fahne · Goldmine = Erdhügel + **Mineneingang** + Holzrahmen + **Gold-Lore** · Holzfäller =
  Hütte + **Holzstapel** + Axt im Stumpf · Steinbruch = Schuppen + **Steinblöcke** + Spitzhacke · Holzlager = offener
  Stapel unter Dach · Steinlager = **Haufen großer Steinblöcke** · Goldlager = **Tresor mit Rad + Münzen** · Kaserne =
  **gekreuzte Schwerter** + Banner · Wachturm = hoher Schaft + **Aussichtsplattform mit Zinnen** · Kanone = Sockel +
  **großer Lauf + Räder + Kanonenkugeln** · Mauer = Stein + Zinnen + Mörtelfugen · exklusiv/unbekannt = magisches
  Gebäude mit Kristall. Level-Effekte (Gold-Trim, Aura, leuchtende Fenster, Hit-Flash) liegen weiter generisch obenauf.
- **Verifikation:** mobile `tsc --noEmit` = 0 Fehler; **Emulator (vw_pixel, emuclan):** Dorf zeigt alle Typen mit
  klar unterschiedlichen Silhouetten (Kanone/Rathaus/Kaserne/Holzfäller/Wachturm/Steinlager/Clan-Burg auf einen Blick
  erkennbar), 0 Laufzeitfehler im Metro-Log.
> **Hinweis:** Die Hauptfunktion nutzt eine `switch`-Dispatch; pro Zweig werden `body` + Bounding-Box (`flashG`) +
> höchster Punkt (`topY`) gesetzt, der gemeinsame Rahmen (Schatten/Aura/Gold-Trim/Flash/Auswahl/Upgrade) wird einmal
> drumherum gerendert.

### Visuelle Politur 3 — Outlines, Detail-Mauer/-Kanone, lebendiger Boden ✅ (2026-06-22, Nutzer „sieht aus wie Rechtecke, alles viel besser")
Qualitätssprung Richtung „echtes Spiel-Artwork": (1) **Outline + Rim-Light** an allen Iso-Bausteinen (`Box`/`Roof`/
`GableRoof`) — dunkle Silhouetten-Kontur + helle Sonnenkante = „Sticker-Look". (2) **Weicher Kontaktschatten** (Radial-
Verlauf statt harter Kreis). (3) **Mauer** neu: Steinmauer mit Mauerwerk-Fugen (versetzter Verband, links+rechts),
eingesenktem Wehrgang und **echten 3D-Zinnen** (kleine Box-Merlons mit Lücken) statt flachem Block. (4) **Kanone** neu:
Sockel + Holz-Lafette + **gebänderter Metalllauf** mit Querverlauf/Glanz + Mündungsbohrung + Bodenstück/Cascabel +
**Speichenräder** + **Kanonenkugel-Pyramide**. (5) **Boden** lebendiger: deterministisch gestreute **Grasbüschel,
Blumen, Kiesel** (mulberry32-Seed) über `Terrain`. (6) **Animation & Leben + Atmosphäre:** Schornstein-Rauch
(animierte Puffs) an Wohn-/Werkgebäuden, **Fensterkreuze** (Sprossen), atmosphärische **Hintergrund-Vignette**
(RadialGradient im Bildschirmraum) und sanft umherziehende **Umgebungs-Partikel** (Pollen/Glühpunkte) im VillageCanvas.
Typecheck 0 Fehler; am Emulator (emuclan) gerendert. **Hinweis Emulator-Reload:** neue `useRef`/`useMemo` in
laufenden Komponenten lösen beim Fast Refresh „Rendered more hooks" aus → sauberer App-Neustart nötig; nach
`force-stop` gewinnt manchmal erst der 2. `am start` den Fokus (sonst landet man kurz auf dem Homescreen).
> **Hinweis Grenzen prozeduraler Optik:** Alles ist **vektorbasiert in Skia** gezeichnet (keine gemalten/3D-Sprite-
> Assets). Für echte CoC-Optik wären illustrierte/AI-generierte PNG-Sprites der nächste Schritt (Asset-Pipeline) — die
> aktuelle Engine kann beliebig verfeinert werden, hat aber gegenüber gemaltem Artwork eine natürliche Obergrenze.
> **Iteration läuft weiter** auf Nutzerwunsch (Ziel-Erreichung entscheidet der Nutzer).

### Visuelle Politur 4 — GPU-SHADER (SkSL) ✅ (2026-06-22, Nutzer „spreng deine Grenzen / sei grenzenlos")
**Grenzen-Sprung:** Statt nur flacher Vektor-Füllungen rendert die App jetzt **echte GPU-Shader** (SkSL via
`Skia.RuntimeEffect.Make` + `<Shader>`), neu in [rendering/shaders.ts](../apps/mobile/src/rendering/shaders.ts):
- **GROUND-Shader** (auf dem Iso-Feld-Pfad, samplet in WELT-Koordinaten → bleibt beim Pannen stabil): prozeduraler
  Boden per **fBm-Value-Noise** — Gras (Dorf) bzw. Erde (Kampf, `u_grass`-Uniform), mit **Wind-Schimmer** (`u_time`),
  helleren Halmspitzen und dunklen Erdsprenkeln. Ersetzt die flache Verlaufsfläche + Schachbrett-Kacheln.
- **BACKDROP-Shader** (Vollbild-`Fill`, Bildschirmraum): animierter atmosphärischer Hintergrund — driftende
  Nebelbänder, wandernder Lichtblob, ferne Funken, Vignette; lebt über `u_time`.
- **Null-sicher:** `Make` liefert bei Compile-/Treiberfehler `null` → Aufrufer fallen automatisch auf die bisherigen
  Verläufe/Vignette zurück (kein Crash). Bei „Effekte reduzieren" wird der animierte Backdrop übersprungen.
- Verdrahtung: `Terrain` bekommt eine `clock`-Prop (Village + Battle), `VillageCanvas` rendert den Backdrop-Shader,
  beide reichen `clock` durch. Typecheck 0 Fehler. **Emulator (emuclan):** Boden zeigt organische Gras-Textur mit
  Tiefe, **weltstabil beim Pannen** (Plateau-Rand + Backdrop am Feldrand sichtbar), keine SkSL-Fehler im Logcat.
> **Nächste Shader-Frontiers (offen):** animiertes **Wasser** (Fischmenschen), **Tag-Nacht-Zyklus** über
> Backdrop-Uniform, Boden-Schatten der Gebäude als Shader, **Dach-Schindeln** per Shader.

### Visuelle Politur 5 — GEBÄUDE-TEXTUREN per Shader ✅ (2026-06-22, Nutzer „erst die Gebäude-Texturen")
**MATERIAL-Shader** (`materialEffect` in [shaders.ts](../apps/mobile/src/rendering/shaders.ts)) gibt jeder Gebäude-
WAND eine prozedurale Materialoberfläche statt flacher Verläufe — **flächengenau** über eine Welt-UV-Projektion
(`u_o`-Ursprung + `u_ux`/`u_vy`-Flächenachsen → Steinlagen waagerecht, Planken folgen der Wand, pan-stabil) und
richtungsabhängig beleuchtet (`u_shade` je Fläche: Deck hell, links mittel, rechts dunkel). Vier Materialien
(`MAT`): **Stein** (Quaderverband mit Fugen + Tönung je Stein), **Holz** (senkrechte Planken + fBm-Maserung),
**Putz** (glatt mit feinen Flecken), **Metall/Gold** (Glanzstreifen). Zuordnung je Typ via `MATERIAL_FOR`
(Wachturm/Burg/Mauer/Steinlager/Goldmine = Stein, Holzfäller/Kaserne/Holzlager/Steinbruch = Holz, Rathaus = Putz,
Goldlager = Metall). Umsetzung im `Box`-Baustein: bei gesetztem Material drei Shader-Flächen statt Verläufen
(Fallback Verlauf, wenn Shader nicht kompiliert). Material/Clock werden über Modul-Variablen (`_mat`/`_clk`, von
`BuildingSprite` pro Render gesetzt) an alle Box-Instanzen des Gebäudes gereicht — funktioniert durch Reacts
synchrones Tiefen-Rendering (Alt-Architektur), spart das Durchreichen an ~18 Box-Aufrufe. **Emulator (emuclan):**
Stein-Türme/-Mauern, Holz-Hütten, Putz-Rathaus, Metall-Goldlager klar unterscheidbar; keine SkSL-Fehler; 0 Typfehler.

### Skins sichtbar gemacht ✅ (2026-06-22, Politur — die in §5/§6 genannte „natürliche nächste Aufgabe")
Der Backend-Teil (Kauf/Besitz/Anwenden über `player_skins.is_active`) war seit Phase 5 komplett, aber die Renderer
wandten `preview_data` noch **nicht** an → Skins waren unsichtbar. Jetzt werden **angewandte** Skins gerendert
(rein kosmetisch, keine Balance):
- **Neuer Helfer** [rendering/skins.ts](../apps/mobile/src/rendering/skins.ts): `deriveActiveSkins(shopSkins)` destilliert
  die `applied`-Einträge in eine renderfreundliche Tabelle `ActiveSkins` (`buildings` je `building_type`, `units` je
  `unit_type`, `villageTheme`). Farben aus `preview_data` (`primary`/`accent`/`ground`).
- **Store:** neues Feld `activeSkins`. Wird bei **Login/Refresh** (`refreshAll` lädt `fetchShopSkins` fehlertolerant
  mit) sowie bei `loadShop`/`buySkinAction`/`applySkinAction` neu berechnet → Skins sind **sofort nach dem Login**
  im Dorf sichtbar, und ein „Anwenden" im Shop wirkt **ohne Refresh** (gleiche `set`-Quelle).
- **Renderer:**
  - **Gebäude** ([buildingSprite.tsx](../apps/mobile/src/rendering/buildingSprite.tsx)): optionale `skin`-Prop
    überschreibt die Typ-Palette — `primary` → Wand, `dk(primary)` → Dach, `accent` → Akzent. Silhouette/Material-
    Textur/Tier-Effekte bleiben (Identität erhalten, nur Farbe wechselt).
  - **Einheiten** ([BattleCanvas.tsx](../apps/mobile/src/components/battle/BattleCanvas.tsx) +
    [DungeonBattleView.tsx](../apps/mobile/src/components/battle/DungeonBattleView.tsx)): optionale `unitSkins`-Prop;
    eigener Angreifer/Spieler-Körper = `skin.primary ?? unitColor(...)`. **Verteidiger bleiben krimson** (fremde
    Einheiten), **Gegner-Gebäude bleiben ungeskinnt** (es sind fremde Dörfer) — bewusst korrekt.
  - **Dorf-Theme** ([terrain.tsx](../apps/mobile/src/rendering/terrain.tsx)): optionale `tint`-Prop legt eine
    transluzente Boden-Tönung (`villageTheme.ground`, 0.34) über die Hauptfläche — wirkt über Shader **und** Verlauf.
    Nur das **Dorf** wird getönt, das Schlachtfeld nicht.
- Verdrahtung in VillageScreen/BattleScreen/DungeonScreen. mobile `tsc --noEmit` = 0 Fehler.
- **Emulator-Verifikation (vw_pixel, emuclan):** Login → Dorf zeigt das **Rathaus königlich-lila + Goldakzent**
  (`townhall_royal`) und einen **frostig-blassen Boden** (`theme_frostlands`), während alle anderen Gebäude normal
  gefärbt bleiben → beweist den `refreshAll`→`activeSkins`→Render-Pfad direkt nach Login. Bot-Angriff: das
  **Gegner-Rathaus bleibt beige** (ungeskinnt, korrekt), Schlachtfeld **nicht** getönt; deployte Ritter erscheinen
  als **goldene Figuren** (`knight_golden`, statt orange) — im Zoom klar als Einheiten (Körper+Kopf+Outline+HP-Balken)
  von den goldenen Hit-Funken unterscheidbar.
> **Test-Daten:** `emuclan` hat jetzt `townhall_royal`, `theme_frostlands` und `knight_golden` aktiv (per DB für die
> Verifikation gesetzt) — legitimer Spielstand, bewusst behalten für künftige Skin-Sichtprüfungen.

### Neue Rasse: Drachenmenschen ✅ (2026-06-22, Nutzerwunsch — 8. Fraktion)
Eine **8. Fraktion** `dragonfolk` („Drachenmenschen", analog zur ID-Konvention `fishfolk`=Fischmenschen) wurde wie
alle anderen rein **config-getrieben** ergänzt (eiserne Regel: alle Werte in `game-config.json`). **Nur Daten/Logik —
die Grafik kommt separat** (Nutzer liefert pro Rasse ein Bild, siehe §9):
- **Identität:** Thema „Vulkanische Klippen, Drachenhorste, Obsidian-Festungen". **Bonus** +20% Fernkampfschaden
  (feuriger Drachenodem, `ranged_unit_damage_multiplier: 1.20`); **Malus** +20% Rekrutierungskosten aller Einheiten
  (`unit_cost_multiplier: 1.20`). Balanciert/spiegelbildlich zu Orks (+Nahkampf) bzw. Untoten (−Einheitenkosten).
- **Exklusiv-Inhalt** (`factions_exclusive_content.dragonfolk`): Gebäude **Drachenhorst** (`dragon_roost`, TH5,
  3800 Holz/2800 Stein/450 min); Einheiten **Drachenbrut** (`dragon_whelp`, TH4, Fernkampf, 110 HP/15 DPS/Range 4)
  und **Flammendrache** (`flame_drake`, TH8, Elite-Fernkampf **mit Splash**, 230 HP/24 DPS/Range 5).
- **Code-Änderung minimal:** nur `FactionId` + `FACTION_IDS` in [gameConfig.ts](../packages/shared/src/types/gameConfig.ts)
  erweitert → `factionSchema` (Zod), `validateGameConfig`, AuthScreen-Fraktionsliste (`Object.keys(config.factions)`)
  kaskadieren automatisch. DB `players.faction` ist `VARCHAR(20)` ohne CHECK → keine Migration nötig (Kommentar in 001
  aktualisiert).
- **Verifikation:** alle 3 Workspaces `tsc --noEmit` = 0 Fehler. Server neu gestartet → `GET /api/config` listet
  `dragonfolk`. **HTTP-Register** mit `faction=dragonfolk` ok (Spieler `dragontest1`/`dragontest123` angelegt).
  **Engine-Check** (tsx, temporär): exklusive Einheiten auflösbar (`dragon_whelp*`, `flame_drake*`), Bonus greift
  (Bogenschütze 14→16,8 DPS ×1,20; Flammendrache Splash aktiv), Malus greift (Bogenschütze 50→60 Holz ×1,20).
  **Emulator (vw_pixel):** Registrierung zeigt jetzt **8 Fraktionen**, „Drachenmenschen" ist auswählbar (gelb markiert).
- **Visuals noch generisch:** Gebäude/Einheiten rendern vorerst über die Fallback-Pfade (`buildingSprite` default =
  „magisches Gebäude", Einheiten = blau). Das **Aussehen wird als Nächstes** anhand der Nutzer-Bilder umgesetzt (§9).

### Permanente Test-Suite + Combat-Bugfix ✅ (2026-06-22, Qualität/Regressionsschutz)
Bisher wurde jede Phase mit **temporären** Skripten verifiziert, die danach **gelöscht** wurden → **kein dauerhafter
Regressionsschutz**, gerade während die laufende Grafik-Arbeit gemeinsame Renderer/Logik anfasst. Jetzt gibt es eine
**permanente Test-Suite** für die plattformunabhängige Spiellogik in `packages/shared`:
- **85 Tests** über den **Node-eigenen Test-Runner** (`node:test` + `node:assert`, ausgeführt mit dem schon vorhandenen
  `tsx` — **keine** neue Test-Library, **kein** Emulator/Postgres/Redis nötig, da reine Funktionen). Dateien unter
  [packages/shared/test/](../packages/shared/test/): `combat`, `economy`, `units`, `dungeon`, `clans`, `factions`,
  `render`, `tierNames` + `helpers.ts` (lädt die echte `game-config.json`) + `README.md`.
- **Prinzip:** Die Tests laden die **echte** `server/config/game-config.json` und leiten ihre Erwartungen **aus der
  Config ab** (keine hartcodierten Spielzahlen) → sie prüfen die **Regel-/Transformationslogik** (Fraktions-Modifikatoren,
  Caps, Aufrundung, Tabellen-Lookups, Determinismus der geseedeten Dungeon-Wellen, Kampf-Endbedingungen, Trophäen-Deltas
  exakt +28/+35/+18/−14/−22/−30, Loot 20 %, Housing-Mathematik, Iso-Geometrie-Roundtrip) und bleiben bei Config-Änderungen
  gültig.
- **Ausführen:** `npm test` (Tests) und `npm run test:types` (typecheckt die Tests via `tsconfig.test.json`) — beides vom
  Root oder aus `packages/shared`. Neue Skripte in [package.json](../package.json) + [packages/shared/package.json](../packages/shared/package.json);
  `tsx`/`@types/node` als devDeps von `shared` ergänzt (waren via Server bereits im Lockfile → schneller `npm install`).
- **Verifikation:** **85/85 grün**, `test:types` sauber, **alle 3 Workspaces `tsc --noEmit` = 0 Fehler** (shared, server, mobile).
> **1 echter Bug beim Schreiben der Combat-Tests gefunden & behoben** ([combat.ts](../packages/shared/src/game/combat.ts)):
> Der Zerstörungs-Prozentsatz wurde aus einem **Schadens-Akkumulator** (`destroyed_building_hp += applied`) berechnet, der
> durch Float-Summierung minimal driftete → eine **komplette** Dorf-Zerstörung zeigte `Math.floor(1999.9999…/2000·100)` =
> **99 %** statt 100 % (Ergebnis/Sieg war korrekt, nur die Anzeige fiel ein Prozent zu niedrig). **Fix:** `destruction_pct`
> wird jetzt pro Tick **aus dem Gebäude-Wahrheitszustand** abgeleitet (`Σ(max_hp − hp)`); zerstörte Gebäude haben `hp=0` und
> tragen damit **exakt** ihre `max_hp` bei → volle Zerstörung ergibt **genau 100 %**. Partieller Schaden unverändert, die
> `win_destruction_threshold`-Prüfung wird dadurch nur **genauer**. Per Test abgesichert (`stepBattle: übermächtige Armee … → 100 %`).

### Permanente Server-E2E-Suite ✅ (2026-06-23, Regressionsschutz für die HTTP-Schicht)
Ergänzend zur Shared-Logik-Suite gibt es jetzt eine **dauerhafte End-to-End-Suite**, die die **echte Express-App** (inkl.
Socket.io) gegen eine **eigene** Test-DB hochfährt und über echtes HTTP (`fetch`) **und echte Socket-Clients** durchtestet —
ersetzt die früheren temporären Service-/HTTP-Skripte. Dateien unter [server/test/](../server/test/) (`harness.ts`,
`setup-env.ts`, `e2e.test.ts` + `suites/*.suite.ts` + `README.md`):
- **62 Tests, 62 grün** über `node:test` + `fetch` + `socket.io-client`. Decken die **volle Schicht** ab (Routing →
  Auth-Middleware → Zod → Service → Postgres → zentrale Fehler-Abbildung): Auth (register/login/refresh/401), Dorf
  (platzieren/Upgrade-Start/-Skip/Inventar/22P02→400), Einheiten (Training/Settle/Entlassen/Freischalt-Gate), Clans
  (**TH5-Gate**, erstellen/beitreten/Doppelbeitritt-409, **Burg-Housing** inkl. Über-Cap-400, Leadership-403, Ranglisten),
  Dungeon (Zeitfenster offen/zu, **verborgene Wellen**, Volldurchlauf mit Belohnung, `one_run_per_week`-409, Historie),
  Shop+IAP (kaufen/anwenden/Doppelkauf-409, **Sandbox-Idempotenz** gleiche txid → nur 1× gutgeschrieben), Meta/Fehler
  (health/config/404/401).
- **Socket.io-Live-Kampf (6 Tests, [battle.suite.ts](../server/test/suites/battle.suite.ts)):** zwei echte Socket-Clients
  (Angreifer + **online** Verteidiger) treiben den vollen Echtzeit-Fluss — Handshake-JWT (ungültig→abgelehnt),
  Matchmaking (`join`→`searching`→`cancel`), **voller Kampf** (`matchmaking:matched`→`battle:setup`→`battle:start`→60×
  `deploy_unit`→`state_update`s→**`battle:ended` attacker_win + Loot**), **Aufgeben** (`surrender`→defender_win),
  Doppel-Angriff→`battle:error`. Echter Online-Gegner (kein 90-s-Bot-Warten); Matchmaking-Loop + `initSockets` laufen
  in der Harness, `stopMatchmaking()`/`io.close()` im Teardown.
- **Clan-Krieg-Duell (2 Tests, [clanwar.suite.ts](../server/test/suites/clanwar.suite.ts)):** `clanwar:join` ohne Krieg →
  `battle:error`; **volles Duell** zwischen zwei geseedeten Kriegs-Clans → `mode='clan_war'`, Gegner = echtes feindliches
  Mitglied, voller Kampf → **Kriegspunkte = Zerstörung**, `battles`-Zeile mit `clan_war_id`, **0 Solo-Trophäen / 0 Loot**
  (getrennter Wettbewerb verifiziert). Aktiver Krieg wird per SQL geseedet (Clan-Krieg-Matchmaking läuft in der Harness nicht).
- **Eigene Test-DB `village_wars_test`** — pro Lauf frisch **DROP/CREATE + migriert + geseedet**; die Dev-DB
  `village_wars` wird **nie** berührt (`setup-env.ts` setzt `DATABASE_URL`, bevor `env.ts`/Pool laden; `dotenv` überschreibt
  Gesetztes nicht). **Ein Prozess, ein Einstieg** (`e2e.test.ts` bündelt alle Suiten via `before/after`); Socket.io +
  Solo-Matchmaking laufen, **Cron + Clan-Krieg-Matchmaking** bleiben aus. God-Mode-Helfer (`sql`, `grant`,
  `setTownHallLevel`, `giveUnits`, `connectSocket`/`waitEvent`); `--test-force-exit`, damit der Runner trotz offener
  `fetch`-/Socket-Keep-Alive-Handles sauber beendet.
- **Voraussetzung:** das portable Test-Postgres muss laufen (§2). **Ausführen:** `npm run test:server` (+
  `npm run test:types` deckt jetzt shared **und** server ab). **Beide** Socket-Pfade (Solo-Matchmaking **und**
  Clan-Krieg `clanwar:join`) sind jetzt automatisiert — die gesamte Echtzeit-Kampf-Schicht ist abgedeckt.
> **Kleine Infra-Verbesserung dabei:** Die Rate-Limits (vorher hartcodiert 120/min global, 15/min Auth) sind jetzt
> **env-konfigurierbar** (`RATE_LIMIT_MAX`/`AUTH_RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` in `env.ts`+`middleware/rateLimit.ts`,
> **Produktions-Defaults unverändert**) — die Tests setzen sie hoch, statt in 429 zu laufen; hilft auch bei Lasttests.

### Emulator-Gesamttest + KRITISCHER Kampf-Bug gefixt ✅ (2026-06-23, alle Screens auf `vw_pixel`)
Kompletter App-Durchlauf auf dem Android-Emulator (nativer Dev-Build, Backend :4000 gegen Dev-DB `village_wars`,
Metro unter Node 20, Login `emuclan`). **Alle Screens visuell verifiziert** (Screenshots in `design/emu/`):
- **Auth:** Registrierung mit **8 Fraktionen** (inkl. Drachenmenschen), Login.
- **Dorf:** Ressourcen-Chips, Menschen-Gebäude (5-Turm-Keep/Türme/Kanonenturm/Clan-Burg) auf Gras, Header (Angreifen/🛡/☰).
- **Clan:** EmuGarde [EMU], Mitglieder, **Burg** (Stellplätze 2/15, „Aus Armee stationieren"). **Rangliste:** Solo, eigener
  #1 hervorgehoben, **Gleichstand teilt den Rang** (RANK()-Fix sichtbar), Paginierung. **Shop:** 6 Skins (Besitz-Status),
  **IAP** 5 Goldbarren-Pakete + Sandbox-Hinweis. **Dungeon:** korrekt „Geschlossen · öffnet Sa., 27.06., 05:00 Uhr"
  (Berlin-TZ), Wellen „❓ verborgen". **Einstellungen:** Effekte-/Sound-Schalter. **Armee:** alle Einheiten inkl.
  ★-Menschen-Exklusiven (Speerkämpfer/Axtkämpfer/…); **Training** (+5 → Holz-Abzug, „im Training: 5").
> **KRITISCHER Bug gefunden (Emulator) & gefixt** ([combat.ts](../packages/shared/src/game/combat.ts), [dungeon.ts](../packages/shared/src/game/dungeon.ts)):
> Beim **Angreifen** wurde ein Bot gematcht, 45 Milizen deployt — aber **0 % Zerstörung über 300 s** trotz nur 1 Gebäude.
> Ursache: Beim Heranlaufen an ein Gebäude blieb eine Nahkampf-Einheit durch **Float-Rundung exakt auf Reichweite
> hängen** (`d ≈ range + 1e-15`, also `d > range` blieb dauerhaft wahr) → sie „schnappte" ewig zur Reichweite und trat
> **nie** in den Angriffs-Zweig. **Einheiten, die zum Gebäude laufen mussten, richteten NIE Schaden an** — d. h. fast
> jeder reale Angriff (Deploy am Rand statt direkt aufs Gebäude) wäre fehlgeschlagen. Die Test-Suiten verfehlten ihn,
> weil sie immer **direkt aufs Gebäude** deployten (`th.gx+0.5`). **Fix:** Reichweiten-Vergleich mit Toleranz
> `d > u.range + EPS` an **3 Stellen** (Angreifer-vs-Gebäude, `moveAndStrike` für Clan-Verteidiger, Dungeon-Einheiten).
> **Regressionstest** ergänzt ([combat.test.ts](../packages/shared/test/combat.test.ts): „ABSEITS deployte Einheiten laufen
> heran und zerstören"). **Verifikation:** Shared **86/86**, Server-E2E **62/62**, 3× tsc 0 Fehler; **am Emulator
> nachgestellt:** Angriff abseits → vorher **0 %/Niederlage −30🏆**, nach Fix (+Server-Neustart) → **100 %/🏆 SIEG! +18,
> Beute 100/60** (mit goldener Sieg-Sequenz). Der Bug war live reproduzierbar und ist live behoben.

### Programm „CoC-Level" — P1: Daily-Rewards + Login-Streak ✅ (2026-06-27, Retention-Primitiv #1)
**Neuer Programm-Strang:** Auf Nutzerwunsch („App auf CoC-Niveau oder höher, beliebter machen") wurde eine
**datengestützte [ROADMAP.md](ROADMAP.md)** erstellt (Web-Recherche zu CoC-Erfolg/Retention/Kritik → 10 priorisierte
Pillars). **Leitprinzip:** rein kosmetische, **faire** Monetarisierung als Differenzierung gegen die CoC-P2W-Kritik.
**P1 (Daily-Rewards + Streak)** ist als erster vollständiger Vertical-Slice fertig:
- **Config** (`daily_rewards`, eiserne Regel): 7-Tage-Belohnungsleiter (zyklisch), `scale_resources_with_town_hall`
  (Ressourcen × Rathaus-Level, damit auch spät relevant — wie CoC), Gems/Goldbarren unskaliert; **Goldbarren am Tag-7-
  Höhepunkt = verdienbare Premium-Währung** (fair).
- **Reine Logik** [shared/game/dailyRewards.ts](../packages/shared/src/game/dailyRewards.ts): `decideStreak`
  (heute schon? / gestern → +1 / Lücke → Reset auf 1), `rewardForStreakDay` (zyklisch), `scaleTier`, `previousDate`.
  „Ein Tag" = Europe/Berlin-Kalendertag ([utils/berlinDate.ts](../server/src/utils/berlinDate.ts), konsistent mit Dungeon/Season).
- **Backend:** Migration **011** (`player_daily_rewards`: streak/longest/last_claim_date/total_claims),
  `dailyRewardService.ts` (Status + Claim, server-autoritativ einmal/Tag, **Ressourcen auf Lager-Cap gekappt** wie Loot/Dungeon,
  Gems/Goldbarren ungekappt), Routen `GET /api/daily/status` + `POST /api/daily/claim`.
- **Mobile:** Client-Methoden + Store (`dailyStatus`/`showDailyReward`, in `refreshAll` mitgeladen) + zentriertes
  **[DailyRewardSheet.tsx](../apps/mobile/src/components/ui/DailyRewardSheet.tsx)**-Popup (7-Tage-Leiter, heutiger Tag gold
  hervorgehoben, „Abholen" → „✓ Abgeholt!"), eingehängt in `App.tsx`.
- **Verifikation:** **94 Shared-Tests** (+8 daily: Streak-Fortsetzung/Reset/Zyklus/Skalierung) + **68 Server-E2E** (+6 daily:
  Claim/Doppel-Claim-400/Streak via SQL-Datum) grün; 3× `tsc` sauber. **Emulator (`vw_pixel`, emuclan=RH5):** Login →
  Popup „🎁 Tägliche Belohnung", HEUTE=Tag 1 = **🪵2500/🪨1500 (×5 RH-Skalierung korrekt)** → „Abholen" → **Streak 0→1**,
  „✓ Abgeholt!", Header **Stein 860→2.360** (Holz bei 12.000 gecappt = korrekt), DB `player_daily_rewards` streak=1/total=1.
> **Nebenbei behoben:** ein **datumsabhängiger Dungeon-Test** (nahm einen Wochentag an → schlug am Wochenende fehl, da der
> Dungeon Sa/So **legitim offen** ist) wurde robust gemacht (prüft jetzt gegen die echte `isDungeonOpen`-Logik).

### Programm „CoC-Level" — P2: Achievements ✅ (2026-06-27, Retention/Ziele) + Grafik-Track gestartet
**P2 (Achievements)** als zweiter Vertical-Slice fertig — Ziele mit **verdienbaren Goldbarren/Gems** (verstärkt die faire
Monetarisierung):
- **Config** (`achievements.definitions`, 7 Achievements/23 Stufen): Metriken `trophies | town_hall_level | battles_won |
  longest_daily_streak | dungeons_cleared | clan_member | buildings_count`, gestaffelte Schwellen, Top-Stufen geben
  **Goldbarren** (verdienbar = fair).
- **Reine Logik** [shared/game/achievements.ts](../packages/shared/src/game/achievements.ts): `reachedTierCount`,
  `nextThreshold`, `claimableReward` (Summe Stufen [claimed, reached)), `buildAchievementView`.
- **Backend:** Migration **012** (`player_achievements`: nur die höchste **abgeholte** Stufe; Fortschritt wird **live aus
  dem Spielstand** berechnet — keine Event-Instrumentierung nötig), `achievementService.ts` (Metriken per Query,
  Claim grant Gems+Goldbarren), Routen `GET /api/achievements` + `POST /api/achievements/:id/claim`.
- **Mobile:** Client + Store (in `refreshAll` mitgeladen → **Menü-Badge „abholbar"**), neuer
  [AchievementsScreen.tsx](../apps/mobile/src/screens/AchievementsScreen.tsx) (Fortschrittsbalken, Stufen, Abhol-Button mit
  exakter Belohnung), Menüpunkt „🏅 Erfolge", App-Routing.
- **Verifikation:** **99 Shared** (+5) + **76 Server-E2E** (+8: master_builder/trophy_hunter Claim, Doppel-Claim-400, neue
  Stufen später) grün; 3× `tsc` sauber. **Emulator (emuclan=RH5, 1108🏆, im Clan):** Menü zeigt „🏅 Erfolge" mit Badge **5**
  → Screen mit **korrekten Belohnungen** (Trophäenjäger 💎7/🥇10, Baumeister 💎11) → „Trophäenjäger" abholen → Header
  **💎 0→7, 🥇 2.980→2.990**, Badge 5→4, Button weg; DB `player_achievements` claimed_tier=3.
> **Emulator-Stolperfalle bestätigt (§9.4):** `swiftshader_indirect` macht `screencap` zuverlässig, **crasht aber unter Last**
> (Emulator+Metro+Backend) — einmal abgestürzt (exit 139), neu gestartet, Verifikation abgeschlossen. Boot war danach ~10 s.

### Programm „CoC-Level" — P3: Truppen-Level / Forschungslabor ✅ (2026-06-28, Tiefe)
**P3 (Truppen-Level)** als dritter Vertical-Slice fertig — größte Tiefen-Lücke zu CoC geschlossen: Einheiten können im Labor Level-für-Level erforscht werden, HP/DPS steigen per Level:
- **Config** (`unit_research`, eiserne Regel): `max_level: 10`, `hp_bonus_per_level_percent: 8`, `dps_bonus_per_level_percent: 7`, gestaffelte Goldkosten + Forschungszeiten (Level 2 → 9 Stufen).
  Neues Gebäude `research_lab` (TH3, `buildings_common`, base_hp 600, 1500 Holz/1000 Stein/90 min).
- **Reine Logik** [shared/game/research.ts](../packages/shared/src/game/research.ts): `getResearchCost`, `researchHpMultiplier`, `researchDpsMultiplier`, `getUnitLevel`, `hasResearchLab` — plattformunabhängig.
  **`getUnitCombatStats`** ([units.ts](../packages/shared/src/game/units.ts)) um optionalen `level`-Parameter erweitert — Level 1 = kein Bonus, kein Regressionsrisiko.
- **Typen** [types/gameConfig.ts](../packages/shared/src/types/gameConfig.ts): `UnitResearchConfig`, `ResearchLevelCost`. [types/api.ts](../packages/shared/src/types/api.ts): `ResearchStatusResponse`, `ResearchQueueEntry`.
  [types/combat.ts](../packages/shared/src/types/combat.ts): `BattleState.attacker_unit_levels`.
- **Backend:** Migration **013** (`unit_research` + `research_queue`, Index auf `finishes_at`),
  `researchService.ts` (Status/Settle-on-Read, Start/Validierung [Labor+Queue+Gold+Level], Abbruch, Cron `finishDueResearch`, `loadUnitLevels` für Battle),
  Routen `GET /api/research` + `POST /api/research/start` + `DELETE /api/research/cancel`.
  `battleService.ts` lädt Angreifer-Level beim Kampfstart (`loadUnitLevels`) und übergibt sie als `attackerUnitLevels` an `initBattleState` → `deployUnit` wendet sie über `getUnitCombatStats(config, type, faction, level)` an.
  Cron um `finishDueResearch` erweitert (jede Minute, wie Upgrades/Training).
- **Mobile:** `ResearchStatusResponse` im API-Client, Store (`research`, `loadResearch`/`startResearchAction`/`cancelResearchAction`, `ActiveScreen` um `'research'` erweitert), neuer [ResearchScreen.tsx](../apps/mobile/src/screens/ResearchScreen.tsx) (Labor-Gate, aktive Forschungsanzeige + Abbruch, alle Einheiten der Fraktion mit Level-Badge/Bonus-Anzeige/Forschungs-Button), Menüpunkt „🔬 Labor", App-Routing.
- **Verifikation:** **116 Shared** (+17 Research-Tests: Kosten monoton/Abdeckung, HP/DPS-Multiplikatoren, `getUnitLevel`, `hasResearchLab`, Fraktions-Mod + Research kombiniert) + **85 Server-E2E** (+9: frischer Stand, ohne Labor → 400, Gold abgezogen + active gesetzt, Doppel-Start → 400, zu wenig Gold → 400, Settle-on-Read nach Timeout, Abbruch kein Rückgeld, Abbruch ohne Queue → 400, Auth) grün; 3× `tsc` sauber.
  **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8": research_lab-Gate + Forschungsstart live geprüft).**

### Programm „CoC-Level" — P4: Quests / Daily-Tasks ✅ (2026-06-28, Retention)
**P4 (Tägliche Quests)** als vierter Vertical-Slice fertig — vier tägliche Mini-Ziele mit Fortschrittsbalken und manuell einsammelbarer Belohnung:
- **Config** (`daily_quests.definitions`, eiserne Regel): 4 Quests — `attack_3` (3 Kämpfe → 500 Gold), `upgrade_1` (1 Upgrade → 300 Gold), `train_10` (10 Truppen → 200 Gold + 1 Gem), `research_start` (1 Forschung → 2 Gems). Reset täglich (neues DB-Datum).
- **Typen** [types/gameConfig.ts](../packages/shared/src/types/gameConfig.ts): `DailyQuestDef`, `QuestType`, `DailyQuestsConfig`. [types/api.ts](../packages/shared/src/types/api.ts): `DailyQuestProgress`, `DailyQuestsResponse`.
- **Reine Logik** [shared/game/quests.ts](../packages/shared/src/game/quests.ts): `getQuestDefinitions`, `getQuestDef`, `isQuestComplete`.
- **Backend:** Migration **014** (`daily_quest_progress`: player_id + quest_id + quest_date als PK, progress cap'd auf target, claimed-Flag). `questService.ts`: `getQuestStatus`, `incrementQuestProgress` (UPSERT + cap auf target, wird fire-and-forget von battleService/upgradeService/unitService/researchService gerufen), `claimQuest` (Validierung + Gold/Gems + claimed-Flag in Transaktion). Routen `GET /api/quests` + `POST /api/quests/claim`. Fortschritts-Inkrementierung integriert in: `battleService` (attacks bei `prepareBattle`), `upgradeService` (upgrades nach `startUpgrade`), `unitService` (troops_trained mit quantity nach `trainUnits`), `researchService` (researches nach `startResearch`).
- **Mobile:** `DailyQuestsResponse` im API-Client, Store (`quests`, `loadQuests`/`claimQuestAction`, `ActiveScreen` um `'quests'` erweitert), neuer [QuestScreen.tsx](../apps/mobile/src/screens/QuestScreen.tsx) (4 Cards mit Fortschrittsbalken, Belohnungstext, Claim-Button, Tagesstempel), Menüpunkt „📋 Quests", App-Routing.
- **Verifikation:** **125 Shared** (+9 Quest-Tests: Def-Anzahl, getQuestDef, isQuestComplete, Types eindeutig, positive targets) + **95 Server-E2E** (+10: frischer Stand/4 Quests/progress 0, quest_date ISO, Claim Gold, Claim Gems, Quest noch nicht fertig → 400, Doppel-Claim → 400, unbekannte ID → 400, Progress-Cap-Verhalten, Auth×2) grün; 3× `tsc` sauber. **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8").**

### Programm „CoC-Level" — P5: Ziel-Prioritäten der Einheiten ✅ (2026-06-28, Kampf-Tiefe)
**P5 (Targeting)** macht Deploy taktisch — Einheiten fliegen bevorzugte Gebäude-Kategorien an:
- **Config** (`unit_target_priorities`, eiserne Regel): `building_categories` (defense: Wachturm/Kanone; resource: Goldmine/Holzfäller/Steinbruch/Lager; wall: Mauer) + `unit_priorities` (knight→defense, shieldbearer/siege_knight→defense, stone_giant→defense, berserker→resource, blade_dancer→resource, battering_ram→wall).
- **Typen** [types/gameConfig.ts](../packages/shared/src/types/gameConfig.ts): `BuildingCategory`, `TargetPriority`, `UnitTargetPrioritiesConfig`. [types/combat.ts](../packages/shared/src/types/combat.ts): `BattleBuilding.category`, `BattleUnit.target_priority`.
- **Kampf-Engine** [shared/game/combat.ts](../packages/shared/src/game/combat.ts): `getBuildingCategory` (leitet Kategorie bei `initBattleState` aus Config ab), `getTargetPriority` (liest Einheits-Priorität beim Deploy), `priorityTarget` (ersetzt `nearestBuilding`-Aufruf im Tick-Loop: zeigt zuerst auf nächstes lebendes Gebäude der bevorzugten Kategorie, Fallback auf nearest). Rückwärtskompatibel: fehlende Config → 'nearest'.
- **Keine Backend-Änderung, keine Migration, keine Mobile-Änderung** — rein in der Engine (shared-Code).
- **Verifikation:** **137 Shared** (+12: Kategorie-Ableitung×4, target_priority im deployUnit×4, Targeting knight/berserker/ram/Fallback×4) + **95 Server-E2E** (unverändert, alle grün); 3× `tsc` sauber. **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8").**

### Programm „CoC-Level" — P6: Helden ✅ (2026-06-28, Progression & Identität)
**P6 (Helden)** als sechster Vertical-Slice fertig — jede Fraktion hat einen persistenten Helden, der Level-für-Level aufgewertet wird, nach Kämpfen regeneriert und im Kampf eingesetzt werden kann:
- **Config** (`heroes`, eiserne Regel): `max_level: 10`, `hp_bonus_per_level_percent: 6`, `dps_bonus_per_level_percent: 5`, `regen_minutes_per_level: 10`, `requires_building: 'hero_hall'`; 9 Level-Kosten-Stufen (to_level 2–10); `faction_heroes` für alle 8 Fraktionen (id, display_name, housing_space, base_hp, base_dps, speed). Neues Gebäude `hero_hall` (TH5, `buildings_common`, 2500 Holz/2000 Stein/240 min, base_hp 800).
- **Reine Logik** [shared/game/heroes.ts](../packages/shared/src/game/heroes.ts): `getHeroDef`, `getHeroLevelCost`, `heroHpMultiplier` / `heroDpsMultiplier` (1 + (level-1)×pct/100), `heroCurrentHp` / `heroCurrentDps` (gerundet), `heroRegenMinutes` (regen_minutes_per_level × level), `isHeroReady` (null/Vergangenheit → bereit), `hasHeroHall` (Level ≥ 1 nötig).
- **Typen** [types/gameConfig.ts](../packages/shared/src/types/gameConfig.ts): `FactionHeroDef`, `HeroLevelCost`, `HeroesConfig`. [types/api.ts](../packages/shared/src/types/api.ts): `HeroStatusResponse` (hero_id, display_name, level, leveling_until, regenerates_until, no_hall, base_hp, base_dps).
- **Backend:** Migration **015** (`heroes`: player_id PK, level, regenerates_at; `hero_level_queue`: player_id PK, target_level, started_at DEFAULT now(), finishes_at). `heroService.ts`: `getHeroStatus` (Settle-on-Read via `settleFinishedLevelUps`, no_hall-Flag), `startHeroLevelUp` (Validierung: Hall/Queue/Level/Gold, Gold-Abzug in TX, Queue-Eintrag), `cancelHeroLevelUp` (Queue löschen, kein Gold zurück), `setHeroRegenAfterBattle` (fire-and-forget nach Kampf), `loadHeroForBattle` (liefert Stats wenn bereit), `finishDueHeroLevelUps` (Cron). Routen `GET /api/heroes`, `POST /api/heroes/levelup`, `DELETE /api/heroes/levelup`. `battleService`: setzt nach Kampf `setHeroRegenAfterBattle` fire-and-forget. Cron um Hero-Level-Up-Abschluss erweitert (jede Minute).
- **Mobile:** `HeroStatusResponse` im API-Client, Store (`hero`, `loadHero`/`startHeroLevelUpAction`/`cancelHeroLevelUpAction`, `ActiveScreen` um `'hero'` erweitert), neuer [HeroScreen.tsx](../apps/mobile/src/screens/HeroScreen.tsx) (Kein-Heldenhalle-Gate, Helden-Karte mit HP/DPS, Leveling-Timer + Cancel, Regen-Timer, Status-Badge, Level-Up-Card mit Kosten/Button), Menüpunkt „🦸 Held", App-Routing.
- **Held im Kampf (Integration, 2026-06-28):** Der Held kämpft jetzt tatsächlich (vorher war `loadHeroForBattle` nirgends aufgerufen — der Held regenerierte nach einem Kampf, an dem er nie teilnahm). Umsetzung: neuer `heroCombatStats(config, faction, level)` ([heroes.ts](../packages/shared/src/game/heroes.ts)) leitet Engine-Stats ab (Speed aus `unit_speed_tiles_per_second[tier]`, Range = `range_tiles` bzw. Nahkampf-Fallback, HP/DPS aus Level; **keine** Fraktions-Kampfmodifikatoren, da Helden-Werte schon fraktionsspezifisch). `BattleHeroStats`-Typ + `BattleState.hero` + `BattleSetupPayload.hero` ([combat.ts-Typen](../packages/shared/src/types/combat.ts)). Engine: `InitBattleParams.hero` → Held kommt als **1 zusätzliche Einheit** in die Reserve (Schlüssel `HERO_UNIT_TYPE='hero'`); `deployUnit` löst beim Deploy die Helden-Stats aus `state.hero` auf (nicht aus units-Config). `battleService.prepareBattle` lädt den Helden via `loadHeroForBattle`, übergibt ihn der Engine, hängt ihn an `setup.army` (+`setup.hero`); **Held wird NICHT verbraucht** (nicht in `initialArmy`, also kein Abzug). `loadHeroForBattle` gated jetzt auf **Heldenhalle** (`hasHeroHall`) statt auf eine vorhandene `heroes`-Zeile — der Held ist **ab Level 1 einsatzbereit, sobald die Halle steht** (konsistent mit `getHeroStatus`/UI); die `heroes`-Zeile entsteht erst beim ersten Level-Up bzw. nach dem ersten Einsatz. `finalizeBattle` regeneriert den Helden **nur wenn er eingesetzt wurde** (behebt latenten Bug: vorher legte jeder Angriff via `setHeroRegenAfterBattle` eine Helden-Zeile an — auch ohne Heldenhalle). Mobile: [DeployBar.tsx](../apps/mobile/src/components/battle/DeployBar.tsx) zeigt den Helden als goldenes „🦸 Name"-Item (Anzeigename aus `setup.hero`), BattleScreen reicht `battleSetup.hero` durch.
  > **Bug gefunden & gefixt dabei:** `loadHeroForBattle` nutzte `SELECT id FROM hero_level_queue` — die Tabelle hat **keine** `id`-Spalte (PK = `player_id`). Die Query warf → `prepareBattle` schlug fehl → **alle** Kämpfe liefen ins Setup-Timeout. Fix: `SELECT 1`. (Gleicher Fehler war zuvor schon in `startHeroLevelUp` behoben worden.) Per E2E abgesichert.
- **Verifikation:** **168 Shared** (+20 Hero-Logik + 11 Hero-im-Kampf: heroCombatStats Nahkampf/Fernkampf/Splash/Level-Skalierung, initBattleState mit/ohne Held, deployUnit Held-Stats + Reserve-Cap, stepBattle Held richtet Schaden an / ohne Einsatz kein Schaden) + **107 Server-E2E** (+11 Hero-REST +1 Hero-im-Kampf-Socket: Setup enthält Held → Deploy → Sieg → `regenerates_at` gesetzt) grün; 3× `tsc` + `test:types` sauber. **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8").**
  > **Nebenbei:** vorbestehender Typfehler in `targeting.test.ts` (P5) behoben — doppeltes `factions_exclusive_content` im Test-Config-Literal (`test:types` hatte das geflaggt; `npm test`/`tsx` lief trotzdem).

### Programm „CoC-Level" — P7 (Season-/Battle-Pass) fertig (2026-06-28)
**P7** als siebter Vertical-Slice fertig — ein an die `seasons`-Tabelle gekoppelter Belohnungs-Pass mit Gratis- und Premium-Track, der einen Wiederkehr-Rhythmus schafft:
- **Config** (`season_pass`, eiserne Regel): `premium_cost_gems` (150), `xp_per_action` (battle_win 50 / dungeon_clear 80 / quest_claim 30), 12 Stufen mit je `xp_required` (kumulativ, Stufe 1 bei 0), `free`- und `premium`-Belohnung. Premium kostet **Gems** (verdienbar via Achievements/Quests/Daily → fair, kein P2W); Top-Stufen geben Goldbarren.
- **Shared** [seasonPass.ts](../packages/shared/src/game/seasonPass.ts): reine Logik `seasonPassTiers`/`maxSeasonPassTier`/`seasonPassTierDef`/`currentSeasonPassTier`/`isSeasonPassTierReached`/`nextSeasonPassTierXp`. Typen `SeasonPassConfig`/`SeasonPassTier`/`SeasonPassReward`/`SeasonPassXpAction` (gameConfig) + `SeasonPassResponse`/`SeasonPassTierView`/`SeasonPassActionResponse`/`SeasonPassTrack` (api).
- **DB Migration 016:** `season_pass_progress` (player_id, season_number, xp, premium_unlocked; PK player+season) + `season_pass_claims` (player_id, season_number, tier, track; PK alle vier, CHECK track∈free/premium). An Saison gekoppelt: neue `season_number` → neuer Pass (neue Zeilen), alte bleiben als Historie.
- **Server** [seasonPassService.ts](../server/src/services/seasonPassService.ts): `getSeasonPassStatus` (aktive Saison, XP, Stufen-Views, Claims), `addSeasonPassXp(playerId, action)` (fire-and-forget UPSERT, Betrag aus Config), `unlockPremium` (TX: Gems prüfen+abziehen, Flag setzen), `claimTier` (TX: erreicht? + Premium freigeschaltet? + nicht doppelt via `INSERT … ON CONFLICT DO NOTHING` + rowCount-Guard; Belohnung mit Ressourcen-Cap wie Daily/Loot). Routen `/api/season-pass` GET/`/unlock`/`/claim` (zod `{tier, track}`).
- **XP-Verdrahtung (fire-and-forget):** `battleService.finalizeBattle` (Solo-Sieg, kein Clan-Krieg), `dungeonService.completeDungeonWave` (Lauf gewonnen, nach Commit), `questService.claimQuest`.
- **Mobile:** Client (`fetchSeasonPass`/`unlockSeasonPassPremium`/`claimSeasonPassTier`), Store (`seasonPass`, `loadSeasonPass`/`unlockSeasonPassAction`/`claimSeasonPassAction`, unlock/claim aktualisieren Spieler+Pass), neuer [SeasonPassScreen.tsx](../apps/mobile/src/screens/SeasonPassScreen.tsx) (XP-Balken, Premium-Freischalt-Button, Belohnungsleiter free/premium mit Abhol-Buttons & Schloss-Zuständen), Menüpunkt „🎟️ Season-Pass", `ActiveScreen`+App-Routing.
- **Verifikation:** **182 Shared** (+14: Sortierung, monotone XP, Stufe-1-bei-0, maxTier, tierDef, currentTier-Grenzfälle, isReached, nextTierXp inkl. Maximum, Belohnungen nicht leer, premium_cost>0) + **119 Server-E2E** (+12: frischer Status, Claim free + Doppel-Claim→400 + nicht-erreicht→400, Premium-Claim ohne Unlock→400, Unlock ohne/mit Gems + doppelt→400, Premium-Claim nach Unlock, XP-Fortschritt hebt Stufe, Auth×2) grün; 3× `tsc` + `test:types` sauber. **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8").**
  > **Limited-Time-Events** (zweiter Teil von P7 laut Roadmap) bewusst als eigener Folge-Slice offen gelassen — der Pass-Kern ist der höherwertige Retention-Hebel und in sich vollständig.

### Programm „CoC-Level" — Emulator-Verifikation P3–P8 ✅ (2026-06-28, `vw_pixel`, emuclan)
Alle bis dahin nur test-grünen Pillars P3–P8 wurden auf dem Android-Emulator (nativer Dev-Build `com.villagewars.app`, neues Metro-Bundle auf der bestehenden APK — kein Gradle-Rebuild, da nur JS/TS) **visuell + interaktiv** geprüft. **0 neue Bugs.** Login `emuclan` (Menschen, RH5). Für volle Abdeckung wurde emuclans DB-Stand „God-Mode" ergänzt (research_lab + hero_hall + storage_gold gesetzt, Gold/Gems/Truppen aufgefüllt) — analog zu früheren Emulator-Sessions.
- **P3 (Forschungslabor):** Screen rendert (research_lab-Gate offen, alle Menschen-Einheiten mit Lvl-Badge + Kosten/Zeit aus Config); **Milizionär → Lvl 2** gestartet → „⚡ AKTIVE FORSCHUNG"-Banner + Timer (09:50) + „🔬 Wird erforscht …", Gold abgezogen.
- **P4 (Quests):** Screen rendert (4 Quests). **Cross-Feature live bestätigt:** der P3-Forschungsstart hat die Quest „Wissenschaftler" via `researchService→questService` (fire-and-forget) auf **1/1** gehoben → abgeholt → **„✓ Eingesammelt" + 2💎**.
- **P5 (Ziel-Prioritäten):** rein in der Engine (kein Screen). Lief in jedem der drei Test-Kämpfe in der Zielauswahl; mit 1-Gebäude-Bots optisch nicht distinkt unterscheidbar (durch 12 Shared-Tests abgedeckt). Kampf-Pipeline bestätigt funktionsfähig.
- **P6 (Held):** Screen rendert (hero_hall-Gate offen, **König Artus** 500 HP/40 DPS + Fähigkeitstext aus Config); **Level-Up Lvl 1→2** gestartet → „⬆️ Upgrade läuft… 1h 59m" + Abbrechen, Gold abgezogen. **Held im Kampf:** zunächst **korrekt verifiziert, dass ein levelnder Held NICHT kämpft** (Deploy-Leiste ohne Held — `loadHeroForBattle` liefert `null` solange `hero_level_queue` belegt, [heroService.ts](../server/src/services/heroService.ts) — gewollt wie CoC); nach Abbruch des Level-Ups erschien **„🦸 König Artus ×1"** in der Deploy-Leiste, wurde stationiert (×1→×0), kämpfte mit, und `finalizeBattle` setzte `heroes.regenerates_at` (DB bestätigt `regenerating=t`) → Held-Einsatz End-to-End live bestätigt.
- **P7 (Season-Pass):** Screen rendert (Saison 6 · Stufe 1/12, XP-Balken, Gratis/Premium-Leiter). **Cross-Feature live:** der P4-Quest-Claim hat **+30 XP** über `questService→addSeasonPassXp` gutgeschrieben (sichtbar als „30 XP"). Stufe-1-Gratis (500🟡) abgeholt → **„✓ Abgeholt"** (+500 Gold gutgeschrieben); Premium-Track korrekt 🔒 (nicht freigeschaltet).
- **P8 (Onboarding):** Screen rendert (5-Schritt-Leiter „0/5", aktiver Schritt gold umrandet, gesperrte 🔒). **welcome** abgeholt → „1/5", Schritt 1 „✓ Abgeschlossen", **build_first automatisch aktiv** (Live-Metrik `buildings_count≥2` sofort erfüllt) → strikt sequentielle Progression + Live-Metrik-Ableitung live bestätigt; **+5💎** gutgeschrieben (200→205). Menü-Badge „1" (abholbarer Schritt) korrekt.
- **Bonus mitverifiziert:** **P1** Daily-Reward-Popup beim Login → abgeholt (Streak 1→2, +3500🪵/+2500🪨/+1💎); **P2** Erfolge-Menü-Badge (4); **P10** Menschen-Dorf-Grafik (blaue Rundturm-Keeps, Grassockel); **kompletter PvP-Loop** ×3 (Matchmaking-Bot-Fallback nach 90s, Live-Deploy mit Skia, 100 % Zerstörung, Beute 20 % gedeckelt, +18🏆, Armee-Verbrauch, Beute persistiert/gutgeschrieben).
> **Emulator-Stabilität:** Wie in §9.4 dokumentiert ist der Emulator unter `swiftshader_indirect` crash-anfällig (1× exit 139 zu Sessionbeginn unter Last) — danach neu gestartet, Verifikation stabil durchgezogen. Screenshots wurden vor dem Lesen auf <2000 px herunterskaliert (System.Drawing), da 1080×2400 das Bild-Limit sprengte. Server (:4000, Node 26) + Metro (Node 20, `10.0.2.2`) + Test-PG (55432) liefen durchgehend.

### Programm „CoC-Level" — P8 (Onboarding/Tutorial) fertig (2026-06-28)
**P8** als achter Vertical-Slice fertig — ein quest-geführter Erststart: eine feste, geordnete Schrittfolge führt neue Spieler durch die ersten Aktionen und gibt je Schritt eine einmalige Starthilfe-Belohnung.
- **Config** (`onboarding`, eiserne Regel): 5 geordnete Schritte — `welcome` (metric `none`, sofort, 1000🪵/500🪨/500🟡/5💎 Starterpaket) → `build_first` (`buildings_count` ≥ 2, 500🟡) → `train_army` (`army_size` ≥ 5, 500🟡/2💎) → `first_battle` (`battles_won` ≥ 1, 1000🟡/5💎) → `join_clan` (`clan_member` ≥ 1, 10💎). Frischer Spieler startet mit genau 1 Gebäude/0 Truppen/0 Siegen/kein Clan → alle Metriken starten sauber bei 0/1.
- **Reine Logik** [shared/game/onboarding.ts](../packages/shared/src/game/onboarding.ts): `getOnboardingSteps`/`getOnboardingStep`/`isStepComplete`/`activeStepIndex`/`buildOnboardingStepView` — plattformunabhängig. Fortschritt wird **live aus dem Spielstand** abgeleitet (wie Achievements P2, keine Event-Instrumentierung). Typen `OnboardingMetric`/`OnboardingReward`/`OnboardingStepDef`/`OnboardingConfig` (gameConfig) + `OnboardingStepView`/`OnboardingResponse`/`OnboardingClaimResponse` (api). Validierung `claimOnboardingSchema` (`{step_id}`).
- **DB Migration 017** (`player_onboarding`: player_id PK, `claimed_steps` INT, `completed_at`, updated_at). Speichert nur die Anzahl abgeholter Schritte; Zeile entsteht beim ersten Claim.
- **Server** [onboardingService.ts](../server/src/services/onboardingService.ts): `getOnboarding` (Live-Metriken + Status), `claimOnboardingStep` (TX mit `FOR UPDATE`: **strikt sequentiell** — `step_id` muss der aktuell offene Schritt sein, Metrik erfüllt? + Belohnung mit Ressourcen-Cap wie Daily/Loot, Gems/Goldbarren ungekappt; setzt `completed_at` bei Abschluss). Routen `GET /api/onboarding` + `POST /api/onboarding/claim`. **Keine** Service-Instrumentierung nötig (Metriken: `buildings_count`/`army_size`/`battles_won`/`clan_member` per Query).
- **Mobile:** Client (`fetchOnboarding`/`claimOnboardingStep`), Store (`onboarding`, `loadOnboarding`/`claimOnboardingStepAction`, in `refreshAll` mitgeladen → **Menü-Badge „Schritt abholbar"**), neuer [OnboardingScreen.tsx](../apps/mobile/src/screens/OnboardingScreen.tsx) (Schrittleiter mit Fortschrittsbalken, aktiver Schritt hervorgehoben, gesperrte/abgeschlossene Zustände, Abschluss-Karte), Menüpunkt „🎓 Erste Schritte", `ActiveScreen`+App-Routing.
- **Verifikation:** **196 Shared** (+14: getOnboardingSteps/leer, getOnboardingStep, isStepComplete inkl. welcome-target-0, activeStepIndex Grenzfälle, buildOnboardingStepView aktiv/abgeholt/gesperrt/Belohnung) + **130 Server-E2E** (+11: frischer Status mit welcome aktiv+erfüllt, Claim welcome + Belohnung ungekappt-Gems, Sequenz-Block nicht-aktiver Schritt→400, aktiver-aber-unerfüllt→400, Doppel-Claim→400, voller 5-Schritte-Durchlauf→all_complete+completed_at, Claim nach Abschluss→400, Ressourcen-Cap, Zod fehlende step_id→400, Auth×2) grün; 3× `tsc` + `test:types` sauber. **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel` — siehe Abschnitt „Emulator-Verifikation P3–P8").**

### Programm „CoC-Level" — P9 erster Slice: Clan-Chat ✅ (2026-06-28, FERTIG + Emulator-verifiziert)
**P9 (Sozial-Ausbau)** als neunter Pillar gestartet; höchstwertiger erster Slice = **Clan-Chat** (CoC-Kernkleber). Wie bei P7 (Pass-Kern vs. Limited-Time-Events) sind **Spenden-Anfragen + Freundschaftskämpfe** als Folge-Slices offen.
- **DB Migration 018** (`clan_messages`: id, clan_id→clans ON DELETE CASCADE, player_id→players **ON DELETE SET NULL**, `username`-Snapshot, body VARCHAR(500), created_at; Index `(clan_id, created_at DESC, id DESC)`). username als Snapshot → Nachrichten bleiben nach Austritt/Löschung lesbar.
- **Server** [clanChatService.ts](../server/src/services/clanChatService.ts): `getClanMessages` (eigener Clan, **neueste zuerst, paginiert** via `before`=created_at, `has_more`, limit 1..100/Default 30) + `postClanMessage` (Mitgliedschaft via `getMembership`, username-Snapshot, Insert, **Live-Broadcast**). Mitgliedschafts-Gate: Nicht-Mitglied → 400. REST `GET /api/clan/chat` + `POST /api/clan/chat` (Zod `sendClanMessageSchema` body trim 1..500), **vor** dem Catch-all `/:clanId` registriert.
- **Live-Echtzeit (Socket):** Beim Connect tritt jeder Socket seinem **Clan-Room** `clan:<clanId>` bei ([sockets/index.ts](../server/src/sockets/index.ts), via `getMembership`, Room-String inline → kein Zyklus). `postClanMessage` broadcastet die neue Nachricht via `getIO()?.to(room).emit('clanchat:message', …)`. **Zyklusfrei:** clanChatService importiert nur `getIO` aus dem Socket-Modul; das Socket-Modul importiert den Chat-Service NICHT.
- **Mobile:** Client (`fetchClanChat`/`sendClanMessage`), Socket-Listener [bindClanChatHandler](../apps/mobile/src/api/socket.ts) (`clanchat:message`), Store (`clanChat`/`clanChatHasMore`, `loadClanChat`/`loadMoreClanChat`/`sendClanMessageAction`/`appendClanChatMessage` — **dedupliziert per id**, damit der eigene Socket-Echo-Push nach optimistischem Anhängen nicht doppelt erscheint), **Chat-Tab** im [ClanScreen](../apps/mobile/src/screens/ClanScreen.tsx) (4. Tab; invertierte `FlatList`, eigene Nachrichten gold/rechts, fremde mit Username links, Eingabe + Senden, „ältere laden" am Ende).
- **Verifikation:** **196 Shared** (unverändert; Chat ist serverseitig + Validierung) + **142 Server-E2E** (+12: Gate ohne Clan→400 ×2, Senden→201 mit username/body/player_id, Verlauf neueste-zuerst, zwei Mitglieder teilen Verlauf, **Clan-Isolation** [fremder Clan sieht nichts], **Paginierung** has_more+before, leerer/zu-langer body→400, Trim, Auth×2) grün; 3× `tsc` + `test:types` sauber.
- **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel`, emuclan/Clan EmuGarde):** ClanScreen zeigt jetzt **4 Tabs** (Mitglieder/Burg/Krieg/**Chat**) → Chat-Tab: Leerzustand „Noch keine Nachrichten. Sag Hallo! 👋" → Nachricht gesendet → **erscheint gold rechts** (eigene), Eingabe leert sich. **Live-Broadcast bestätigt:** ein per REST eingeschleustes zweites Clan-Mitglied (`chatmate25143`, via API registriert+beigetreten) postete → die Nachricht erschien **live ohne Neuladen** in emuclans App (links, blauer Username) — Socket-Room-Join + Broadcast end-to-end. (🚀-Emoji fiel im Emulator-Font auf `??` zurück, rein kosmetisch.) **0 Bugs.**

### Programm „CoC-Level" — P9 zweiter Slice: Spenden-Anfragen ✅ (2026-06-28, FERTIG + Emulator-verifiziert)
**P9-Folge-Slice** = **Truppen-Spenden-Anfragen** (CoC „Clans leben von Spenden"). Baut auf der vorhandenen Clan-Burg-/Housing-Infra auf (`donateToCastle` wird wiederverwendet). **Freundschaftskämpfe** bleiben als nächster P9-Slice offen.
- **DB Migration 019** (`clan_donation_requests`: id, clan_id→clans CASCADE, player_id→players CASCADE, `requested_unit_type` (nullable), `capacity` (Burg-Housing zum Anfragezeitpunkt), `received` (kumulativ gespendetes Housing), `status` open/fulfilled, created_at, fulfilled_at; **Partial-Unique** `(player_id) WHERE status='open'` = max. 1 offene Anfrage je Spieler; Partial-Index für offene Clan-Anfragen).
- **Server** [clanDonationService.ts](../server/src/services/clanDonationService.ts): `createDonationRequest` (Mitglieds- + Burg-Gate, Wunsch-Einheitstyp validiert, capacity aus `getCastle`), `listDonationRequests` (offene Anfragen des Clans + `my_request`), `donateToRequest` (ruft die geprüfte `donateToCastle`-Logik [gleicher Clan, Housing-Cap, Armee-Bestand] → Truppen wandern in die Burg des Anfragenden; **received atomar** via `received = received + delta`, Auto-`fulfilled` bei `received >= capacity`; **Selbst-Spende gesperrt**), `cancelDonationRequest`. REST `GET/POST/DELETE /api/clan/donations` + `POST /api/clan/donations/:id/donate`, alle **vor** `/:clanId`.
- **Mobile:** Client (`fetchDonationRequests`/`createDonationRequest`/`cancelDonationRequest`/`donateToRequest`), Store (`donationRequests`/`myDonationRequest` + Actions; nach Spende `refreshArmy`+`loadDonations`), **Spenden-Bereich im Burg-Tab** ([ClanScreen](../apps/mobile/src/screens/ClanScreen.tsx)): „🆘 Truppen anfordern" bzw. eigene Anfrage-Karte mit Fortschritt + „Anfrage schließen"; fremde Anfragen mit Wunsch/Fortschritt + **Spende-Chips aus der eigenen Armee** (➜ Einheit ×N).
- **Verifikation:** **196 Shared** (unverändert) + **156 Server-E2E** (+14: Gates ohne Clan/Burg→400, erstellen→201 mit capacity, Doppel-offen→400, unbekannter Wunsch→400, Liste+my_request, **Spende-Transfer** [Armee−, Burg+, received+], **bis-voll→fulfilled+aus-Liste**, Selbst-Spende→400, nicht-existent→404, Cross-Clan→403, DELETE+leer→400, Auth) grün; 3× `tsc` + `test:types` sauber.
- **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel`, emuclan + chatmate25143 im Clan EmuGarde):** Burg-Tab zeigt den neuen **🆘 Truppen-Anfragen**-Bereich. emuclan „Truppen anfordern" → **„Deine Anfrage 0/15"**-Karte. Zweites Mitglied (chatmate, via API mit Burg + Anfrage „Wunsch: Ritter") erschien nach Tab-Reload als fremde Anfrage **„chatmate25143 bittet um Truppen · 0/15 · Wunsch: Ritter"** mit Spende-Chip „➜ Milizionär (×16)". **Spende getippt → chatmates Anfrage 0/15→1/15, emuclans Armee ×16→×15**; DB bestätigt: chatmates `clan_castle_defenders` = 1 militia `donated_by=emuclan`. „Anfrage schließen" → eigene Anfrage weg, zurück zum Anfordern-Button. **0 Bugs.**

### Programm „CoC-Level" — P9 dritter Slice: Freundschaftskämpfe ✅ (2026-06-28, FERTIG + Emulator-verifiziert)
**P9 abgeschlossen** mit dem dritten Sozial-Slice = **Freundschaftskämpfe** (CoC „Friendly Challenge"): ein Clan-Mitglied fordert einen Kameraden zum **Übungskampf gegen dessen echtes Layout** heraus — **kein Loot, keine Trophäen, kein Truppen-Verbrauch, keine Persistenz** (reine Übung). Nutzt die vorhandene Battle-Pipeline wieder.
- **Engine** [battleService.ts](../server/src/services/battleService.ts): `BattleSession.friendly`-Flag, `prepareBattle(..., friendly=false)`. `finalizeBattle` verzweigt auf `isFriendly`: Trophäen-Delta 0, Loot 0, `consumed={}` (**kein Verbrauch**), **keine** Persistenz (kein `battles`-Eintrag), **keine** Verteidiger-Verluste, **kein** Helden-Regen, **kein** Season-Pass-XP. `battle:ended.mode='friendly'`. Keine Migration (keine DB-Persistenz).
- **Socket** [sockets/index.ts](../server/src/sockets/index.ts): neues Event **`friendly:challenge`** `{target_player_id}` → `startFriendlyBattle` (Ziel muss **Clan-Kamerad** sein [`getMembership` beider], nicht man selbst) → `onMatched(..., friendly=true)`. `BattleMode` um `'friendly'` erweitert ([combat.ts](../packages/shared/src/types/combat.ts)).
- **Mobile:** `emitFriendlyChallenge`, Store (`battleMode` um `'friendly'`, `startFriendlyBattle(targetId)`, onMatched/onEnded behandeln `'friendly'`), **„⚔️ Üben"-Button** je Mitglied (außer self) im Clan-Mitglieder-Tab ([ClanScreen](../apps/mobile/src/screens/ClanScreen.tsx)), [BattleResultOverlay](../apps/mobile/src/components/battle/BattleResultOverlay.tsx) zeigt bei `mode==='friendly'` „🤝 Übungskampf" + blendet Beute/Trophäen aus + Hinweis „Übung — keine Beute, keine Trophäen, keine Truppenverluste".
- **Verifikation:** **196 Shared** (unverändert) + **160 Server-E2E** (+4: `friendly:challenge` ohne Ziel/gegen-self/gegen-Nicht-Clan → `battle:error`; **voller Kampf** über Socket → `mode=friendly`, Sieg, `trophies_change=0`, `loot=0`, **Armee unverändert** [kein Verbrauch], **keine `battles`-Zeile**, beide Trophäen unverändert) grün; 3× `tsc` + `test:types` sauber.
- **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel`, emuclan vs. chatmate25143 in EmuGarde):** Mitglieder-Tab zeigt **„⚔ Üben"** neben chatmate → Tap → **sofortiges Setup** (kein 90s-Matchmaking) „Gegnerisches Dorf · 2 Gebäude" → Kampf (Milizen + **König Artus** deployt) → **100 % Sieg** → Overlay **„🤝 Übungskampf · SIEG · Übung — keine Beute, keine Trophäen, keine Truppenverluste"** (Beute/Trophäen ausgeblendet). DB nach dem Kampf: emuclan Trophäen **1162 unverändert**, Milizen **40 unverändert** (kein Verbrauch), **keine neue `battles`-Zeile**. **0 Bugs.**

### Programm „CoC-Level" — Limited-Time-Events ✅ (2026-06-28, P7-Folge-Slice, FERTIG + Emulator-verifiziert)
Der bei P7 offen gelassene **Limited-Time-Events**-Slice ist fertig — zeitlich begrenzte Events mit besonderen Aufgaben und großzügigen, **verdienbaren** Belohnungen (auch Goldbarren), FOMO-Retention im CoC-Stil.
- **Config** (`events.definitions`, eiserne Regel): Events mit `starts_at`/`ends_at` (ISO-UTC) + Aufgaben. Beispiel-Event **`summer_clash_2026`** (01.06.–01.09.2026, „Sommer-Ansturm") mit 4 Aufgaben (win5/win15/win30 = `battles_won`, dungeon3 = `dungeons_cleared`). Fortschritt **live aus dem Spielstand SEIT Event-Start** gezählt (wie P2, keine Instrumentierung). Metriken: `battles_won` (gewonnene Solo-Angriffe seit starts_at), `dungeons_cleared` (gewonnene Läufe seit starts_at).
- **Reine Logik** [shared/game/events.ts](../packages/shared/src/game/events.ts): `getActiveEvent(config, now)` (erstes Fenster, das `now` enthält), `isEventActive` (halb-offen [start, end)), `getEventChallenge`, `isChallengeComplete`, `buildEventChallengeView`. Typen `EventMetric`/`EventReward`/`EventChallengeDef`/`EventDef`/`EventsConfig` (gameConfig) + `EventChallengeView`/`EventStatusResponse`/`EventClaimResponse` (api). Validierung `claimEventChallengeSchema`.
- **DB Migration 020** (`player_event_claims`: player_id + event_id + challenge_id als PK, claimed_at). Nur abgeholte Aufgaben gespeichert; Fortschritt live berechnet.
- **Server** [eventService.ts](../server/src/services/eventService.ts): `getEventStatus` (aktives Event + Live-Werte je Metrik seit starts_at + claimed-Status; null wenn kein Event aktiv), `claimEventChallenge` (TX: Event aktiv? + Aufgabe erfüllt? + nicht-doppelt via `INSERT … ON CONFLICT DO NOTHING` + rowCount-Guard; Ressourcen-Belohnung auf Lager-Cap gekappt, Gems/Goldbarren ungekappt). Routen `GET /api/events` + `POST /api/events/claim`.
- **Mobile:** Client (`fetchEvents`/`claimEventChallenge`), Store (`event`, `loadEvents`/`claimEventAction`, in `refreshAll` → **Menü-Badge**), neuer [EventScreen.tsx](../apps/mobile/src/screens/EventScreen.tsx) (Event-Banner mit **Live-Countdown**, Aufgaben-Liste mit Fortschrittsbalken + Belohnung + Claim; Leerzustand wenn kein Event aktiv), Menüpunkt **„🔥 Event" nur sichtbar wenn Event aktiv** (mit Badge abholbarer Aufgaben), `ActiveScreen`+App-Routing.
- **Verifikation:** **208 Shared** (+12: isEventActive Grenzfälle [inkl. halb-offen start/end], getActiveEvent aktiv/inaktiv/Überlappung, getEventChallenge, isChallengeComplete, buildEventChallengeView) + **170 Server-E2E** (+10: aktives Event mit 4 Aufgaben/alle 0, 5 Siege→win5 complete, Claim→Gems, noch-nicht-erfüllt→400, Doppel-Claim→400, claimed-Markierung, Dungeon-Metrik→Gems, unbekannte Aufgabe→404, Auth×2) grün; 3× `tsc` + `test:types` sauber.
- **Emulator-Verifikation ✅ (2026-06-28, `vw_pixel`, emuclan):** Menü zeigt **„🔥 Event" mit Badge „1"** (nur weil Event aktiv) → EventScreen: Banner **„🔥 Sommer-Ansturm"** + **Countdown „⏳ Noch 64d 9h"** + Aufgaben mit korrektem Live-Fortschritt (emuclan 8 Siege → **Angriffslustig 5/5** abholbar, Eroberer **8/15**, Kriegsherr **8/30**). „Belohnung abholen" → **„✓ Abgeholt"**; DB: gems **207→212** (+5), Claim `summer_clash_2026/win5` persistiert. **0 Bugs.**

### Programm „CoC-Level" — Grafik-Track (P10) parallel gestartet (2026-06-27)
Nutzer hat **Unreal Engine** und will Grafik auf CoC-Niveau. **Klargestellt:** Unreal ist hier ein **Render-Werkzeug** für
**vorgerenderte isometrische Sprites** (der CoC-Weg), KEIN Engine-Wechsel (würde Backend/Tests/6 Phasen wegwerfen).
**Render-Brief erstellt:** [docs/ASSET-PIPELINE.md](ASSET-PIPELINE.md) — Kamera-Kalibrierung auf das 2:1-Tile der App
(64×32), Format/Anker/Maßstab, Namensschema, Manifest, **Milestone „3 Test-Sprites zuerst"**. Start-Manifest
`apps/mobile/src/assets/factions/humans/manifest.json`. **Arbeitsteilung:** Nutzer/Artist rendert in Unreal; Assistent
reaktiviert den dormanten `useImage`-Loader (§9.3) + Manifest-Pipeline + verifiziert. Risikofrei: fehlt ein Sprite →
scharfer Vektor-Fallback (schrittweise Migration je Gebäude).

---

## 4. Bewusste Abweichungen vom Briefing (alle dokumentiert)

1. **`players.password_hash`** (Migration 001) — fürs E-Mail-Login nötig, im Schema vergessen.
2. **`faction_change.cost_bars: 500`** in game-config.json — Abschnitt 5 verlangt den Wert
   „konfigurierbar", Appendix ließ ihn weg.
3. **`economy` in game-config.json** — `resource_cap_multiplier: 3` (Abschnitt 4) +
   Grundkapazitäts-Regel `storage_baseline_from_town_hall`.
4. **`players.resources_updated_at`** (Migration 002) — Zeitstempel fürs Produktions-Settlement.
5. **Gebäude-Inventar** (Migration 003 `building_inventory`, 2026-06-20) — auf Nutzerwunsch:
   „Einlagern" statt endgültigem Löschen, später kostenlos wieder platzieren. Steht **nicht** im
   Briefing. Endpunkte: `POST /buildings/:id/store`, `GET /inventory/list`, `POST /inventory/:invId/place`.
   **Auch das Rathaus** ist verschieb- und einlagerbar (wie in CoC); nur das **endgültige Löschen**
   (`deleteBuilding`/„Entfernen"-Button) bleibt fürs Rathaus gesperrt — übers Inventar ist es ohnehin
   jederzeit zurückholbar.
6. **Platzierungs-/Baukosten** (2026-06-20) — beim Platzieren werden jetzt die **Stufe-1-Kosten**
   abgezogen (× `build_cost_multiplier`); `getPlacementCost()` in `shared/economy.ts`. Mit Bauzeit
   startet das Gebäude auf **Stufe 0 („im Bau")**, der bestehende Upgrade-Cron hebt es auf Stufe 1
   (Produktion/Kapazität zählen erst ab Stufe 1). Holzfäller/Steinbruch = gratis (Stufe-1-Kosten 0).
7. **Baukosten ergänzt** in `buildings_common` (game-config.json, 2026-06-20): pauschale
   `wood_cost`/`stone_cost`/`build_time_minutes` für `storage_wood` (250 Holz/5min),
   `storage_stone` (250 Stein/5min), `storage_gold` (1500/800/90min), `barracks` (400/10min),
   `watchtower` (800/400/45min), `cannon` (2500/1500/180min). `clan_castle` nutzt die vorhandene
   Stufe-1 der `clan.clan_castle.levels` (2000/1500/180min). Mauer = `cost_per_segment_level_1`.

8. **`combat`-Sektion + erweitertes `pvp`** in game-config.json (2026-06-20, Phase 3) — Abschnitt 8
   nennt die Kampf-Zahlen nicht explizit. Laut eiserner Regel zentral hinterlegt: `combat.tick_rate`,
   `unit_speed_tiles_per_second` (medium/slow/… → Tiles/s), `melee_range_tiles`, `splash_radius_tiles`,
   `healer_range_tiles`, `building_hp` (je Typ + default), HP-/DPS-Wachstum. `pvp.matchmaking`
   (Toleranzen ±100/±200/±500, bot_after 90s), `pvp.win_destruction_threshold_pct: 50`,
   `pvp.trophy_change` um Elo-Grenzen (win_min/max, loss_min/max_magnitude, diff_scale) ergänzt.
9. **Schema-Korrekturen Phase 3** (Migrationen 004/005): `unit_training_queue` (zeitbasiertes
   Training), Unique-Index `units(player_id, unit_type)`, `battles.is_bot_defender`,
   **`battles.result` VARCHAR(10)→(20)** (Spec-Bug: `attacker_win`/`defender_win` sind 12 Zeichen).

10. **Config-Ergänzungen Phase 4** (2026-06-21) — Abschnitt 10/11 nennen einige Werte nicht explizit;
    laut eiserner Regel zentral hinterlegt: `clan.banner_options` (erlaubte shapes/symbols/colors für
    den Baukasten), `clan.war` (`duration_minutes`, `win_season_points`, `draw_season_points`,
    `min_members_per_clan`, Queue-Toleranzen), `clan.profanity_extra_words` (deutsche Extra-Blocklist
    zusätzlich zu `bad-words`), `clan.name_length_min/max`, top-level `leaderboard` (default/max page size).
11. **Schema-Ergänzungen Phase 4** (Migrationen 006/007/008): `clan_wars.status/ends_at/season_number`,
    Index `clan_members(player_id)`, Unique-Index `clan_castle_defenders(player_id,unit_type)`
    (UPSERT-Ziel fürs Stationieren), aktive **Saison 1** geseedet; `clan_wars`→`clans`-FKs (007) und
    `clan_castle_defenders.donated_by` (008) auf **ON DELETE SET NULL** (sonst ließen sich Clan bzw.
    Spender nicht löschen).
12. **Clan-Krieg = getrennter Wettbewerb:** Krieg-Duelle ändern **keine** Solo-Trophäen und plündern
    **kein** Holz/Stein (nur `mode='clan_war'`-Battle-Zeile + Kriegspunkte = Zerstörung).
    `donate` stationiert standardmäßig in die **eigene** Burg (oder die eines Clan-Kameraden).
    Zusätzliche, nicht im Briefing genannte Endpunkte: `GET /api/clan` (Liste/Suche),
    `GET /api/clan/castle`, `POST /api/clan/wars/start`, `POST /api/clan/members/:id/{promote,demote}`
    — analog zur Inventar-Ergänzung aus Phase 2.
13. **`combat.defender_aggro_radius_tiles`** (game-config.json, 2026-06-21) — Reichweite, ab der
    Angreifer die mobilen Clan-Burg-Verteidiger angreifen (Feature in §5).
14. **Ranglisten-Rang bei Gleichstand** (2026-06-21) — `RANK()` läuft bewusst **nur über die Punktzahl**
    (Trophäen bzw. season_points), sodass gleichstehende Spieler/Clans sich denselben Rang teilen;
    `created_at`/`id` dienen nur der stabilen Anzeige-/Paginierungs-Reihenfolge.

15. **Dungeon-Config-Ergänzungen** (game-config.json, 2026-06-21, Phase 5) — Abschnitt 9 nennt **keine**
    konkreten Wellen-Kompositionen/Eskalations-Multiplikatoren oder Boss-Werte; laut eiserner Regel zentral
    hinterlegt (analog zur `combat`-Sektion aus Phase 3): `dungeon.boss` (Ritter ×14 HP/×4 Schaden),
    `dungeon.npc_faction` (Menschen-Baseline), `dungeon.max_wave_seconds`, `dungeon.schedule` (numerische
    `open_weekday/...`), `dungeon.dev_always_open`, `dungeon.one_run_per_week`. **Erweitert (Nutzerwunsch):**
    statt fester Wellen jetzt `dungeon.difficulties` (4 wählbare Stufen, skalieren Gegner+Belohnung),
    `dungeon.wave_generation` (geseedete Zufallswellen aus `enemy_pool` per Budget — jede Welle anders, **vor dem
    Kampf verborgen**), `dungeon.replay_*` (Kampf-Aufzeichnung für die Client-Animation). Die **`reward_tiers`**
    entsprechen der Tabelle aus Abschnitt 9 (Normal = Baseline) und werden mit `difficulty.reward_multiplier`
    multipliziert. `dungeon.waves`/`rewards_on_completion` (alte Platzhalter) ersetzt.
16. **Skin-Katalog + IAP-Pakete** (game-config.json, 2026-06-21) — `skins.catalog` (6 Beispiel-Skins mit
    Preisen aus `skins.example_pricing_bars`, beim Start in die `skins`-Tabelle geseedet) und `iap.packages`
    (die 5 Goldbarren-Pakete aus Abschnitt 12, exakt). Beides war im Appendix nicht enthalten, gehört aber
    laut eiserner Regel in die Config statt in den Code.
17. **Dungeon = REST-Auto-Resolve, nicht Socket-Echtzeit** (Phase 5) — die Spec-Endpunkte
    (`/dungeon/start`, `/dungeon/wave/complete`) implizieren einen wellen-basierten REST-Fluss (kein
    Battle-Socket-Event in Abschnitt 8). Jede Welle wird daher **server-autoritativ auto-aufgelöst**
    (kein Live-Deploy wie im PvP); überlebende Einheiten ziehen weiter, Belohnung nach Stand am Run-Ende.
    Bewusste MVP-Vereinfachung, dokumentiert. Zusätzliche, nicht im Briefing genannte Endpunkte:
    `POST /shop/skins/:id/apply` + `/unapply` (das „Anwenden" aus Befehl 5), `GET /shop/bars/packages`.
18. **Saison-Belohnung je Mitglied** (Phase 5) — Abschnitt 10 nennt nur „Belohnung für Top-5-Clans".
    Umsetzung: **jedes Mitglied** eines Top-5-Clans erhält den Rang-Betrag aus `clan.leaderboard_rewards_bars`.
    Nur Clans mit `season_points > 0` werden belohnt. Bewusste, klar dokumentierte Entscheidung.
19. **IAP-Sandbox-Modus** (Phase 5) — ohne echte Apple/Google-Store-Credentials akzeptiert die
    Beleg-Verifizierung im Dev/Sandbox-Modus (`IAP_ALLOW_SANDBOX`, default in Dev) Belege der Form
    `sandbox:<product_id>:<transaction_id>`. Produktiv-Pfade (verifyReceipt / Play Developer API) sind
    strukturiert hinterlegt und lehnen ohne Credentials bewusst ab (keine erfundene Gutschrift) — analog
    zur bereits vorhandenen OAuth-Verifizierung.
20. **`effects`-Sektion in game-config.json** (Phase 6, 2026-06-21) — die TEIL-2-Spec nennt Effekt-Parameter
    (Partikel-Caps, Shake-Intensitäten, Floating-Text, Squash, Idle, Presets) als konkrete Zahlen; laut eiserner
    Regel zentral hinterlegt (rein kosmetisch, **keine Balance**). Server nutzt sie nicht, reicht sie nur durch.
21. **Sound-Cues strukturell, Abspielen zurückgestellt** (Phase 6) — `rendering/effects/sound.ts` kapselt
    `playCue(...)` und ist an allen größeren Effekten verdrahtet, aber das **tatsächliche Abspielen** braucht
    `expo-av` (natives Modul → Gradle-Rebuild, vgl. §8). Bewusst als No-Op belassen (Default an, ohne eingehängten
    Player passiert nichts) — exakt das Muster von IAP-Sandbox/OAuth. Nachrüsten: `expo-av` installieren +
    `setSoundPlayer(...)` einhängen (dann genügt ein neuer nativer Build).

> Sonst ist game-config.json **1:1 der Appendix** aus dem Briefing.

---

## 5. Bekannte Lücken / offene Punkte

- **Geteilte Footprint-Quelle (Client/Server) — ✅ erledigt 2026-08-04:** Footprints lagen
  vorher NUR im Client (mobile-only `manifest.json` → `buildingFootprints.ts`), der Server kannte
  pro Gebäude nur Position+Typ. Jetzt gibt es EINE geteilte Quelle in
  `packages/shared/src/game/footprints.ts` (`BUILDING_FOOTPRINTS` + `footprintTiles/Center/Bounds/
  Contains`, Spiegelbild zu `wallConnect`). Werte 1:1 aus der bisherigen manifest.json übernommen
  (keine Balance-/Größenänderung; gold_mine bleibt 3×3). Alle Reader (mobile `VillageCanvas`,
  Layout-Tools `spriteMetrics`/`emuclanLayout`/`relayout_emuclan`, Harness `village`) lesen jetzt
  über shared; `tiles` aus der manifest.json entfernt (manifest = nur noch anchor+file, rein
  rendering). Der Server **kann den Footprint jetzt pro Gebäude lesen** (importiert aus shared).
- **Footprint-bewusste Bau-Validierung (⚠️ weiterhin offen):** `villageService.placeBuilding`
  → `assertTileFree` prüft/belegt weiterhin nur die EINE Ursprungskachel `grid_x/grid_y` — DB-seitig
  bleibt jedes Gebäude fürs Platzieren **1×1**. Solange nur wir (Seed/Relayout) platzieren, unkritisch.
  **Sobald Spieler frei bauen**, muss `placeBuilding` den (jetzt geteilten) Footprint gegen Belegung
  prüfen. Die geteilte Quelle dafür steht jetzt bereit; die Validierung selbst ist noch NICHT gebaut.
- **Mobile-UI ✅ auf Emulator verifiziert** (2026-06-20, nativer Dev-Build) — Rendering +
  alle Phase-2-Interaktionen geprüft. Setup/Rezept/Stolperfallen: **Abschnitt 8.**
- **Upgrade-Kostentabellen** existieren in der Config nur für `town_hall`, `lumber_camp`,
  `quarry` (= lumber-Tabelle), `gold_mine`, `clan_castle`. Für Mauer/Wachturm/Kanone/Lager/
  Kaserne/Exklusivgebäude gibt es **keine** Tabellen → `getUpgradeCost` liefert `null`,
  Endpunkt antwortet 400. **Keine Werte erfinden** — falls gewünscht, mit dem Nutzer klären
  und in game-config.json ergänzen.
- **Fishfolk Wasser-Adjazenz-Bonus** (`resource_production_multiplier_water_adjacent`) ist im
  Produktions-Tick **noch nicht** modelliert (kein Wasser-Tile-Konzept). Vermerkt in `economy.ts`.
- React-Navigation ist in `apps/mobile/package.json`, wird aber noch nicht genutzt (App rendert
  bedingt Auth/Village/Battle/**Clan**/**Leaderboard** über `store.activeScreen`). Bei wachsender
  Screen-Zahl (Phase 5+) auf echte Navigation umstellen.
- **Clan-Burg-Einheiten verteidigen das Dorf ✅ (2026-06-21 implementiert + getestet):** stationierte
  `clan_castle_defenders` erscheinen im Kampf als **mobile Verteidiger-Einheiten** (`combat.ts`:
  `BattleState.defenders`), greifen den nächsten Angreifer an, nehmen Schaden, sterben — und gefallene
  Verteidiger werden bei Kampfende aus `clan_castle_defenders` abgezogen (`battleService.persistDefenderLosses`).
  Gilt für Solo **und** Clan-Krieg; **Bots** bekommen keine (Verluste wären sonst beim Layout-Spender
  falsch). Aggro-Reichweite in `combat.defender_aggro_radius_tiles`. **Fremd-Donation** überschreibt
  `donated_by` beim Aufaddieren je `(player_id,unit_type)` (bewusste MVP-Vereinfachung).
- **Latente Spieler-Lösch-Referenzen:** Es gibt (noch) keinen Account-Lösch-Endpunkt. `clan_wars`-FKs
  (007) und `clan_castle_defenders.donated_by` (008) sind auf `ON DELETE SET NULL` korrigiert; weitere
  `REFERENCES players(id)` ohne `ON DELETE` (z. B. `clans.leader_id`, `battles.attacker_id/defender_id`)
  bleiben latent und sollten vor einem echten Lösch-Feature auditiert werden.
- **Clan-Krieg-Bot-Fallback nicht implementiert:** Findet sich kein zweiter wartender Clan, bleibt der
  Clan in der Queue (kein synthetischer Gegner-Clan). `clan.war.queue_bot_after_seconds` ist als Wert
  vorhanden, aber bewusst ungenutzt (Bot-Clan bräuchte echte Mitglieder/Dörfer). Krieg-Angriffe laufen
  über das Socket-Event `clanwar:join` (interaktiv wie Solo), nicht per REST.
- **Saison-Reset ✅ (Phase 5):** Cron `0 0 * * 1` (Europe/Berlin) prüft, ob die aktive Saison ≥ 8 Wochen
  alt ist, und ruft dann `resetSeasonNow()` (Top-5-Goldbarren je Mitglied, season_points→0, neue Saison,
  leaderboard_clan-Snapshot). **Achtung:** Die Dev-DB steht durch den E2E-Test bereits auf **Saison 2**.
- **Dungeon ohne Live-Deploy (Phase 5, bewusst):** Wellen werden auto-aufgelöst (siehe Abweichung 17).
  Ein interaktives Deploy/Steuern wie im PvP wäre eine spätere Verfeinerung (bräuchte Socket-Transport
  + DungeonScreen-Kampf-UI). Die textuellen Unit-Spezialfähigkeiten sind auch im Dungeon nicht modelliert
  (gleiche Lücke wie PvP, siehe unten).
- **IAP nur Sandbox lokal (Phase 5):** Echte Apple-`verifyReceipt`/Google-Play-API-Verifizierung ist
  strukturiert hinterlegt, aber nicht aktiv (keine Store-Credentials in dieser Umgebung). Vor einem echten
  Release: `services/iap/verify.ts` produktiv implementieren + `APPLE_IAP_SHARED_SECRET`/`GOOGLE_PLAY_PACKAGE_NAME`
  + Service-Account setzen. `IAP_ALLOW_SANDBOX` dann in Produktion auf `false`.
- **Skins sichtbar ✅ (2026-06-22, erledigt — Details §3 „Skins sichtbar gemacht"):** Die Renderer wenden jetzt die
  `applied`-Skins an (Gebäude-Farben, Einheiten-Körper, Dorf-Theme-Boden) via `rendering/skins.ts` + `activeSkins`
  im Store (geladen bei Login/Refresh/Shop). Am Emulator verifiziert. **Rest-Lücke:** nur die drei vorhandenen
  Beispiel-Skin-Typen werden gerendert (`primary`/`accent`/`ground`); aufwändigere Skin-Effekte (z. B. eigene
  Silhouetten/Partikel je Skin) sind nicht vorgesehen.
- **Dungeon-`season_week`-Kennung** nutzt das Berliner Samstags-Datum des Fensters (bzw. heutiges Datum bei
  `dev_always_open`). `one_run_per_week` keyt darauf — ein laufender Lauf wird bei erneutem Start fortgesetzt.
- **Redis NICHT erforderlich für Phase 3:** Matchmaking + Battle-State laufen bewusst **in-process**
  (`matchmakingService.ts`, `battleService.ts`) — ein Server-Prozess ist autoritativ, lokal ohne
  Redis lauffähig/testbar (wie in §2 vorgesehen). Das Redis-Schlüsselschema der Spec
  (`matchmaking:queue:{range}`, `battle:state:{id}`) würde erst beim Skalieren auf **mehrere
  Instanzen** gebraucht; die Pairing-/Tick-Logik bliebe identisch. `getRedis()` (lazy) ist bereit.
- **Unit-Spezialfähigkeiten (rein textuell) noch nicht simuliert** — Skelett-Regen, Geist-Dodge,
  Berserker-Rage, Netzwerfer-Slow, Hauptmann-Moral-Aura, Runenschmied-HP-Buff, Steinriese-
  Doppelschaden-gegen-Mauern. **Keine erfundenen Zahlen** (siehe `combat.deferred_unit_specials_note`);
  numerisch hinterlegte Mechaniken sind aktiv (Heiler `heal_per_second`, Splash via `splash_radius_tiles`,
  alle Fraktions-Modifikatoren). Fishfolk-Wasser-Bonus weiterhin offen (kein Wasser-Tile-Konzept).
- **Bauzeit-/Trainings-Pfadlängen:** Trainings laufen pro Auftrag parallel (kein Kaserne-Slot-Limit);
  Deploy ist auf jedem freien Grid-Feld erlaubt (kein „außerhalb der Mauern"-Zwang). Bewusste MVP-
  Vereinfachungen für Phase 3, bei Bedarf später verfeinern.
- **Kampf-Replay** (`battles.replay`) speichert bislang nur eine Zusammenfassung (Armee, Verbrauch,
  Gegner) — kein vollständiger Tick-Mitschnitt für ein Wiederholungs-Playback.

---

## 6. Nächster Schritt — alle 6 Briefing-Phasen fertig ✅ (Politur/Feinschliff)

**Phase 6 (Grafik & Effekte / Game Juice) ist abgeschlossen** (Details §3). Damit sind **alle sechs Phasen**
des Briefings umgesetzt, jeweils typgeprüft + gegen echtes PG/am Emulator verifiziert. Es gibt keinen „Befehl 7".

Sinnvolle nächste Arbeiten sind **Politur**, keine neue Phase (offene Punkte ausführlich in §5):
- **Permanente Test-Suiten ✅ ERLEDIGT** (Details §3) — 85 Shared-Logik-Tests (`npm test`) + **62 Server-E2E-Tests**
  gegen echtes Postgres inkl. **Socket.io-Live-Kampf UND Clan-Krieg-Duell** (`npm run test:server`, 2026-06-23). Die
  gesamte Echtzeit-Kampf-Schicht ist damit automatisiert abgedeckt — keine bekannte Test-Lücke mehr im Backend.
- **Skin-Anwendung sichtbar machen ✅ ERLEDIGT** (2026-06-22, Details §3 „Skins sichtbar gemacht") — Gebäude/Einheiten/
  Dorf-Theme rendern angewandte Skins; am Emulator verifiziert.
- **Sound-Cues hörbar machen:** `expo-av` einhängen (`setSoundPlayer`), siehe Abweichung 21 (braucht nativen Build).
- **Echte IAP/Apple-Google-Verifizierung**, **Account-Löschung** (latente FK-Audits, §5), **Unit-Spezialfähigkeiten**,
  **Upgrade-Kostentabellen** für die restlichen Gebäude, **Fishfolk-Wasser-Adjazenz** — alle in §5 beschrieben.
- **Mehr-Instanz-Skalierung** (Redis-Schlüsselschema), echte **React-Navigation** statt `activeScreen`-Switch.

### Phasen-Fahrplan (gesamt)
- [x] Phase 1 — Fundament
- [x] Phase 2 — Dorf
- [x] Phase 3 — Kampf
- [x] Phase 4 — Clans & Ranglisten
- [x] Phase 5 — Dungeon & Monetarisierung
- [x] **Phase 6 — Grafik & Effekte (Game Juice)** ✅

---

## 7. Gelernte Stolperfallen (Windows/PowerShell-Umgebung)

- **PATH:** node/npm bei jedem Befehl per Registry neu laden (siehe §2).
- **curl + JSON in PowerShell:** Backtick-Quoting zerschießt JSON-Bodies → stattdessen
  `Invoke-WebRequest` mit `-Body ($obj | ConvertTo-Json -Compress)` nutzen. Fehler-Bodies via
  `$_.ErrorDetails.Message` lesen (PS 5.1 liefert sie sonst leer).
- **`$pid`** ist eine schreibgeschützte PS-Automatik-Variable — nicht als eigene Variable nutzen.
- **`pg_ctl ... start | Out-Null` hängt** (Daemon erbt das Pipe-Handle) → nie an Out-Null/Pipe
  hängen; Logfile via `-l` reicht.
- **psql `-t -A` + `RETURNING`** hängt den Status-Tag („UPDATE 1") mit an die Ausgabe → für IDs
  lieber separates `SELECT`.
- **pg BIGINT** kommt als String zurück → in Mappern via `Number()` wandeln (siehe
  `server/src/services/mappers.ts`).
- **npm blockiert esbuild-postinstall** (Warnung) — egal, `tsx` läuft über das
  `@esbuild/win32-x64`-Plattformpaket.
- Hintergrund-Server stoppen: Prozess auf Port killen
  (`Get-NetTCPConnection -LocalPort 4000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`).

---

## 8. Geräte-/Emulator-Check — ✅ VERIFIZIERT 2026-06-20 (wichtig für Wiederaufnahme)

**Ergebnis:** Phase-2-UI läuft als **nativer Dev-Build** (`com.villagewars.app`) auf dem
Android-Emulator und ist **visuell + interaktiv verifiziert**. Beide anfänglichen Umgebungs-Blocker
sind gelöst (Defender-Ausnahme durch Nutzer + Gradle zurück auf 8.8). Geprüft & funktionierend:
AuthScreen (Register/Login, Fraktionsliste aus `/api/config`), VillageScreen mit **Skia**-Iso-Dorf
(Boden, Grid, Gebäude-Sprites, Rathaus mit Fahne), ResourceHeader (Caps + Produktions-Tick),
BuildingInfoSheet (Tier-Name, Upgrade-Kosten/Zeit), **Upgrade starten** (Ressourcen-Abzug +
grüner Upgrade-Ring + Timer), **Skip** (degressive Goldbarren-Kosten + Fehlerleiste bei zu wenig),
**Gebäude platzieren** (neues Sprite, Maler-Sortierung). Expo Go bleibt unbrauchbar (siehe Blocker A).

### Was eingerichtet wurde (bleibt bestehen)
- **Android Studio** unter `C:\Program Files\Android\Android Studio` (bringt JBR = Java 21 mit).
- **Android-SDK** unter `%LOCALAPPDATA%\Android\Sdk`. Neu installiert: `cmdline-tools/latest`,
  `platforms;android-34/35`, `build-tools;34.0.0`, `system-images;android-35;google_apis;x86_64`,
  `ndk;26.1.10909125`, `cmake;3.22.1`. SDK-Lizenzen liegen als Hash-Dateien in `…\Sdk\licenses`.
- **AVD `vw_pixel`** (Pixel 6, API 35, x86_64). Start:
  `& "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd vw_pixel -no-audio -no-boot-anim -gpu auto`.
  **HW-Beschleunigung (WHPX) funktioniert**, GPU via Vulkan (RTX 4070 Ti) — flüssig.

### Stolperfallen, die GELÖST sind (für Wiederaufnahme zwingend beachten)
1. **Node v26.3.1 ist inkompatibel mit Expo SDK 51.** Der Expo-CLI-**Manifest-Endpunkt `/` hängt
   komplett** unter Node 26 (Metro-Core/`/index.bundle` funktionieren aber). → **`expo start`
   IMMER unter Node 20 starten.** Portables Node 20 lag unter `%TEMP%\node20\…` (ggf. neu laden:
   `nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip`). Aufruf:
   `& <node20>\node.exe <repo>\node_modules\expo\bin\cli start --port 8081`.
2. **Emulator↔Host-Netzwerk:** Gerät erreicht den Host nur über den NAT-Alias **`10.0.2.2`**
   (sowohl Metro `:8081` als auch Backend `:4000` antworten dort). `adb reverse` lieferte NICHTS.
   → Metro mit `REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2` starten **und** `apps/mobile/.env`
   = `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`. Firewall blockt 10.0.2.2 nicht (Loopback-Mapping).
3. **Skia-Version:** Expo Go SDK 51 bündelt `@shopify/react-native-skia` **1.2.3**; das Projekt
   pinnte 1.3.11 (Mismatch). → in `apps/mobile/package.json` auf **1.2.3** angeglichen, Typecheck 0 Fehler.
4. Bei Expo Go nach Fehlversuchen **`adb shell pm clear host.exp.exponent`** (Expo Go cached den
   fehlgeschlagenen Ladeversuch und zeigt ihn sofort wieder).

### Blocker A — Expo Go crasht (Runtime-Inkompatibilität)
App-JS lädt und läuft (`Running "main"`), aber Expo Go (vorgebautes Binary, SDK 51) crasht beim
nativen Init: `java.lang.IllegalStateException: Unable to attach a rootView … UIManager is not
properly initialized` bzw. `ClassCastException: host.exp.exponent.MainApplication cannot be cast to
com.facebook.react.ReactApplication`. Der Standard-Fix `newArchEnabled:false` (in app.json gesetzt)
ändert die Fehlerart, behebt ihn aber nicht. → Expo Go ist hier **keine** gangbare Option.

### Blocker B (GELÖST) — Nativer Dev-Build war durch Windows Defender blockiert
`expo prebuild` erzeugte `apps/mobile/android/` sauber. Der Gradle-Build scheiterte zunächst
**deterministisch** an Gradles „immutable workspace move" der Version-Catalog-Accessors:
`java.nio.file.AccessDeniedException … dependencies-accessors\…` → Windows-**Defender-Echtzeitschutz**
sperrte die frisch geschriebenen `.class`-Dateien beim atomaren Move. Erfolglos (ohne Admin):
`org.gradle.vfs.watch=false`, `daemon=false`, `subst`/Junction (Gradle kanonisiert auf den echten Pfad), 6× Retry.
**Lösung:** Nutzer fügte eine **Defender-Ordner-Ausnahme** für `…\apps\mobile\android` hinzu
(Windows-Sicherheit-GUI, umgeht Manipulationsschutz). Wichtig: Mein Versuchs-Upgrade auf Gradle 8.10.2
musste **zurück auf 8.8** (8.10.2 entfernte `org.gradle.configurationcache.extensions.serviceOf`,
das die RN/Expo-Settings-Skripte brauchen). Zusätzlich fehlte die Farbe `splashscreen_background`
in `…/res/values/colors.xml` (prebuild-Artefakt ohne `expo-splash-screen`) → ergänzt (`#ffffff`).
MAX_PATH war unkritisch (JBR/Gradle kamen mit dem grenzwertigen Accessor-Pfad durch). Build nur für
`-PreactNativeArchitectures=x86_64` (Emulator-Arch) → schneller. **`.gradle` ggf. langpfad-sicher
löschen:** `cmd /c rmdir /s /q "\\?\<pfad>\.gradle"`.

### Build/Run-Rezept (reproduzierbar)
```
JAVA_HOME = C:\Program Files\Android\Android Studio\jbr   ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk
# Build (Node 20 im PATH):
cd apps\mobile\android & gradlew.bat :app:installDebug -PreactNativeArchitectures=x86_64 --console=plain
# Metro (Node 20!) + App starten:
REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2 ; <node20> <repo>\node_modules\expo\bin\cli start --port 8081
adb shell am start -n com.villagewars.app/.MainActivity
```
APK liegt unter `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (~149 MB, x86_64).

### Geänderte Projektdateien in dieser Session (Entscheidung bei Phase 3 treffen)
- `apps/mobile/package.json`: Skia `1.3.11`→**`1.2.3`** (Korrektur, Expo-SDK-51-konform — behalten);
  `android`/`ios`-Scripts via prebuild auf `expo run:android/ios`.
- `apps/mobile/.env`: `EXPO_PUBLIC_API_URL` → `http://10.0.2.2:4000` (**Emulator**-Adresse; für
  physisches Gerät = LAN-IP, für Web/lokal = `localhost`).
- `apps/mobile/app.json`: `newArchEnabled` `true`→**`false`**. Der Dev-Build wurde mit `false` (alte
  Architektur) gebaut und verifiziert. Für einen New-Arch-Build wieder auf `true` + neu bauen.
- `apps/mobile/android/` + `ios/` **neu** (prebuild). `android/gradle.properties`: `vfs.watch=false`,
  `daemon=false`. Wrapper = Gradle **8.8**. `res/values/colors.xml`: `splashscreen_background` ergänzt.
- **Test-Spieler** in DB: `demobuild`, `demobuild2` (PW `demobuild123`); `emuclan` (PW `emuclan123`,
  TH5, Clan-Burg L2, Leader des Clans **EmuGarde [EMU]**) — angelegt für die Phase-4-Emulator-Verifikation;
  `dragontest1` (PW `dragontest123`, Fraktion **Drachenmenschen**) — für die Verifikation der 8. Fraktion.

---

## 9. Grafik-Überarbeitung per Bild-Vorlagen (laufend ab 2026-06-22)

**Nutzer-Entscheidung:** Die bisherige prozedurale Skia-Vektorgrafik gefällt nicht. Stattdessen liefert der Nutzer
**pro Rasse ein Bild**, das **alle** grafischen Inhalte dieser Rasse enthält (Gebäude, Einheiten, Map), und die App
soll **genau so** aussehen wie auf dem Bild. Die Bilder kommen **einzeln** (eines pro Rasse).

**Aktueller Stand:** Die 8. Rasse **Drachenmenschen** ist **funktional** fertig (§3) — Daten/Logik/Balance stehen,
nur die **Optik** ist noch generisch. Als Nächstes: **Bilder abwarten und je Rasse das Aussehen 1:1 umsetzen.**

**Technische Ausgangslage für die Umsetzung (wichtig für die Bild-Integration):**
- Heutige Optik ist **prozedural in Skia** gezeichnet (Vektoren/Shader), keine Bild-Assets. Für „sieht aus wie das
  Bild" ist eine **Asset-Pipeline** der wahrscheinliche Weg: Bilder als PNG-Sprites einbinden (z. B. pro Gebäudetyp/
  Einheit/Terrain eine Textur), ggf. via `expo-asset`/`@shopify/react-native-skia` `useImage`. Das ist ein **nativer**
  Belang nur, falls neue native Module nötig werden (sonst reicht ein Metro-Bundle).
- Andockpunkte je Inhalt: **Gebäude** [buildingSprite.tsx](../apps/mobile/src/rendering/buildingSprite.tsx)
  (Dispatch je `type`), **Einheiten** [BattleCanvas.tsx](../apps/mobile/src/components/battle/BattleCanvas.tsx) +
  [DungeonBattleView.tsx](../apps/mobile/src/components/battle/DungeonBattleView.tsx), **Map/Boden**
  [terrain.tsx](../apps/mobile/src/rendering/terrain.tsx). Eine **fraktionsabhängige** Auswahl ist neu: bisher ist die
  Optik nur nach Gebäudetyp/Rolle, nicht nach Fraktion gewählt → für rassenspezifische Bilder muss die **Fraktion**
  bis in die Renderer durchgereicht werden (Spieler-`faction` ist im Store vorhanden).
- **Skin-System** (§3) zeigt bereits, wie man Render-Daten zentral ableitet (`rendering/skins.ts`) — analog lässt sich
  eine **Asset-/Fraktions-Tabelle** aufbauen.

> **Offene Frage an den Nutzer (bei Bildlieferung):** Format/Auflösung der Bilder und ob ein Bild EIN Sprite-Sheet mit
> allen Elementen ist (dann Zuschnitt nötig) oder bereits getrennte Elemente. Danach Asset-Pipeline + Renderer-Umbau.

### 9.1 Menschen-Erweiterung — Entscheidungen & Fortschritt (2026-06-22)
**Nutzer-Entscheidung (AskUserQuestion):** (a) **VOLLE Erweiterung** — alle Inhalte des Menschen-Bilds als echte
Spielinhalte (nicht nur Reskin); (b) **Menschen bleiben Balance-Baseline** (kein Rassenbonus aus dem Bild übernehmen,
nur Optik). Bild-Roster: ~24 Hauptgebäude + 5 Ressourcen + 5 Türme + Mauern/Tore + 6 Fallen + 5 Epische + Boss
(Königsschloss) und **35 Einheiten** (Infanterie/Fernkampf/Kavallerie/Belagerung/Magie/Spezial).

**Architektur:** Neue Inhalte werden **fraktionsexklusiv** je Rasse modelliert (jede Rasse bekommt ihr eigenes Roster
über ihr Bild). Bestehende **common**-Gebäude/-Einheiten bleiben (Rathaus/Kaserne/Türme/Ressourcen/Mauer + Milizionär/
Bogenschütze/Ritter/Katapult/Heiler) und werden später nur optisch an die Menschen-Bilder angepasst; genuin neue
Elemente kommen als `factions_exclusive_content.humans` dazu.

**Erledigt (Daten, ohne Bild nötig):** Der **volle Menschen-Einheiten-Pool** ist in `game-config.json` ergänzt —
30 neue Einheiten (+ bestehender Hauptmann) als `factions_exclusive_content.humans.exclusive_units`: Speerkämpfer,
Axtkämpfer, Schildträger, Paladin, Königsgarde, Champion, Armbrust-/Langbogenschütze, Kanonier, Belagerungsschütze,
Feuerwerfer, Schnellfeuerkanone, Leichte/Schwere Kavallerie, Lanzenreiter, Ritter des Ordens, Belagerungsritter,
Rammbock, Trebuchet, Ballista, Belagerungsturm, Magier, Hoher Magier, Weiße Hexe, Erzengel, Spion, Ingenieur,
Drachenreiter, Berserker, Runenritter (= **36 Menschen-Einheiten** common+exklusiv). Werte sind **konsistent zur
bestehenden Skala vorgeschlagen** (in der Config frei anpassbar — eiserne Regel: alle Zahlen zentral). Einheiten
brauchten **keine** Engine-/Typ-Änderung (combat liest hp/dps/range/speed/splash/heal generisch). Verifiziert:
3× tsc 0 Fehler, JSON valide, Engine-Check (`unitsForFaction('humans')`=36, alle Kampfwerte/Kosten valide, **0 NaN-
Kosten** trotz Teilkosten-Objekten), Server neu gestartet + Health OK. Textuelle Spezialfähigkeiten sind wie gehabt
**noch nicht simuliert** (deferred, gleiche Lücke wie alle anderen Spezial-Traits).

**NÄCHSTE SCHRITTE (offen):**
1. **Gebäude-Erweiterung:** neue Türme (Bogenschützen-/Kanonen-/Magier-/Flammenturm) brauchen `ExclusiveBuildingConfig`
   um `base_damage_per_second`/`range_tiles` erweitert + Engine liest sie → dann als Verteidigung aktiv. Mauer-Tore,
   Fallen (neue Defense-Kategorie + Trigger-Logik), Subsystem-Gebäude (Markt/Akademie/Werkstatt/Spionage/Münzpräge/
   Gildenhalle/Ritterorden = teils neue Systeme → zunächst als platzierbare Struktur ohne Funktion), Epische + Boss.
2. **VISUALS:** siehe §9.2 — Entscheidung gefallen (Stil nachbauen, NICHT Sprites schneiden).

### 9.2 Visueller Ansatz: Stil NACHBAUEN (2026-06-22)
`design/humans.png` lag vor, ist aber **WebP 1344×896** (trotz `.png`-Endung) — zu niedrig aufgelöst zum Sprite-Schneiden
(Icons ~60 px, dunkles Panel → Freistell-Artefakte, Karte ist EIN Gesamtbild). Tooling: `sharp` unter `C:\Users\Ufuk\
vw_imgtools` (WebP-fähig; `crop.js`/`extract.js` für Crops/Freistellen — für künftige höher aufgelöste Vorlagen bereit).
**Nutzer-Entscheidung (AskUserQuestion): „Stil nachbauen (scharf)"** — die vorhandene Skia-Vektor-/Shader-Grafik im
**Stil des Bildes** nachbauen (scharf in jeder Größe), nicht pixelgenau die Vorlage.

**Erledigt — Menschen-Baustil (fraktionsabhängig):** [buildingSprite.tsx](../apps/mobile/src/rendering/buildingSprite.tsx)
hat jetzt `faction`-Prop + `HUMAN_PALETTE` — **royalblaue Dächer (`#2f5fbf`), helle Steinmauern, Gold-Akzente** je Typ
+ **Grassockel** (grüne Iso-Plattform mit Erdrand) unter jedem Gebäude (Signatur des Bildes). Greift NUR für
`faction==='humans'`; andere Rassen behalten die bisherige Optik bis zu ihren Bildern. Skin überschreibt weiterhin die
Palette. **Faction-Routing:** VillageScreen→VillageCanvas (`player.faction`), BattleScreen→BattleCanvas
(`battleSetup.defender_faction`) → BuildingSprite. tsc 0 Fehler. **Emulator (emuclan=Menschen):** Dorf zeigt blaue
Dächer + Grasplattformen — klar im Bild-Stil (Vorschau: `design/preview-humans-village.png`). Hinweis: emuclans
Test-Skins wurden für den sauberen Blick **deaktiviert** (`player_skins.is_active=false`; jederzeit im Shop reaktivierbar).

### 9.3 KORREKTUR: echte Sprites AUS dem Bild ausschneiden (2026-06-22)
Nutzer-Feedback nach dem Vektor-Nachbau: **„komplett andere Welten — bau die Gebäude GENAU so wie auf dem Bild."**
→ Kurswechsel: die **echten Gebäude werden aus `design/humans.png` ausgeschnitten** und als **Bild-Sprites** gerendert
(statt nachgemalt). Qualität: Quelle ist klein (~60 px/Icon) → Sprites sind etwas weich, aber es sind die **echten
Gebäude vom Bild**.
- **Tooling** (`C:\Users\Ufuk\vw_imgtools`, sharp): `grid.js` (Koordinaten-Raster zum Ablesen), `boxes.json` (Crop-Boxen
  je Gebäudetyp), `extractAll.js` (schneidet aus + **Flood-Fill vom Rand** entfernt den dunklen Panel-BG sauber, lässt
  Gebäude-Konturen intakt + Kanten-Feather; 3× hochskaliert), `sheet.js`/`crop.js` (Prüf-Übersichten).
- **Assets:** `apps/mobile/src/assets/factions/humans/buildings/*.png` — town_hall, barracks, watchtower, cannon,
  gold_mine, lumber_camp, quarry, storage_wood, storage_gold (+ storage_stone = Kopie von wood). wall/clan_castle: noch
  kein Sprite → prozeduraler Menschen-Fallback.
- **Renderer:** `rendering/humanBuildingAssets.ts` (`useHumanBuildingImages()` lädt die Sprites via Skia `useImage` —
  Metro-Bundle, **kein nativer Rebuild**). `buildingSprite.tsx` hat neue `image`-Prop: ist sie gesetzt, wird das Sprite
  gezeichnet (Sockel am vorderen Tile-Rand, `FW*1.75` breit, aspektkorrekt) statt der Vektorgrafik — Schatten/Auswahl/
  Upgrade/**Hit-Flash (weiß via ColorMatrix)** bleiben. VillageCanvas/BattleCanvas reichen das Sprite je `building_type`
  durch (nur Menschen; aktiver Skin hat weiterhin Vorrang vor dem Sprite). tsc 0 Fehler.
- **Emulator (emuclan=Menschen):** Dorf zeigt die **echten Bild-Gebäude** (Burg/Kaserne/Lager/Mine/Türme), sauber
  freigestellt auf dem Gras. Vorschauen: `design/preview-humans-village.png` (Dorf) + `design/preview-humans-sprites.png`
  (freigestellte Sprites auf Magenta).
- **Offen:** restliche Bild-Gebäude ausschneiden (Türme Bogen/Magier/Flamme, Tore, Fallen, Epische, Boss, Stall/Schmiede/
  Akademie/Markt/… als neue Typen), **Einheiten-Sprites** für den Kampf, Mauer/Clan-Burg-Sprite, ggf. Größen-Feintuning
  pro Gebäude. Der Vektor-Menschen-Stil (HUMAN_PALETTE/Finials/Grassockel aus §9.2) bleibt als Fallback erhalten.

### 9.4 FINALE Entscheidung: doch detaillierter VEKTOR-Keep (2026-06-22) — AKTUELLER STAND
Die ausgeschnittenen Sprites (§9.3) gefielen dem Nutzer **nicht** (zu weich/niedrig aufgelöst). **Entscheidung (AskUserQuestion):
„Stil nachbauen (scharf)"** → **Bild-Sprites wieder ABGESCHALTET** (Wiring aus VillageCanvas/BattleCanvas entfernt; die
`image`-Prop + `humanBuildingAssets.ts` + Assets bleiben als **dormante Infra** liegen, falls je hochauflösende Bilder kommen).
Renderer rendert wieder den Vektor-Menschen-Stil. Danach iterativ stark aufgewertet (Nutzer wollte „1000× cooler"):
- **buildingSprite.tsx** neue Bausteine: **`RoundTower`** (runder Steinturm: Schaft mit Steinfugen + Schießscharte +
  Cornice-Ring + blaues **Kegeldach** + Gold-Knauf + optionalem **Wimpel**). `Roof` um **Schindel-Linien** + optionale
  **Gold-Grate/Gold-Traufe** (`gold`-Prop) erweitert.
- **Rathaus (human)** = prächtiger **5-Turm-Keep**: 4 Eck-`RoundTower` + großer **zentraler Bergfried** (`RoundTower`),
  **Zinnen-Parapet** auf dem Steinsaal, **Bogentor** mit Gold-Bogen, **leuchtende Bogenfenster**, **Wand-Wappenbanner**,
  **Fackeln am Tor** (flackern über `clock`), **goldener Glüh-Schein** (gated `!reduceEffects`), Wimpel an allen Türmen.
  ⚠️ Der frühere Pavillon-Dach-Versuch hatte einen **Bug** (Gold-Grate saßen durch den Dachüberstand verschoben = wirres
  Gold-Spinnennetz) → ENTFERNT, durch den sauberen zentralen Bergfried ersetzt.
- **`TYPE_SCALE`** (Modul-Konstante): Hero-Gebäude werden größer gerendert — **town_hall ×1.55**, clan_castle ×1.2
  (skaliert um den Sockel). Grund: auf dem Handy ist ein Gebäude ~100 px → Details verpuffen sonst.
- **Wachturm (human)** = sauberer hoher `RoundTower`. **Clan-Burg (human)** = kompakte Burg (3 `RoundTower` + Zinnen-Saal
  + Tor + kleines Banner). Wirtschaftsgebäude/Kaserne nutzen weiter die HUMAN_PALETTE (blaue Dächer/Stein/Gold).
- **Verifikation:** tsc 0 Fehler (mehrfach). **Rathaus am Emulator visuell bestätigt** (Vorschau `design/preview-townhall.png`
  = sauberer 5-Turm-Keep, kein Dach-Bug). **Wachturm + Clan-Burg: NOCH NICHT visuell bestätigt** — der Emulator ist in
  dieser Session **5×+ abgestürzt** (Software-GPU `swiftshader_indirect` + Metro + Server überlasten den Host; `screencap`
  hängt zudem bei `-gpu auto`). Sie nutzen denselben verifizierten `RoundTower`. **Beim nächsten stabilen Emulator-Lauf
  Gesamt-Screenshot ziehen.**
- **Rollout-Fortschritt (2026-06-22):** **Kaserne** (human) = Steinhalle + blaues Satteldach (Gold-First) + Wach-`RoundTower`
  + Schwerter-Wappen + Wimpel; **Kanonenturm** (human) = Steinturm + Zinnen + Kanonenrohr. tsc 0 Fehler. **NOCH NICHT visuell
  bestätigt** (Emulator-Abstürze, s.o.). Wirtschaftsgebäude (Mine/Holzfäller/Steinbruch/Lager) haben über HUMAN_PALETTE +
  Grassockel bereits blaue Dächer/Stein/Gold — bewusst nicht umgebaut.
- **OFFEN:** Gesamt-Screenshot (Emulator stabil), evtl. Wirtschaftsgebäude-Feinschliff; dann restliche Bild-Inhalte
  (weitere Türme/Tore/Fallen/Epische/Boss) als neue Typen; **Einheiten-Look** im Kampf.
> **Emulator-Stabilität (wichtig fürs Wiederaufnehmen):** `-gpu auto` → `screencap` hängt (Framebuffer); `-gpu
> swiftshader_indirect` macht `screencap` zuverlässig, aber der Emulator **crasht wiederholt** unter Last. Tipp: vor der
> Emulator-Arbeit ggf. Build/sharp-Prozesse beenden; Screenshot via `adb exec-out screencap -p > file` in der **Bash**-Shell
> (binär-sicher), NICHT PowerShell-Redirect. Login: `Anmelden`-Knopf liegt über der Tastatur; **kein BACK** drücken (verlässt die App).

---

## Vertical Slice — Schritt 2: Weltmaßstab, Zoom, Dorf-Layout (2026-07-27)

**Reine App-Integration, keine Blender-Assets geändert. Alle 3 Workspaces `tsc --noEmit` = 0 Fehler.**

- **Gemeinsamer Weltmaßstab** (`packages/shared/src/game/worldScale.ts`, exportiert via `game/index.ts`):
  eine Konstante `PX_PER_WORLD_UNIT = 45`; Gebäude **und** Einheiten rechnen ihre Anzeigebreite nur noch
  über die px/Welteinheit ihres Masters (`BUILDING_MASTER_PPU = 38.74`, `UNIT_MASTER_PPU = 233`;
  `buildingDisplayWidth`/`unitDisplayWidth`). **Entfernt:** `FW*1.2`+`TYPE_SCALE` im Bild-Sprite-Pfad
  (`buildingSprite.tsx`; TYPE_SCALE gilt nur noch für die Vektor-Fallback-Optik) und `UNIT_DISP_W=123`
  (`BattleCanvas.tsx`). Nachweis: Rathaus 261px/38.74=6.74 WE → 303px = **4.74 Kacheln**; Archer-Körper
  197px/233=0.845 WE → **38px**. Gebäude verankern jetzt am Fußpunkt-Anker aus `manifest.json`.
- **Alle 12 Menschen-Gebäude im Renderer aktiv:** `humanBuildingAssets.ts` → `useHumanBuildingSprites()`
  (Bild+Anker aus Manifest), eingehängt in VillageCanvas **und** BattleCanvas (vorher nur th/barracks bzw. Vektor).
- **Zoom 0.5x–1.5x** (`packages/shared` `clampZoom`/`zoomAround`/`ZOOM_*`; App-Hook
  `apps/mobile/src/rendering/useWorldCamera.ts`): gemeinsamer Pan+Zoom-Zustand für Village- & BattleCanvas.
  Web = Mausrad auf Mausposition (DOM-`wheel`-Listener am Container), Mobil = Zwei-Finger-Pinch auf Fingermitte.
  Kamera-Group `[translate, scale]` — Sprites nur skaliert, kein Nachladen. Tap-Rückprojektion + Overlay-
  Positionen (aufsteigende Zahlen) berücksichtigen Pan **und** Zoom.
- **Grundflächen im Manifest** aus gemessener Sockelbreite (Bodenkontakt) je Master abgeleitet:
  `tiles` z.B. town_hall/barracks/Lager/gold_mine/quarry = 5, cannon/clan_castle/watchtower = 4, wall = 3.
- **Kontur-Archer = Standard:** `apps/mobile/.../units/archer.png` ist jetzt die Kontur-Variante (dünner
  dunkler Umriss), Plain gesichert als `archer_base.png`, reproduzierbar via `node tools/build_unit_outline.js
  archer 5` (Alpha-Dilatation, reine App-Nachbearbeitung — Blender unangetastet). Loader zeigt auf `archer.png`.
- **CanvasKit-Harness** (`tools/harness/`): importiert Maßstab/Geometrie/Zoom aus `@village-wars/shared`
  und liest Dateien+Anker aus derselben `manifest.json` wie der Renderer — **keine duplizierten App-Zahlen**.
  Skripte: `scale_check.ts`, `zoom_check.ts`, `scale_village.ts`, `outline_check.ts`, `zoom_village.ts`
  (+ `lib.ts`, `village.ts` mit Layout-Validator: kein Überlappen, ≥1 freie Kachel). Bilder unter
  `design/harness/vslice2_*`. **Kein Emulator-Test in dieser Runde** (folgt separat).

---

## Vertical Slice — Schritt 3-Korrektur: echte (sockellose) Grundflächen (2026-07-27)

**Blender-Pipeline (nur Grassockel abgetrennt, Gebäude-Geometrie unverändert) + reine App-Integration. Alle 3 Workspaces `tsc --noEmit` = 0 Fehler.**

- **Sockellose Master:** Der Grassockel (Objekte `dirt/grass/grass2/tuft` + Dreckhof `yard/apron`, Boden-Materialien `grass/grass_d/dirt/dirt_l/moss`, z<0.6) war reine Deko und ist beim Export ausgeblendet. Neuer Wrapper `design/blender/_scripts/export_socketless.py`: runpy des jeweiligen `<gebäude>_tiered.py` (Szene/Kamera/Licht wie immer), entfernt die Bodenobjekte, senkt das Bauwerk auf z=0 und rendert sockellos → `design/blender/_nosockel/<type>.png` + JSON. Alle 12 Gebäude Tier 3 (town_hall Tier-Arg 3, Rest lvl08→Tier3).
- **512-Master + Anker + Footprints:** `tools/build_socketless_masters.js` normalisiert die sockellosen Renders auf **38.74 px/WE** (= `BUILDING_MASTER_PPU`), schreibt die App-Master neu (alte Sockel-Master → `apps/mobile/src/assets/factions/humans/_archiv_sockel_v01/`). **Anker rein 2D bestimmt** (robust gegen je-Gebäude verschiedene Kamera): horizontal Modellzentrum (Projektion x=0, stabil 350/700), vertikal **unterster sichtbarer Pixel** = Bodenkontakt → alle Anker ≈ `[0.5, 0.92]`. (Die Blender-`(0,0,0)`-Projektion war je Gebäude bis 106px daneben — verworfen.)
- **Footprints (Bodenkontakt des Bauwerks, gerundet), im Manifest:** town_hall **4×4**, gold_mine **4×4**, barracks/quarry/storage_wood/storage_stone/storage_gold/lumber_camp **3×3**, clan_castle/watchtower/cannon/wall **2×2**. (Basis-/Voll-Messung je Gebäude in `design/blender/_nosockel/_masters_report.json`; Holz/Lager von Basis 2 auf 3 angehoben wegen breiter Boden-Props.)
- **Harness:** `control_ground.ts` (Bodenanschluss-Check, 3 Gebäude auf durchgehendem Rasen), `village.ts` neu = **enges CoC-Dorf** (Rathaus/Kaserne/2 Lager/Wachturm, je genau 1 Kachel Weg, Archer in den echten Gassen), Gebäude sitzen an der **Vorderecke ihrer Grundfläche** (`gridToScreen(gx+f,gy+f)`, Unterkant-Anker → füllt Footprint). `scale_village.ts`/`zoom_village.ts` zeigen es bei 0.5/1.0/1.5x. Bilder: `design/harness/vslice3_bodencheck_v04.png`, `vslice2_testdorf_v05.png`, `vslice2_dorf_zoom{05,10,15}_v02.png`.
- **Kein Emulator-Test** (folgt separat). Blender-Assets (`.py`, alte Sockel-Renders) unverändert bzw. versioniert beiseite.

---

## Bodenanschluss-Fix (sockellose Gebäude schwebten) — 2026-07-27

**Diagnose:** Der als Fußpunkt genutzte *unterste sichtbare Pixel* (alpha>24) war bei Gebäuden mit Boden-Props (Lager/Mine/Holz) **kein Schatten und kein Alpha-Saum**, sondern eine **dünne, voll deckende Prop-Kante** (Gestell-/Zaunbein, Karren, Treppe), die 6–25 px unter dem eigentlichen Fundament (der breiten Hauptmasse) endet. Der Anker saß auf dieser vordersten Kante → die Hauptmasse „schwebte" darüber. (Bei town_hall/watchtower nur 1–3 px.) Zweitursache im alten Kontrollbild: Platzierung auf der Kachel*mitte* statt an der Footprint-*Vorderecke* (halber-Kachel-Versatz).

**Fix:**
- `tools/build_socketless_masters.js`: neuer `foundationBottomRow()` — Anker-y = unterste Zeile mit **breitem, voll deckendem Lauf** (≥20 % der Max-Fundamentbreite, alpha≥200); dünne Prop-Kanten/AA-Saum werden übersprungen. Anker jetzt ≈ `[0.5, 0.88]` (FOOT_FRAC 0.88, Prop-Fortsatz taucht darunter leicht in den Rasen). Report nennt den Fortsatz je Gebäude (`legBelowPx`).
- Platzierung überall an der Footprint-**Vorderecke** `gridToScreen(gx+f, gy+f)` (Kontrollbild + Dorf konsistent).
- Manifest-Anker auf 0.8809 aktualisiert (tiles unverändert).

**Verifikation:** `tools/harness/control_ground.ts` misst je Gebäude **unabhängig** die Fundament-Unterkante aus dem Master und vergleicht mit der Rasenlinie → **Fundament→Rasen = 0.0 px** (town_hall/storage_stone/watchtower). Bild `design/harness/vslice3_bodencheck_v06.png` (3 Gebäude auf durchgehendem Rasen, weiße Rasenlinie + rote Fundament-Marke fallen zusammen). Dorf + Zoom neu: `vslice2_testdorf_v06.png`, `vslice2_dorf_zoom{05,10,15}_v03.png`. Mobile-Typecheck grün.

---

## Boden-Schatten entfernt + runde Basen geerdet — 2026-07-27

**1. Schatten-Quelle:** Die Ellipsen waren **im Renderer gezeichnet**, NICHT im Blender-Master (die Master sind transparent — `film_transparent` + kein Bodenobjekt → kein gebackener Schatten). Entfernt in `apps/mobile/src/rendering/buildingSprite.tsx` (Bild-Pfad, `shadowR`-Circle) und im Harness `tools/harness/lib.ts` (`drawSprite`, nur Gebäude — Einheiten behalten ihren kleinen Fußschatten). Gebäude sitzen jetzt direkt auf dem Rasen (CoC-Style).

**2. Runde Basen:** Die alte „Fundament-20 %-Breite"-Regel hob den Anker bei spitz zulaufenden Rundbasen (clan_castle) über den Boden. Profil-Diagnose: runde Basis = Breite **wächst** vom untersten Pixel (watchtower 50→82→98…), Prop-Bein = **konstant dünn** (storage_stone 7,9,9,9…). Neuer `groundContactRow()` in `tools/build_socketless_masters.js`: Anker = **tiefster solider Pixel** (alpha≥128, Lauf ≥2) → trifft die Rundbasis-Unterkante exakt, ignoriert nur den weichen AA-Saum. Anker-y ≈ 0.8809 (Manifest unverändert gültig).

**3. Verifikation ohne Ellipse:** `tools/harness/control_ground.ts` misst **alle 12** Gebäude unabhängig (tiefster solider Pixel vs. Rasenlinie): **Basis→Rasen = 0.0 px durchweg**, weicher Saum 0–1.1 px — inkl. der runden watchtower/clan_castle. Kontrollbild `design/harness/vslice3_bodencheck_v07.png` (4 Gebäude inkl. beider runden, ohne Ellipse). Dorf + Zoom neu: `vslice2_dorf_zoom{05,10,15}_v04.png`. Mobile-Typecheck grün.

---

## Emulator-Test Vertical Slice (Haptik) — 2026-07-27

Getestet auf `vw_pixel` (nativer Emulator, **swiftshader/Software-GPU**) mit emuclans echtem Dorf (Rathaus 5), aktuelle sockellose Assets. Screenshots: `design/emu/vslice_*.png`.

**Gut:** Sauberer Start (keine JS-/Asset-Fehler); alle 12 sockellosen Gebäude rendern; **keine Schatten-Ellipsen, Gebäude sitzen direkt auf dem Rasen** (auch runde Wachturm/Clan-Burg — Bodenanschluss-Fix trägt live). Pan direkt/flüssig. **Pinch-Zoom verifiziert** (per sendevent-Multitouch, `adb root` nötig): zoomt zur Fingermitte, bidirektional, klemmt bei 0.5x/1.5x. Tap-to-select funktioniert (Clan-Burg → Info-Sheet).

**Holprig / Befunde:**
1. **Gebäude überlappen stark** — emuclans Layout ist für die alten kleinen Sprites; die neuen weltmaßstäblichen sind viel größer. Zusätzlich platziert die App am Ursprungs-Kachelzentrum (nicht footprint-bewusst). → Re-Layout/Spacing nötig.
2. **Kleine, versetzte Trefferzone beim Tap** — Hit-Test matcht nur die EINE Ursprungskachel (`b.grid_x===gx && b.grid_y===gy`), nicht den Footprint. Bei großen Sprites eine schmale Zone an der Basis; Wachturm 3× verfehlt. → **Fix: Hit-Test auf alle Footprint-Kacheln ausdehnen.**
3. **Kein Pan-Clamping** (useWorldCamera unbegrenzt) — Dorf ins Leere schiebbar. → Rand-Begrenzung ergänzen.
4. **Mausrad-Zoom nur web** (`Platform.OS==='web'`); App nicht web-lauffähig (`react-native-web` fehlt) → nur Pinch auf Emulator prüfbar. Wheel teilt `zoomAround` (harness-verifiziert).
5. **Perf nicht repräsentativ** (Software-Renderer, RNSkia-Fallback-Spam „can safely be ignored").

**Nebenwirkung:** versehentlich ein Clan-Burg-Upgrade auf emuclan gestartet (Fehltap Upgrade-Button statt X; Ressourcen abgezogen, 1441-min-Timer) — harmlos, Testaccount.

---

## Vertical-Slice-Fixes (nach Emulator-Test) — 2026-07-28

Alle im Emulator (emuclan, vw_pixel) belegt. Screenshots `design/emu/fix*`. Mobile-Typecheck grün.

1. **Hit-Test ganzer Footprint** (`apps/mobile/src/rendering/buildingFootprints.ts` + `VillageCanvas.handleTap`): Tap trifft auf JEDER Footprint-Kachel (nicht nur Ursprung); bei Überlappung gewinnt das vorderste Gebäude. Footprint aus manifest `tiles`.
2. **Grid 44×44** (Migration `021_larger_village_grid.sql`): Default + bestehende Villages von 30 auf 44 (CoC-großzügig, Platz zwischen Gebäuden + zum Weiterbauen).
3. **Footprint-bewusste Platzierung** (`VillageCanvas`): Sprite-Fußpunkt an der Footprint-Vorderecke `gridToScreen(gx+fw, gy+fh)` (füllt Grundfläche nach hinten), Tiefensortierung ebenso. emuclan neu eingerastet (`server/scripts/relayout_emuclan.js`, footprint-basiertes Packing, zentriert).
4. **Pan-Clamping** (`useWorldCamera`): Pan an der Grid-Bounding-Box begrenzt (EDGE_SLACK 30 %), kein Scrollen ins Leere; Village übergibt `viewport`+`world`.
5. **„Spitze" diagnostiziert & gefixt:** NICHT storage_gold (das ist korrekt die kompakte Trommel — verwechselt). Die hohe Spitze war der **prozedurale Vektor-Fallback** von `research_lab` + `hero_hall`, die im sockellosen Manifest fehlten. Fix: beide sockellos gerendert (`export_socketless.py`), Master gebaut, Manifest + `humanBuildingAssets` + Footprint (3×3) ergänzt → rendern nun als echte Blender-Gebäude (Labor mit Goldkolben / Säulentempel), keine Spitze. Dieselbe Spitze trat nur bei diesen zwei masterlosen Gebäuden auf.

**Offen/Hinweis:** relayout_emuclan ist ein einmaliges DB-Skript (kein generelles Server-Feature); footprint-basierte Platzierung/Kollision lebt weiterhin nur client-seitig (manifest). Emulator crashte während der Runde mehrfach unter Last (bekannt, swiftshader) — jeweils neu gestartet.

---

## S5 — emuclan als Clash-Referenz-Layout (Zonen-Generator) — 2026-08-01

**Ziel:** emuclan NICHT als Wegwerf-Testdorf, sondern als **Vorlage fürs Start-Dorf** neu aufbauen — als parametrisierbarer **Zonen-Generator** (nicht handplatziert), nach klassischem Clash-Schema.

**Neu:**
- **`tools/layout/emuclanLayout.ts`** — der Generator. Benannte Konstanten oben, **STRUKTUR vs. BALANCE getrennt**:
  - `BALANCE` (am fertigen Kampf nachjustierbar): `townHallCenter`, Verteidiger-Roster, Lager-/Held-Roster, `wallRadius`/`wallStep`, Reichweiten aus `game-config.json` (`DEFENSE_RANGE_TILES`, watchtower 6 / cannon 7 — **einzige Quelle**).
  - `ZONES` (Geometrie/Spacing, frei tunebar): Radien + Winkel je Ring.
  - **Zonen:** Kern (ummauert) = town_hall zentral · Verteidigung an den 4 Ecken (vorn Kanonen, hinten Wachtürme) · Lager auf den sichtbaren Kantenmitten · clan_castle/hero_hall/research_lab als Front-Trio „direkt am Kern". **Mauer** = EIN geschlossener Manhattan-Diamant (Screen-Rechteck), Radius 12, Schritt 2 (2×2-Segmente kante-an-kante, kein Loch, keine Selbst-Kollision). **Produktion** (gold_mine ×2, lumber_camp, quarry, barracks) als Ressourcen-Puffer AUSSERHALB der Mauer.
- **Abstände nach opaker Sprite-Box, NICHT Footprint:** `tools/layout/spriteMetrics.ts` misst pro Typ die tatsächliche opake Silhouette aus **`spriteContentBox.ts`** (dieselbe Box wie S3-Clamp) × `buildingDisplayScale` × `buildingDisplayWidth`, verankert am Footprint-**Zentrum** (exakt wie VillageCanvas). Footprints kommen aus der **manifest.json** — **die veraltete FOOT-Tabelle (gold_mine 4 / research_lab 3 aus der Zeit vor S4) ist ersatzlos entfallen.**
- **Verifikation im Generator (CLI `npx tsx tools/layout/emuclanLayout.ts`):** (1) **Sichtbarkeit** je Gebäude per Raster-Sampling der opaken Box gegen weiter vorne gezeichnete Gebäude (min. 69 %, hohes Rathaus verdeckt nichts Wichtiges); (2) **Footprint-Kollision** (harte Spiellogik-Regel) = **0**; (3) **Reichweiten-Deckung** im Mauer-Diamant = **313/313, kein totes Feld**, Kanonen an gegenüberliegenden Achsen decken alle Grid-Ecken.
- **DB-Applier `server/scripts/relayout_emuclan.ts`** (ersetzt die alte `.js`): nutzt den Generator als einzige Quelle, sichert den Ist-Zustand, baut emuclan in einer Transaktion neu auf (Level je Typ erhalten, wo vorhanden), verifiziert aus der DB. **emuclan: 15 → 40 Gebäude, 0 DB-Kollisionen** (clan_castle L3 / storage_gold L5 erhalten).
- **Render-Harness `tools/harness/emuclan_village.ts`** (`overview` | `ranges`): zeichnet den Generator-Output 1:1 wie VillageCanvas. Belege: `design/harness/emuclan_overview_v10.png` (Layout) + `emuclan_ranges_v10.png` (4 überlappende Reichweiten-Ellipsen, kein totes Feld).

**Nachjustieren (später, am Kampf):** Zahlen in `BALANCE`/`ZONES` oben im Generator ändern → `npx tsx tools/harness/emuclan_village.ts overview` (Bild) + `npx tsx server/scripts/relayout_emuclan.ts` (DB). Der Generator lehnt ein Layout mit Footprint-Kollision ab.

**Portable Test-DB in dieser Runde gestartet** (`vw_pgtest`, :55432) — läuft ggf. noch.
