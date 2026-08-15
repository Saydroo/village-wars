# Village Wars

Mobiles Aufbau- & Echtzeit-PvP-Strategiespiel (Clash-of-Clans- × Age-of-Empires-Prinzip).
Monorepo mit Expo-App, Node.js-Backend, PostgreSQL und Redis.

> **Status:** Phase 1 (Fundament) implementiert. Siehe [Roadmap](#roadmap).

Die vollständige Spezifikation steht in [`BRIEFING.md`](BRIEFING.md). **Alle Zahlenwerte
(Kosten, Zeiten, Kampfwerte, Boni) leben ausschließlich in
[`server/config/game-config.json`](server/config/game-config.json)** — niemals hartcodiert.

---

## Repo-Struktur

```
village-wars/
├── apps/mobile/        # Expo / React Native App (Skia, Zustand, React Navigation)
├── packages/shared/    # Geteilte TypeScript-Typen & Zod-Validierung
├── server/             # Express REST-API, PostgreSQL, Redis, JWT/OAuth
│   └── config/game-config.json   # EINZIGE Quelle aller Zahlenwerte
└── docs/
```

npm-Workspaces verbinden die Pakete; `@village-wars/shared` wird von Backend und App genutzt.

---

## Voraussetzungen

| Tool | Version | Zweck |
|---|---|---|
| Node.js | ≥ 20 | Backend & Tooling |
| npm | ≥ 9 | Workspaces |
| PostgreSQL | ≥ 14 | Persistente Datenbank |
| Redis | ≥ 6 | Cache/Session/Matchmaking (ab Phase 3 zwingend) |
| Expo | via npx | Mobile-App starten |

> Hinweis: Auf diesem Entwicklungsrechner war **Node.js nicht installiert**. Installiere
> Node 20+ (https://nodejs.org), bevor du die Befehle unten ausführst.

---

## Setup

### 1. Abhängigkeiten installieren

```bash
# Im Repo-Root (installiert alle Workspaces)
npm install
```

Für die Mobile-App empfiehlt Expo, native Versionen exakt abzugleichen:

```bash
cd apps/mobile && npx expo install
```

### 2. Umgebungsvariablen

```bash
# Backend
cp server/.env.example server/.env
# Mobile
cp apps/mobile/.env.example apps/mobile/.env
```

Trage in `server/.env` mindestens `DATABASE_URL` und (für Produktion) echte
`JWT_*`-Secrets ein. OAuth funktioniert erst mit gültiger `GOOGLE_CLIENT_ID` /
`APPLE_CLIENT_ID`.

### 3. Datenbank anlegen & migrieren

```bash
# Datenbank erstellen (Beispiel)
createdb village_wars

# Migrationen anwenden (legt alle Tabellen aus Abschnitt 3 an)
npm run migrate
# Status ansehen
npm run migrate:status -w @village-wars/server
```

### 4. Backend starten

```bash
npm run dev:server      # mit Auto-Reload (tsx watch)
# oder
npm run start:server
```

Health-Check: `GET http://localhost:4000/api/health`
Config:       `GET http://localhost:4000/api/config`

### 5. Mobile-App starten

```bash
cd apps/mobile
npm start               # Expo Dev Server (QR-Code für Expo Go)
```

Die App lädt beim Start `GET /api/config` und zeigt Verbindungsstatus + Config-Eckdaten.
Auf einem echten Gerät muss `EXPO_PUBLIC_API_URL` auf die LAN-IP des Backends zeigen
(z. B. `http://192.168.x.y:4000`), nicht `localhost`.

---

## Umgebungsvariablen (Backend)

| Variable | Default | Beschreibung |
|---|---|---|
| `NODE_ENV` | `development` | In `production` sind JWT-Secrets Pflicht |
| `PORT` | `4000` | HTTP-Port |
| `CORS_ORIGIN` | `*` | Erlaubte Origins (Komma-getrennt) |
| `DATABASE_URL` | — | PostgreSQL-Connection-String (Vorrang vor `PG*`) |
| `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` | — | Alternative zu `DATABASE_URL` |
| `REDIS_URL` | `redis://localhost:6379` | Redis-Verbindung |
| `JWT_ACCESS_SECRET` | dev-Fallback | Signatur Access-Token |
| `JWT_REFRESH_SECRET` | dev-Fallback | Signatur Refresh-Token |
| `JWT_ACCESS_EXPIRES` | `15m` | Gültigkeit Access-Token |
| `JWT_REFRESH_EXPIRES` | `30d` | Gültigkeit Refresh-Token |
| `GOOGLE_CLIENT_ID` | — | Erlaubte Google-Audience(s) |
| `APPLE_CLIENT_ID` | — | Erlaubte Apple-Audience(s) |

---

## API — in Phase 1 implementiert

| Methode | Pfad | Auth | Zweck |
|---|---|---|---|
| GET | `/api/health` | — | Status (DB/Redis/Config-Version) |
| GET | `/api/config` | — | Komplette game-config.json |
| POST | `/api/auth/register` | — | E-Mail-Registrierung (legt Dorf + Rathaus an) |
| POST | `/api/auth/login` | — | E-Mail/Benutzername + Passwort |
| POST | `/api/auth/oauth/google` | — | Google-Sign-In (Token-Verifizierung) |
| POST | `/api/auth/oauth/apple` | — | Apple-Sign-In (Token-Verifizierung) |
| POST | `/api/auth/refresh` | — | Neues Token-Paar aus Refresh-Token |
| GET | `/api/player/me` | ✔ | Eigenes Spielerprofil |
| PATCH | `/api/player/faction` | ✔ | Fraktionswechsel (Kosten aus Config) |
| GET | `/api/village/:playerId` | — | Dorf + Gebäude |
| POST | `/api/village/buildings` | ✔ | Gebäude platzieren |
| PATCH | `/api/village/buildings/:id/move` | ✔ | Gebäude verschieben |
| DELETE | `/api/village/buildings/:id` | ✔ | Gebäude entfernen |
| POST | `/api/village/buildings/:id/upgrade/start` | ✔ | Upgrade starten (Kosten + Timer, Fraktions-Mod.) |
| POST | `/api/village/buildings/:id/upgrade/skip` | ✔ | Upgrade per Goldbarren sofort abschließen |

`GET /api/player/me` verrechnet beim Aufruf die passive Produktion (zeitbasiert) und
liefert zusätzlich `capacities` (3× Lagerkapazität je Ressource).

### Beispiel (curl)

```bash
# Registrieren
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"held","email":"held@example.com","password":"geheim123","faction":"humans"}'

# Profil abrufen (Token aus der Registrierungsantwort)
curl http://localhost:4000/api/player/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## Architektur-Hinweise

- **game-config.json ist die einzige Zahlenquelle.** Das Backend lädt sie beim Start
  (`server/src/gameConfig.ts`) und liefert sie über `GET /api/config`; die App cached sie
  im Zustand-Store. Fraktions-Modifikatoren werden zentral angewandt.
- **Migrationen:** schlichter SQL-Runner (`server/src/db/migrate.ts`), `.sql`-Dateien in
  `server/src/db/migrations`, jede in einer Transaktion, vermerkt in `schema_migrations`.
- **Zirkulärer FK** `players.clan_id ↔ clans.leader_id` wird per `ALTER TABLE` nach dem
  Anlegen der Tabellen ergänzt.

### Bewusste Ergänzungen ggü. dem Briefing

1. **`players.password_hash`** — im Schema (Abschnitt 3) nicht enthalten, aber für
   `auth_provider='email'` (Registrierung/Login) notwendig. Bei OAuth bleibt es `NULL`.
2. **`faction_change.cost_bars` in game-config.json** — Abschnitt 5 fordert den
   Fraktionswechsel-Preis „in game-config.json konfigurierbar" (500 Goldbarren), der
   Appendix-JSON ließ das Feld aber weg. Ergänzt, statt den Wert zu hartcodieren.
3. **`economy` in game-config.json** (Phase 2) — `resource_cap_multiplier: 3` (Abschnitt 4:
   „Dreifache der Lagerkapazität") sowie die Grundkapazitäts-Regel. Ebenfalls aus der Spec,
   im Appendix nicht enthalten.
4. **`players.resources_updated_at`** (Migration 002) — Zeitstempel für die zeitbasierte
   Produktionsverrechnung (Ressourcen-Tick + Settle-on-Read).

> Kosten-/Timer-Logik für Gebäude (Upgrades, Bauzeit-Skip, Ressourcen-Tick) gehört zu
> **Phase 2** — in Phase 1 ist die Gebäude-CRUD bewusst rein persistierend (mit
> Freischalt-/Grid-Validierung).

---

## Nützliche Skripte

```bash
npm run typecheck                       # shared + server typprüfen
npm run dev:server                      # Backend (watch)
npm run migrate                         # Migrationen anwenden
npm run typecheck -w @village-wars/mobile   # Mobile typprüfen
```

---

## Roadmap

- [x] **Phase 1 — Fundament:** Monorepo, DB-Migrations, Auth (JWT + Apple/Google), `/api/config`, Player- & Village-CRUD.
- [x] **Phase 2 — Dorf:** Iso-Grid (Skia), Gebäude-Renderer mit Level-Progression (Tiers/Auren), Platzierung, zeitbasierter Ressourcen-Tick (Cron), Upgrades + Goldbarren-Skip, Fraktions-Modifikatoren. Frontend: `VillageScreen` (Canvas, Platzier-Leiste, Upgrade-Dialog).
- [ ] **Phase 3 — Kampf:** Matchmaking (Redis), Battle-Server (Socket.io), BattleScreen, Loot & Trophäen.
- [ ] **Phase 4 — Clans & Ranglisten:** Clan-System, Banner-Editor, Clan-Burg, Clan-Krieg, Ranglisten.
- [ ] **Phase 5 — Dungeon & Monetarisierung:** PvE-Dungeon (Cron), Shop/Skins, IAP, Saison-Reset.
- [ ] **Phase 6 — Grafik & Effekte:** Game-Juice-Schicht (Partikel, Screenshake, Auren, …).
```
