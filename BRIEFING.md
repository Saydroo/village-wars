# VILLAGE WARS — KOMPLETT-BRIEFING FÜR CLAUDE CODE
**Alles in einer Datei. Master-Spezifikation + Grafik/Effekte + komplette game-config.json**

---

## SO STARTEST DU DIE PROGRAMMIERUNG (Anleitung für dich, nicht für Claude Code)

1. Erstelle einen leeren Projektordner auf deinem Rechner, z.B. `village-wars`.
2. Speichere diese Datei dort als `BRIEFING.md` hinein.
3. Öffne Claude Code in diesem Ordner.
4. Gib nacheinander die unten stehenden Befehle ein. Jeweils abwarten bis Claude Code fertig ist, testen, dann den nächsten.

> Wichtig: Versuche nicht, alles mit einem einzigen Befehl bauen zu lassen. Das ist ein sehr großes Projekt (Echtzeit-Multiplayer, Zahlungen, Render-Engine). Eine einzige Anfrage würde unvollständig oder fehlerhaft. Die Phasen unten sind absichtlich klein gehalten, damit jede für sich lauffähig und testbar ist.

---

## DIE BEFEHLE FÜR CLAUDE CODE (der Reihe nach eingeben)

### Befehl 0 — Einlesen und Plan
```
Lies die komplette Datei BRIEFING.md sorgfältig durch. Das ist die vollständige Spezifikation für das Spiel Village Wars. Erstelle daraus zuerst nur die game-config.json (der vollständige Inhalt steht im Abschnitt "ANHANG: GAME-CONFIG.JSON" am Ende der Datei) und lege sie unter server/config/game-config.json ab. Dann gib mir eine kurze Bestätigung der Projektstruktur die du bauen wirst und welche Phasen es gibt. Baue noch keinen weiteren Code.
```

### Befehl 1 — Fundament (Phase 1)
```
Setze jetzt Phase 1 aus dem Briefing um: Monorepo-Grundgerüst mit Expo-App (apps/mobile) und Node.js-Backend (server). Richte PostgreSQL-Migrations für alle Tabellen aus Abschnitt 3 ein. Implementiere das Auth-System (JWT plus Apple- und Google-OAuth). Lade die game-config.json im Backend und stelle sie über GET /api/config bereit. Erstelle die Basis-API für Player und Village CRUD. Schreibe eine README mit Setup-Anweisungen (welche env-Variablen, wie starten). Halte alle Zahlenwerte ausschließlich in game-config.json, niemals hardcodiert.
```

### Befehl 2 — Dorf (Phase 2)
```
Setze Phase 2 um: das isometrische Grid-System mit react-native-skia (Koordinaten-Konvertierung und Rendering aus Abschnitt 15). Implementiere Gebäude-Platzierung per Drag and Drop auf dem Grid. Baue die Gebäude-Renderer für alle Typen mit der Level-Progression aus Abschnitt 13 (konstante Größe, nur Material, Details, Farbe und Leuchteffekte ändern sich pro Level, nie die Größe). Implementiere den Ressourcen-Tick als Cron-Job und das Upgrade-System mit Timer und Goldbarren-Skip. Wende die Fraktions-Modifikatoren bei allen Berechnungen an.
```

### Befehl 3 — Kampf (Phase 3)
```
Setze Phase 3 um: Matchmaking über eine Redis-Queue und Socket.io. Baue den Battle-Server mit Einheiten-Bewegung, Kampflogik und dem 5-Minuten-Timer. Implementiere den BattleScreen im Frontend (Einheiten deployen, Echtzeit-Updates über Socket.io). Implementiere die Loot-Berechnung (nur 20 Prozent Holz und Stein, niemals Gold oder Edelsteine) und das Trophäen-Delta aus Abschnitt 8.
```

### Befehl 4 — Clans & Ranglisten (Phase 4)
```
Setze Phase 4 um: das komplette Clan-System (erstellen, beitreten, verlassen, Banner-Baukasten-Editor, Tag-Validierung mit Profanity-Filter über das bad-words Package). Implementiere die Clan-Burg mit der Housing-Space-Logik aus Abschnitt 10. Baue Clan gegen Clan (Krieg-Matchmaking und Punkte-Aggregation). Implementiere beide Ranglisten (Solo dauerhaft, Clan saisonbasiert) mit Paginierung.
```

### Befehl 5 — Dungeon & Monetarisierung (Phase 5)
```
Setze Phase 5 um: den Dungeon-Cron-Job (öffnet Samstag 05:00 Europe/Berlin, schließt Sonntag 00:00 Europe/Berlin) mit PvE-Kampflogik (5 Wellen plus Endboss) und Belohnungen aus Abschnitt 9. Baue den Shop mit dem Skin-System (Galerie, Kauf, Anwenden, rein kosmetisch). Implementiere die In-App-Purchase-Integration für Apple und Google inklusive Beleg-Verifizierung und Goldbarren-Gutschrift. Implementiere den Saison-Reset-Cron alle 8 Wochen mit Goldbarren-Ausschüttung an die Top 5 Clans.
```

### Befehl 6 — Grafik & Effekte (Phase 6)
```
Setze jetzt Phase 6 um, die Grafik- und Effekt-Schicht aus dem Abschnitt "GRAFIK, ANIMATION & GAME JUICE". Implementiere in dieser Reihenfolge: Knopf-Druck-Feedback, Floating Combat Text, Hit-Flash und Screenshake, das Partikelsystem mit den Presets, Squash and Stretch, die Sieg- und Niederlage-Sequenzen, Idle-Atmung und wehende Fahnen, die magische Aura-Progression für Level 7 bis 10, Bildschirmübergänge und Sound-Cues. Halte die Performance-Leitplanken ein (maximal 200 Partikel, 60 FPS Ziel, eine Einstellung "Effekte reduzieren"). Effekte dürfen die Balance nicht beeinflussen.
```

### Nützliche Zusatz-Befehle (bei Bedarf)
```
Schreibe Tests für die Kampflogik und die Loot-Berechnung.
```
```
Es gibt einen Fehler: [beschreibe was nicht funktioniert]. Finde und behebe die Ursache.
```
```
Ändere den Wert X in game-config.json auf Y und stelle sicher dass nichts hardcodiert ist.
```

### Goldene Regeln für die Zusammenarbeit mit Claude Code
- Nach jeder Phase: starten, testen, erst dann weiter. Nicht blind durchlaufen lassen.
- Wenn etwas nicht passt, beschreibe konkret was du erwartest. Claude Code kann gezielt nachbessern.
- Balancing-Werte (Kosten, Zeiten, Boni) ändert man immer in game-config.json, nie im Code.
- Bei Grafik-Feedback sei konkret: "der Upgrade-Effekt soll länger leuchten" statt "mach es cooler".

---
---

# TEIL 1 — MASTER-SPEZIFIKATION


# Village Wars — Master-Briefing für Claude Code
**Version 1.0 — Vollständige Implementierungsspezifikation**

> Dieses Dokument ist die einzige Quelle der Wahrheit für die komplette Implementierung von Village Wars. Es enthält alle Designentscheidungen, Zahlenwerte, Architekturvorgaben und visuellen Spezifikationen. Alle Zahlenwerte die im Code benötigt werden, stehen zusätzlich in `game-config.json`.

---

## INHALTSVERZEICHNIS

1. Spielkonzept
2. Tech-Stack & Projektstruktur
3. Datenbank-Schema
4. Ressourcensystem
5. Fraktionen & Balance
6. Gebäude-System (mit Kosten, Stufen, visuelle Progression)
7. Einheiten-Roster (mit Stats, Housing Space, visuelle Progression)
8. Kampfsystem (PvP)
9. Dungeon-System (PvE)
10. Clan-System
11. Ranglisten
12. Goldbarren & Monetarisierung
13. Visuelle Progressions-Logik (WICHTIG)
14. Backend-Architektur
15. Frontend-Architektur
16. Implementierungs-Reihenfolge

---

## 1. SPIELKONZEPT

Village Wars ist ein mobiles Aufbau- und Strategiespiel für iOS und Android. Spieler wählen eine von 7 Fraktionen, bauen ein Dorf auf einem isometrischen Grid aus, erwirtschaften Ressourcen passiv über Produktionsgebäude, kämpfen in Echtzeit-PvP-Duellen gegen andere Online-Spieler und klettern in zwei getrennten Ranglisten (Solo & Clan) nach oben.

**Genre-Prinzip:** Clash of Clans + Age of Empires — Aufbau + asynchrone/synchrone PvP-Kämpfe. Keine geschützten Namen, Grafiken oder Mechaniken übernommen.

**Kernprinzipien:**
- Kein Pay-to-Win. Goldbarren (Premium-Währung) kaufen ausschließlich Skins und Bauzeit-Skips.
- Nur Online-Spieler kämpfen gegeneinander, nie offline/AFK-Spieler.
- Jede Fraktion hat einen klaren Vor- und Nachteil — keine ist in Summe stärker.
- Alle Gebäude und Einheiten verändern ihr Aussehen mit jedem Level drastisch (nicht die Größe, sondern Materialien, Details, Leuchteffekte, Ausrüstung).

---

## 2. TECH-STACK & PROJEKTSTRUKTUR

### Frontend
- **Framework:** React Native mit Expo
- **Rendering:** `@shopify/react-native-skia` — isometrisches 2D/2.5D (wie Clash of Clans, kein echtes 3D)
- **State:** Zustand oder Redux Toolkit
- **Navigation:** React Navigation v6

### Backend
- **API:** Node.js + Express (REST)
- **Echtzeit:** Socket.io (PvP-Kämpfe, Matchmaking)
- **Datenbank persistent:** PostgreSQL
- **Datenbank Cache/Session:** Redis
- **Auth:** JWT + OAuth (Apple Sign-In / Google Sign-In)
- **Jobs:** node-cron (Dungeon-Fenster, Saison-Reset)
- **Payment:** Apple In-App-Purchase API / Google Play Billing API

### Projektstruktur
```
village-wars/
├── apps/
│   └── mobile/                    # React Native Expo App
│       ├── src/
│       │   ├── screens/           # Hauptbildschirme
│       │   │   ├── VillageScreen.tsx
│       │   │   ├── BattleScreen.tsx
│       │   │   ├── ClanScreen.tsx
│       │   │   ├── LeaderboardScreen.tsx
│       │   │   ├── DungeonScreen.tsx
│       │   │   └── ShopScreen.tsx
│       │   ├── components/
│       │   │   ├── village/       # Gebäude, Grid, Drag&Drop
│       │   │   ├── battle/        # Kampf-UI, HP-Bars, Timer
│       │   │   ├── units/         # Einheiten-Renderer
│       │   │   └── ui/            # Shared UI-Komponenten
│       │   ├── rendering/         # Skia-Zeichenlogik
│       │   │   ├── buildings/     # Eine Datei pro Gebäudetyp
│       │   │   ├── units/         # Eine Datei pro Einheitentyp
│       │   │   └── effects/       # Partikel, Auren, Gloweffekte
│       │   ├── store/             # State Management
│       │   ├── api/               # API-Client
│       │   └── config/
│       │       └── game-config.ts # Importiert game-config.json
│       └── assets/
├── packages/
│   └── shared/                    # Geteilte Typen & Validierung
├── server/
│   ├── src/
│   │   ├── routes/                # REST-Endpoints
│   │   ├── sockets/               # Socket.io Handler
│   │   ├── services/              # Business-Logik
│   │   ├── jobs/                  # Cron-Jobs
│   │   ├── db/                    # PostgreSQL Migrations & Queries
│   │   └── middleware/            # Auth, Rate-Limiting
│   └── config/
│       └── game-config.json       # EINZIGE Quelle aller Zahlenwerte
└── docs/
```

---

## 3. DATENBANK-SCHEMA (PostgreSQL)

```sql
-- Spieler
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  auth_provider VARCHAR(20) NOT NULL, -- 'apple' | 'google' | 'email'
  auth_provider_id VARCHAR(255),
  faction VARCHAR(20) NOT NULL,        -- 'humans'|'fishfolk'|'giants'|'dwarves'|'elves'|'undead'|'orcs'
  village_level INT DEFAULT 1,
  trophies INT DEFAULT 0,
  gold_bars INT DEFAULT 0,             -- Premium-Währung
  wood BIGINT DEFAULT 500,
  stone BIGINT DEFAULT 300,
  gold BIGINT DEFAULT 0,
  gems BIGINT DEFAULT 0,
  clan_id UUID REFERENCES clans(id),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dörfer (Grid-Layout)
CREATE TABLE villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  grid_width INT DEFAULT 30,
  grid_height INT DEFAULT 30,
  layout JSONB DEFAULT '[]',           -- Array von {building_id, grid_x, grid_y}
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gebäude-Instanzen
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  building_type VARCHAR(50) NOT NULL,  -- z.B. 'lumber_camp', 'watchtower'
  level INT DEFAULT 1,
  grid_x INT NOT NULL,
  grid_y INT NOT NULL,
  upgrade_started_at TIMESTAMPTZ,
  upgrade_finish_at TIMESTAMPTZ,
  is_upgrading BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Einheiten (Armee)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  unit_type VARCHAR(50) NOT NULL,
  level INT DEFAULT 1,
  quantity INT DEFAULT 0,
  training_finish_at TIMESTAMPTZ
);

-- Clans
CREATE TABLE clans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  tag VARCHAR(5) UNIQUE NOT NULL,      -- 3-5 Zeichen, moderiert
  banner JSONB NOT NULL,               -- {shape, colors, symbol} Baukasten
  leader_id UUID REFERENCES players(id),
  season_points INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clan-Mitglieder
CREATE TABLE clan_members (
  clan_id UUID REFERENCES clans(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',   -- 'leader' | 'co_leader' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clan_id, player_id)
);

-- Clan-Burg-Verteidiger (stationierte Einheiten)
CREATE TABLE clan_castle_defenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  unit_type VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  donated_by UUID REFERENCES players(id)
);

-- PvP-Kämpfe
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID REFERENCES players(id),
  defender_id UUID REFERENCES players(id),
  mode VARCHAR(20) NOT NULL,           -- 'solo' | 'clan_war'
  clan_war_id UUID REFERENCES clan_wars(id),
  result VARCHAR(10),                  -- 'attacker_win' | 'defender_win' | 'draw'
  attacker_destruction_pct INT DEFAULT 0,
  defender_destruction_pct INT DEFAULT 0,
  loot_wood BIGINT DEFAULT 0,
  loot_stone BIGINT DEFAULT 0,
  trophies_change INT DEFAULT 0,
  duration_seconds INT,
  replay JSONB,                        -- Kampf-Replay-Daten
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Clan-Kriege
CREATE TABLE clan_wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_a_id UUID REFERENCES clans(id),
  clan_b_id UUID REFERENCES clans(id),
  clan_a_points INT DEFAULT 0,
  clan_b_points INT DEFAULT 0,
  winner_clan_id UUID REFERENCES clans(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Solo-Rangliste (Snapshot für Season)
CREATE TABLE leaderboard_solo (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  trophies INT NOT NULL,
  rank INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id)
);

-- Clan-Rangliste (Season-basiert)
CREATE TABLE leaderboard_clan (
  clan_id UUID REFERENCES clans(id) ON DELETE CASCADE,
  season_points INT NOT NULL,
  rank INT,
  season_number INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clan_id, season_number)
);

-- Dungeon-Runs
CREATE TABLE dungeon_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  season_week DATE NOT NULL,
  waves_completed INT DEFAULT 0,
  boss_defeated BOOLEAN DEFAULT FALSE,
  gold_earned BIGINT DEFAULT 0,
  gems_earned BIGINT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Skins
CREATE TABLE skins (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  target_type VARCHAR(20) NOT NULL,    -- 'unit' | 'building' | 'village_theme'
  target_id VARCHAR(50) NOT NULL,
  rarity VARCHAR(20) NOT NULL,         -- 'common' | 'rare'
  price_bars INT NOT NULL,
  preview_data JSONB                   -- Render-Parameter für Vorschau
);

-- Spieler-Skins (Besitz)
CREATE TABLE player_skins (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  skin_id VARCHAR(50) REFERENCES skins(id),
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, skin_id)
);

-- Saison-Tracking
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  season_number INT UNIQUE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Indices
CREATE INDEX idx_buildings_player ON buildings(player_id);
CREATE INDEX idx_battles_attacker ON battles(attacker_id);
CREATE INDEX idx_battles_defender ON battles(defender_id);
CREATE INDEX idx_leaderboard_solo_trophies ON leaderboard_solo(trophies DESC);
CREATE INDEX idx_leaderboard_clan_season ON leaderboard_clan(season_number, season_points DESC);
```

---

## 4. RESSOURCENSYSTEM

| Ressource | Typ | Passiv | PvP-plünderbar | Quellen |
|---|---|---|---|---|
| Holz | Basis | Ja | **Ja — 20% bei Niederlage** | Holzfällerlager |
| Stein | Basis | Ja | **Ja — 20% bei Niederlage** | Steinbruch |
| Gold | Selten | Ja (langsam) | **Nein** | Goldmine, Dungeon |
| Edelsteine | Sehr selten | Nein | **Nein** | Dungeon (exklusiv) |
| Goldbarren | Premium | Nein | **Nein** | Echtgeld, Top-5-Clan-Belohnung |

**Loot-Logik PvP:** Sieger erhält 20% des aktuellen Holz- und Steinvorrats des Verlierers. Gold und Edelsteine sind bewusst ausgenommen, damit der Dungeon seinen einzigartigen Wert behält.

**Ressourcen-Cap:** Spieler können maximal das Dreifache ihrer aktuellen Lagerkapazität besitzen. Was über das Cap geht, verfällt.

---

## 5. FRAKTIONEN & BALANCE

**Baseline:** Menschen = 1.0 auf allen Multiplikatoren. Alle anderen Fraktionen weichen davon ab.

**Balance-Regel:** Jede Fraktion hat genau einen Bonus (+10% bis +20%) und genau einen Malus (-10% bis -20%). Keine Fraktion ist in der Summe der Vor/Nachteile stärker oder schwächer.

### Fraktions-Modifikatoren (exakte Werte)

```json
"humans": {
  "build_time_multiplier": 1.0,
  "build_cost_multiplier": 1.0,
  "upgrade_cost_multiplier": 1.0,
  "resource_production_multiplier": 1.0,
  "wall_hp_multiplier": 1.0,
  "building_hp_multiplier": 1.0,
  "unit_hp_multiplier": 1.0,
  "unit_damage_multiplier": 1.0,
  "melee_damage_multiplier": 1.0,
  "ranged_damage_multiplier": 1.0,
  "unit_speed_multiplier": 1.0,
  "unit_cost_multiplier": 1.0,
  "defense_building_cost_multiplier": 1.0
},
"fishfolk": {
  "build_time_multiplier": 1.0,
  "wall_hp_multiplier": 0.85,
  "resource_production_multiplier_water_adjacent": 1.15
},
"giants": {
  "build_time_multiplier": 1.20,
  "upgrade_cost_multiplier": 1.15,
  "unit_hp_multiplier": 1.20,
  "unit_damage_multiplier": 1.15
},
"dwarves": {
  "upgrade_cost_multiplier": 0.85,
  "resource_production_multiplier_stone": 1.15,
  "resource_production_multiplier_gold": 1.15,
  "ranged_damage_multiplier": 0.80
},
"elves": {
  "building_hp_multiplier": 0.85,
  "unit_speed_multiplier": 1.20,
  "attack_speed_multiplier": 1.15
},
"undead": {
  "resource_production_multiplier": 0.85,
  "unit_cost_multiplier": 0.85
},
"orcs": {
  "defense_building_cost_multiplier": 1.20,
  "melee_damage_multiplier": 1.20
}
```

### Fraktionswahl
- Einmalig bei Account-Erstellung
- Späterer Wechsel: 500 Goldbarren (in game-config.json konfigurierbar)

### Exklusiv-Gebäude pro Fraktion

| Fraktion | Gebäude | TH-Level | Funktion |
|---|---|---|---|
| Menschen | Handelsposten | 5 | Tauscht Holz/Stein zu festem Kurs |
| Fischmenschen | Gezeitenbrunnen | 4 | +15% Ertrag wasserangrenzender Gebäude |
| Fischmenschen | Kanalschleuse | 6 | Verlangsamt Einheiten auf Wasser-Tiles |
| Riesen | Felsbrocken-Grube | 5 | Effizienter Steinabbau |
| Zwerge | Tiefer Stollen | 4 | Stein mit Fraktionsbonus |
| Zwerge | Schmiede | 5 | Zusatzrabatt auf Verteidigungsupgrades |
| Elfen | Baumwipfel-Ausguck | 5 | Erhöht Reichweite benachbarter Verteidigungsgebäude |
| Untote | Knochenhof | 5 | Zusatzrabatt auf Einheitenkosten |
| Orks | Kriegszelt | 5 | Kürzere Rekrutierungszeit Nahkampf |

---

## 6. GEBÄUDE-SYSTEM

### Gemeinsame Gebäude (alle Fraktionen)

#### Rathaus (Town Hall)
- Freigeschaltet ab: Level 1
- Max Level: 10
- Schaltet alle anderen Gebäude und Einheiten progressiv frei
- Level 5 schaltet Clans frei

| Level | Holz | Stein | Gold | Bauzeit (Min) |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 |
| 2 | 500 | 300 | 0 | 15 |
| 3 | 1.500 | 1.000 | 0 | 60 |
| 4 | 4.000 | 2.800 | 0 | 240 |
| 5 | 9.000 | 6.500 | 0 | 720 |
| 6 | 18.000 | 13.000 | 1.000 | 1.440 |
| 7 | 32.000 | 24.000 | 3.000 | 2.880 |
| 8 | 55.000 | 42.000 | 7.000 | 4.320 |
| 9 | 90.000 | 70.000 | 14.000 | 7.200 |
| 10 | 140.000 | 110.000 | 25.000 | 10.080 |

#### Holzfällerlager
- Freigeschaltet: TH 1 | Max: Level 10
- Basis-Produktion: 200 Holz/Stunde | Wachstum: +18%/Level

| Level | Holz | Bauzeit (Min) | Produktion/h |
|---|---|---|---|
| 1 | 0 | 0 | 200 |
| 2 | 300 | 10 | 236 |
| 3 | 700 | 30 | 278 |
| 4 | 1.500 | 90 | 328 |
| 5 | 3.000 | 240 | 387 |
| 6 | 6.000 | 600 | 457 |
| 7 | 11.000 | 1.200 | 539 |
| 8 | 19.000 | 2.160 | 636 |
| 9 | 30.000 | 3.600 | 750 |
| 10 | 45.000 | 5.760 | 885 |

#### Steinbruch
- Identische Kostenstruktur wie Holzfällerlager
- Basis-Produktion: 150 Stein/Stunde | Wachstum: +18%/Level

#### Goldmine
- Freigeschaltet: TH 3 | Max: Level 8
- Basis-Produktion: 25 Gold/Stunde | Wachstum: +20%/Level

| Level | Holz | Stein | Bauzeit (Min) | Produktion/h |
|---|---|---|---|---|
| 1 | 2.000 | 1.000 | 120 | 25 |
| 2 | 4.000 | 2.500 | 360 | 30 |
| 3 | 8.000 | 5.000 | 720 | 36 |
| 4 | 15.000 | 9.000 | 1.440 | 43 |
| 5 | 25.000 | 16.000 | 2.880 | 52 |
| 6 | 40.000 | 26.000 | 4.320 | 62 |
| 7 | 60.000 | 40.000 | 5.760 | 74 |
| 8 | 85.000 | 58.000 | 7.200 | 89 |

#### Lager (Holz / Stein / Gold)
- Holzlager: TH 1, Max 10, Startkapazität 2.000, +35%/Level
- Steinlager: TH 1, Max 10, Startkapazität 1.500, +35%/Level
- Goldtresor: TH 3, Max 8, Startkapazität 500, +35%/Level

#### Mauer
- TH 2 | Max: Level 10 | Basis-HP: 300 | +30%/Level
- Kosten: 50 Stein/Segment (Level 1), steigend

#### Kaserne
- TH 1 | Max: Level 6
- Schaltet Einheiten-Rekrutierung frei

#### Wachturm (Verteidigung)
- TH 2 | Max: Level 8
- Basis: 12 DPS, 400 HP, 6 Tiles Reichweite

#### Kanone (Verteidigung)
- TH 4 | Max: Level 8
- Basis: 22 DPS, 500 HP, 7 Tiles Reichweite

#### Clan-Burg
- TH 5 | Max: Level 5

| Level | Housing Space | Holz | Stein | Gold | Bauzeit (Min) |
|---|---|---|---|---|---|
| 1 | 10 | 2.000 | 1.500 | 0 | 180 |
| 2 | 15 | 5.000 | 3.500 | 0 | 480 |
| 3 | 20 | 10.000 | 7.500 | 500 | 1.440 |
| 4 | 25 | 18.000 | 14.000 | 1.200 | 2.880 |
| 5 | 30 | 30.000 | 24.000 | 2.500 | 5.760 |

---

## 7. EINHEITEN-ROSTER

**Housing Space:** Stellplatz-Verbrauch in Clan-Burg und Armeelager. Schwache Einheiten = 1–2, starke = 4–8.

### Gemeinsame Einheiten (alle Fraktionen)

| Einheit | TH | Housing | HP | DPS | Geschwindigkeit | Kosten | Trainingszeit |
|---|---|---|---|---|---|---|---|
| Milizionär | 1 | 1 | 60 | 8 | Mittel | 30 Holz | 20s |
| Bogenschütze | 2 | 1 | 40 | 14 | Mittel | 50 Holz | 30s |
| Ritter | 4 | 3 | 180 | 16 | Langsam | 120 Holz, 40 Stein | 90s |
| Katapult | 6 | 6 | 120 | 35 | Sehr langsam | 300 Holz, 150 Stein | 240s |
| Heiler | 7 | 4 | 70 | — | Mittel | 200 Holz, 20 Gold | 180s |

### Exklusiv-Einheiten pro Fraktion

#### Menschen
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Hauptmann | 8 | 5 | 260 | 22 | 250 Holz, 100 Stein, 30 Gold | 150s | Moral-Aura: +8% Schaden für alle nahestehenden Einheiten |

#### Fischmenschen
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Gezeitenkämpfer | 5 | 3 | 150 | 17 | 130 Holz, 30 Stein | 100s | Volle Geschwindigkeit auf Wasser-Tiles |
| Netzwerfer | 7 | 4 | 80 | 10 | 220 Holz, 15 Gold | 160s | -25% Geschwindigkeit auf Gegner bei Treffer |

#### Riesen
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Steinriese | 6 | 8 | 420 | 30 | 400 Holz, 250 Stein | 300s | Tank, zerstört Mauern doppelt so schnell |
| Felswerfer | 8 | 7 | 280 | 38 | 350 Holz, 300 Stein, 40 Gold | 280s | Flächenschaden 2 Tiles Radius |

#### Zwerge
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Axtzwerg | 4 | 2 | 110 | 15 | 80 Holz, 30 Stein | 60s | Gepanzert, nimmt 10% weniger Schaden |
| Runenschmied | 7 | 4 | 90 | — | 180 Holz, 35 Gold | 170s | +15% HP für nahestehende Einheiten (Buff, 8s Dauer) |

#### Elfen
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Waldschütze | 4 | 2 | 55 | 18 | 90 Holz | 50s | Fernkampf 5 Tiles, schnell |
| Klingentänzer | 6 | 3 | 95 | 24 | 160 Holz, 10 Gold | 110s | Sehr schnell, springt über Mauern |

#### Untote
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Skelettsoldat | 3 | 1 | 50 | 9 | 20 Holz | 18s | Regeneriert 2 HP/s (nicht bei Feuerschaden) |
| Geist | 7 | 4 | 130 | 20 | 150 Holz, 15 Gold | 130s | 10% Dodge-Chance (Phasing) |

#### Orks
| Einheit | TH | Housing | HP | DPS | Kosten | Zeit | Besonderheit |
|---|---|---|---|---|---|---|---|
| Ork-Schläger | 3 | 2 | 90 | 17 | 60 Holz, 10 Stein | 40s | Aggressiv, priorisiert Gebäude |
| Berserker | 6 | 4 | 140 | 32 | 200 Holz, 60 Stein | 140s | +20% Schaden wenn HP < 50% (Rage) |

---

## 8. KAMPFSYSTEM (PvP)

### Grundregeln
- Ausschließlich Online-Spieler kämpfen gegeneinander
- Zeitlimit: **300 Sekunden (5 Minuten)** pro Kampf
- Bei Zeitablauf gewinnt, wer mehr Prozent des gegnerischen Dorfes zerstört hat
- Bei Gleichstand: Unentschieden, keine Trophäen-Änderung

### Loot-Berechnung
```
loot_wood = floor(defender.wood * 0.20)
loot_stone = floor(defender.stone * 0.20)
gold: NICHT plünderbar
gems: NICHT plünderbar
```

### Trophäen
```
base_win = +28
base_loss = -22
// Anpassung nach Elo-Differenz:
// Sieg gegen stärkeren Gegner: bis +35
// Sieg gegen schwächeren Gegner: bis +18
// Niederlage gegen stärkeren: -14
// Niederlage gegen schwächeren: -30
```

### Matchmaking
- Matchmaking-Queue via Redis
- Toleranz: ±100 Trophäen (expandiert nach 30s auf ±200, nach 60s auf ±500)
- Kein Match nach 90s: Bot-Gegner mit gespeichertem Layout

### Modi
1. **Solo 1v1:** Einzelner Spieler greift gegnerisches Dorf an
2. **Clan vs. Clan:** Summe paralleler 1v1-Duelle, Clan-Punkte aus Summe der Zerstörung

### Socket.io Events (Battle)
```
Client → Server:
  battle:deploy_unit    { unit_type, x, y }
  battle:surrender

Server → Client:
  battle:state_update   { units, buildings, timer, destruction_pct }
  battle:unit_died      { unit_id }
  battle:building_hit   { building_id, hp_remaining }
  battle:ended          { result, loot, trophies_change }
```

---

## 9. DUNGEON-SYSTEM (PvE)

### Zeitfenster
- **Öffnet:** Samstag 05:00 Uhr CET
- **Schließt:** Sonntag 00:00 Uhr CET
- **Dauer:** ca. 19 Stunden, wöchentlich
- Cronjob: node-cron `0 5 * * 6` (öffnen) und `0 0 * * 0` (schließen)

### Struktur
- 5 Wellen NPC-Horden (jede Welle stärker als die vorherige)
- 1 Abschluss-Endboss nach Welle 5
- Spieler kann zwischen Wellen kurz pausieren

### Belohnungen
| Ergebnis | Gold | Edelsteine |
|---|---|---|
| Wellen 1–2 | 50–100 | 0 |
| Wellen 3–4 | 100–200 | 1–2 |
| Alle 5 Wellen | 200–350 | 3–7 |
| Alle 5 + Boss | 300–400 | 5–10 |

**Keine Goldbarren aus Dungeons.** Goldbarren bleiben exklusiv an Echtgeld-Kauf und Top-5-Clan-Belohnung.

---

## 10. CLAN-SYSTEM

### Voraussetzungen
- Clan erstellen / beitreten: TH Level 5

### Parameter
- Max. Mitglieder: **50**
- Tag: 3–5 Zeichen, Profanity-Filter erforderlich (z.B. npm `bad-words`)
- Banner: Baukasten-System (Form + Farbe + Symbol), kein Bild-Upload

### Saison
- Reset alle **8 Wochen**
- Belohnung für Top 5 Clans:

| Platz | Goldbarren |
|---|---|
| 1 | 500 |
| 2 | 350 |
| 3 | 250 |
| 4 | 150 |
| 5 | 100 |

### Clan-Burg Housing Space
Stärkere Einheiten verbrauchen mehr Platz. Der Housing Space einer Einheit entspricht dem Wert in Abschnitt 7. Clan-Burg Level 1 = 10 Housing Space (kann z.B. 10 Milizionäre oder 1 Steinriese + 1 Ritter aufnehmen).

---

## 11. RANGLISTEN

| System | Basis | Reset |
|---|---|---|
| Solo | Individuelle Trophäen | Kein Reset (dauerhaft kumuliert) |
| Clan | Saison-Punkte aus Clan-Kriegen | Alle 8 Wochen, Belohnung Top 5 |

---

## 12. GOLDBARREN & MONETARISIERUNG

### Verwendungszwecke (abschließend, kein Pay-to-Win)
1. **Skins** — rein kosmetisch, keine Auswirkung auf Kampfwerte
2. **Bauzeit-Skip** — teuer, damit nicht alles durchgerusht werden kann
3. **Fraktionswechsel** — 500 Goldbarren (einmalig)

### Skin-Preise
| Typ | Goldbarren |
|---|---|
| Einheiten-Skin (Common) | 80 |
| Einheiten-Skin (Rare) | 200 |
| Gebäude-Skin (Common) | 150 |
| Gebäude-Skin (Rare) | 350 |
| Dorf-Theme (vollständiges Set) | 1.200 |

### Bauzeit-Skip Preise
```
Verbleibende Zeit ≤ 60 Min:    2,0 Goldbarren/Minute
Verbleibende Zeit ≤ 720 Min:   1,2 Goldbarren/Minute
Verbleibende Zeit > 720 Min:   0,6 Goldbarren/Minute
Mindestkosten: 20 Goldbarren
```

### Goldbarren kaufen (IAP)
| Paket | Goldbarren | Preis (EUR) |
|---|---|---|
| Starter | 80 | 0,99 |
| Klein | 500 | 4,99 |
| Mittel | 1.200 | 9,99 |
| Groß | 2.600 | 19,99 |
| Mega | 6.500 | 49,99 |

---

## 13. VISUELLE PROGRESSIONS-LOGIK (KRITISCH)

**Grundprinzip:** Gebäude und Einheiten werden mit jedem Level **nicht größer**, sondern **drastisch cooler**. Die Größe bleibt konstant. Was sich ändert: Material, Farbe, Detailreichtum, Leuchteffekte, Zusatz-Elemente, Auren.

### Level-Tier-System

Jedes Gebäude und jede Einheit hat pro Level einen **Tier-Namen** und eine **visuelle Identität**:

```
Level 1–2:   HOLZ-TIER     — einfaches Holzmaterial, kaum Details, heller Tageshimmel
Level 3–4:   STEIN-TIER    — Stein/Mauerwerk, erste Metallelemente, Abend-Himmel
Level 5–6:   METALL-TIER   — dunkles Metall, Gold-Akzente, Nacht-Himmel mit Sternen
Level 7–8:   MAGISCH-TIER  — Magie-Glows, Runen, Kristalle, mystischer Himmel
Level 9–10:  LEGENDÄR-TIER — leuchtende Auren, vollständige Magie-Transformation, Sternennacht
```

### Hintergrund-Progression
```javascript
// Himmel ändert sich automatisch mit Level:
level 1-2:  Strahlend blauer Tageshimmel
level 3-4:  Abendhimmel, leicht gedimmt
level 5-6:  Nacht, erste Sterne
level 7-8:  Tiefschwarz, viele Sterne, lila Nebel
level 9-10: Vollständige Mystiknacht, Magie-Partikel
```

### Rathaus — Tier-Namen & visuelle Transformation
```
Lv.1:  "Holzhütte"          — rohes Holz, kein Dach-Schmuck
Lv.2:  "Kleines Rathaus"    — geweißte Wände, einfache Fenster
Lv.3:  "Stadthaus"          — Steinmauer, rotes Ziegeldach, erste Zinnen
Lv.4:  "Befestigtes Rathaus"— zwei Seitentürme, verstärkte Zinnen
Lv.5:  "Festungsrathaus"    — Gold-Akzente, leuchtende Fenster, 3 Fahnen
Lv.6:  "Adelspalast"        — dunkles Mauerwerk, goldenes Tor, viele Fahnen
Lv.7:  "Kriegsburg"         — schwarzes Gestein, Magie-Glühen an Türmen, Runenmuster
Lv.8:  "Kaiserburg"         — leuchtende Runen-Bordüren, Kristall-Türmspitzen
Lv.9:  "Legendäre Zitadelle"— Vollständige Aura, schwebende Magie-Partikel
Lv.10: "Göttliche Hauptstadt"— Transformiert, Magie-Licht ausstrahlen, Thron-Ästhetik
```

### Wachturm — Tier-Namen
```
Lv.1: "Wachposten"      Lv.5: "Kanonenturm"
Lv.2: "Holzturm"        Lv.6: "Arcanaturm"
Lv.3: "Steinturm"       Lv.7: "Kristallturm"
Lv.4: "Wächterturm"     Lv.8: "Legendärer Turm"
```

### Mauer — Tier-Namen
```
Lv.1:  "Holzzaun"         Lv.6:  "Runenmauer"
Lv.2:  "Steinmauer"       Lv.7:  "Kristallmauer"
Lv.3:  "Verstärkte Mauer" Lv.8:  "Feuermauer"
Lv.4:  "Festungsmauer"    Lv.9:  "Schattenmauer"
Lv.5:  "Stachelmauer"     Lv.10: "Titanmauer"
```

### Milizionär — Tier-Namen
```
Lv.1: "Dorfbewohner"       — Holzstock, Lumpen, kein Helm
Lv.2: "Milizionär"         — Lederrüstung, einfaches Schwert
Lv.3: "Infanterist"         — Metallrüstung, Schild, Helm
Lv.4: "Veteran"             — Vollrüstung, leuchtende Klinge, Umhang
Lv.5: "Elite-Krieger"       — Dunkelrüstung, Gold-Akzente, Helmbusch
Lv.6: "Legendärer Held"     — Magie-Aura, Runen-Schwert, vollständige Elite-Ästhetik
```

### Ritter — Tier-Namen
```
Lv.1: "Knappe"              — einfache Rüstung, Holzschild
Lv.2: "Ritter"              — volle Rüstung, Metallschild
Lv.3: "Gepanzerter Ritter"  — verstärkte Rüstung, Lanze, Umhang
Lv.4: "Ordensritter"        — goldene Rüstung, Heiligen-Schild, Helm-Feder
Lv.5: "Legendärer Champion" — Magie-Aura, leuchtende Lanze, lila Glühen
```

### Rendering-Implementierung

Jede Zeichen-Funktion (`drawRathaus`, `drawWatchtower`, `drawMilitia`, etc.) muss folgende Parameter erhalten:
```typescript
interface DrawParams {
  ctx: SkiaCanvas;          // react-native-skia Canvas
  level: number;            // 1 bis max_level
  maxLevel: number;
  x: number;                // Mittelpunkt X (isometrisch)
  y: number;                // Bodenebene Y
  skin?: string;            // optionale Skin-ID
  isSelected?: boolean;     // Selektion-Highlight
  isUpgrading?: boolean;    // Animiertes Upgrade-Icon
}
```

**Implementierungs-Muster für alle Renderer:**
```typescript
function drawBuilding(params: DrawParams) {
  const t = (params.level - 1) / (params.maxLevel - 1); // 0.0 bis 1.0

  // 1. Material-Farbe interpolieren
  const wallColor = lerpColor(TIER_COLORS.wood, TIER_COLORS.legendary, t);

  // 2. Detail-Elemente ab bestimmten Leveln einblenden
  if (params.level >= 3) drawStoneDetails(params.ctx, params.x, params.y);
  if (params.level >= 5) drawGoldAccents(params.ctx, params.x, params.y);
  if (params.level >= 7) drawMagicGlow(params.ctx, params.x, params.y);
  if (params.level >= 9) drawLegendaryAura(params.ctx, params.x, params.y);

  // 3. Basis-Struktur zeichnen (feste Größe, nur Optik variiert)
  drawBaseStructure(params.ctx, params.x, params.y, wallColor);
}
```

### Material-Farb-Referenz
```javascript
const MATERIAL_COLORS = {
  wood_light:    '#c8a87a',  // Level 1-2
  wood_dark:     '#8b7355',
  stone_light:   '#9e9e9e',  // Level 3-4
  stone_dark:    '#616161',
  metal_light:   '#78909c',  // Level 5-6
  metal_dark:    '#263238',
  gold_accent:   '#f0c040',  // Akzentfarbe ab Level 5
  magic_purple:  '#aa44ff',  // Level 7-8
  magic_cyan:    '#00ccff',
  legendary:     '#ff44ff',  // Level 9-10
  legendary_glow:'#7700bb',
};

const TIER_ROOF_COLORS = {
  1: '#c0392b',  // Rot (Holz-Dach)
  3: '#8B1A1A',  // Dunkelrot (Stein)
  5: '#0d47a1',  // Dunkelblau (Metall)
  7: '#4a0080',  // Lila (Magie)
  9: '#000020',  // Fast schwarz mit Aura (Legendär)
};
```

---

## 14. BACKEND-ARCHITEKTUR

### REST API Endpoints

```
AUTH
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/oauth/apple
POST   /api/auth/oauth/google
POST   /api/auth/refresh

PLAYER
GET    /api/player/me
PATCH  /api/player/faction

VILLAGE
GET    /api/village/:playerId
POST   /api/village/buildings          -- Gebäude platzieren
PATCH  /api/village/buildings/:id/move -- Gebäude verschieben
DELETE /api/village/buildings/:id
POST   /api/village/buildings/:id/upgrade/start
POST   /api/village/buildings/:id/upgrade/skip  -- Goldbarren-Skip

UNITS
GET    /api/units/me
POST   /api/units/train                -- Einheiten trainieren
DELETE /api/units/:id                  -- Einheiten entlassen

BATTLE
POST   /api/battle/find               -- Matchmaking starten
GET    /api/battle/history

CLAN
POST   /api/clan/create
POST   /api/clan/join/:clanId
DELETE /api/clan/leave
GET    /api/clan/:clanId
POST   /api/clan/castle/donate        -- Einheiten in Clan-Burg stationieren
GET    /api/clan/wars/current

LEADERBOARD
GET    /api/leaderboard/solo?page=1&limit=50
GET    /api/leaderboard/clan?season=current

DUNGEON
GET    /api/dungeon/status            -- Ist Dungeon offen?
POST   /api/dungeon/start
POST   /api/dungeon/wave/complete
GET    /api/dungeon/history

SHOP
GET    /api/shop/skins
POST   /api/shop/skins/:skinId/buy
POST   /api/shop/bars/purchase        -- IAP Verification
```

### Cron-Jobs
```javascript
// Dungeon öffnen — Samstag 05:00 CET
cron.schedule('0 5 * * 6', () => openDungeon(), { timezone: 'Europe/Berlin' });

// Dungeon schließen — Sonntag 00:00 CET
cron.schedule('0 0 * * 0', () => closeDungeon(), { timezone: 'Europe/Berlin' });

// Saison-Reset — alle 8 Wochen (Montag 00:00)
// Datum-Logik: prüfe ob aktuelle Woche % 8 === 0
cron.schedule('0 0 * * 1', () => checkAndResetSeason(), { timezone: 'Europe/Berlin' });

// Ressourcen-Tick — alle 5 Minuten
cron.schedule('*/5 * * * *', () => processResourceProduction());

// Upgrade-Abschlüsse prüfen — jede Minute
cron.schedule('* * * * *', () => finishPendingUpgrades());
```

### Redis Keys
```
matchmaking:queue:{trophy_range}        -- Sorted Set für Matchmaking
battle:state:{battleId}                 -- Hash, Echtzeit-Kampfzustand
session:{playerId}                      -- JWT Session
resource:lock:{playerId}                -- Mutex für Ressourcen-Updates
dungeon:open                            -- Flag ob Dungeon aktiv
```

---

## 15. FRONTEND-ARCHITEKTUR

### Screens

#### VillageScreen
- Isometrisches Grid mit Drag & Drop
- Gebäude antippen → Info-Dialog (Level, HP, Kosten, Upgrade-Button)
- Upgrade läuft → Fortschrittsbalken, Goldbarren-Skip-Button
- Ressourcen-Anzeige oben (Holz, Stein, Gold, Edelsteine, Goldbarren)
- Produktions-Sammeln: Tap auf Produktionsgebäude

#### BattleScreen
- Gegnerisches Dorf-Layout laden
- Unten: Einheiten-Auswahl (Housing Space Anzeige)
- Tap auf Grid → Einheit dort deployen
- Oben: 5-Minuten-Timer, eigene vs. gegnerische HP-Gesamt-Bar
- Zerstörungs-Prozent live anzeigen

#### DungeonScreen
- Nur verfügbar wenn Dungeon offen
- Wellen-Übersicht (1–5 + Boss)
- Kampf-UI ähnlich BattleScreen, aber gegen NPCs

#### ClanScreen
- Mitgliederliste mit Trophäen
- Banner-Editor (Baukasten)
- Clan-Burg: welche Einheiten stationiert
- Krieg-Tab: laufender Clan-Krieg

#### LeaderboardScreen
- Toggle: Solo / Clan
- Paginierte Liste, eigene Position hervorgehoben

#### ShopScreen
- Skin-Galerie nach Typ gefiltert
- IAP-Integration für Goldbarren-Pakete

### isometrisches Grid

```typescript
// Isometrische Koordinaten-Konvertierung
function gridToScreen(gridX: number, gridY: number, tileW: number, tileH: number) {
  return {
    screenX: (gridX - gridY) * (tileW / 2),
    screenY: (gridX + gridY) * (tileH / 2),
  };
}

// Tile-Größen
const TILE_WIDTH = 64;   // px
const TILE_HEIGHT = 32;  // px (halbe Höhe = isometrisch)
const GRID_SIZE = 30;    // 30x30 Tiles
```

### State-Struktur (Zustand/Redux)
```typescript
interface AppState {
  player: PlayerState;
  village: VillageState;       // buildings[], layout, grid
  resources: ResourceState;    // wood, stone, gold, gems, bars
  units: UnitState[];
  battle: BattleState | null;
  clan: ClanState | null;
  dungeon: DungeonState;
  leaderboard: LeaderboardState;
  shop: ShopState;
}
```

---

## 16. IMPLEMENTIERUNGS-REIHENFOLGE

### Phase 1 — Fundament
1. Monorepo-Setup (Expo + Node.js + PostgreSQL + Redis)
2. DB-Migrations (alle Tabellen aus Abschnitt 3)
3. Auth-System (JWT + Apple/Google OAuth)
4. `game-config.json` als einzige Zahlenwert-Quelle einrichten
5. Basis-API (Player, Village CRUD)

### Phase 2 — Dorf
6. Isometrisches Grid-System (Koordinaten-Konvertierung, Rendering)
7. Gebäude-Placement (Drag & Drop auf Grid)
8. Gebäude-Renderer für alle Typen mit Level-Progression (Abschnitt 13)
9. Ressourcen-Tick (Cron, Produktionsberechnung)
10. Upgrade-System (Timer, Goldbarren-Skip)

### Phase 3 — Kampf
11. Matchmaking (Redis Queue, Socket.io)
12. Battle-Server (Einheiten-Bewegung, Kampflogik, Timer)
13. BattleScreen Frontend (Deploy, Echtzeit-Updates)
14. Loot-Berechnung + Trophäen-Delta

### Phase 4 — Sozial
15. Clan-System (Erstellen, Beitreten, Banner-Editor)
16. Clan-Burg (Housing-Space-Logik, stationieren)
17. Clan vs. Clan (Krieg-Matchmaking, Punkte-Aggregation)
18. Ranglisten (Solo + Clan, Paginierung)

### Phase 5 — PvE & Monetarisierung
19. Dungeon-Cron + PvE-Kampflogik (5 Wellen + Endboss)
20. Shop + Skin-System (Galerie, Kauf, Anwenden)
21. IAP-Integration (Apple + Google, Goldbarren-Vergabe)
22. Saison-Reset-Cron + Goldbarren-Ausschüttung Top 5

### Phase 6 — Polish
23. Partikel-Effekte (Upgrade, Kampf, Level-Up)
24. Push-Notifications (Upgrade fertig, Dungeon öffnet, Clan-Krieg)
25. Replay-System für abgeschlossene Kämpfe
26. Performance-Optimierung (Skia-Rendering, API-Caching)

---

## WICHTIGE IMPLEMENTIERUNGS-HINWEISE FÜR CLAUDE CODE

1. **Alle Zahlenwerte aus `game-config.json` lesen**, nie hardcodieren. Der Config-Pfad: `server/config/game-config.json`. Im Frontend via API-Endpoint `GET /api/config` laden und im State cachen.

2. **Fraktions-Modifikatoren immer anwenden** bei Berechnungen:
   ```typescript
   const actualBuildTime = baseBuildTime * faction.modifiers.build_time_multiplier;
   const actualCost = baseCost * faction.modifiers.build_cost_multiplier;
   ```

3. **Gebäude-Renderer: konstante Größe, variierende Optik.** Kein `scale(level)`. Stattdessen `lerpColor()` für Materialfarben und bedingte Detail-Elemente ab bestimmten Level-Schwellwerten.

4. **Ressourcen-Loot bei PvP:** Nur Holz und Stein, nie Gold oder Edelsteine.

5. **Dungeon-Timezone:** Immer `Europe/Berlin` für Cron-Jobs. Spieler sehen die Zeit in ihrer lokalen Timezone (Frontend konvertiert).

6. **Clan-Tag Moderation:** `bad-words` npm-Package installieren, Tag vor Speicherung prüfen. Ablehnen wenn Treffer.

7. **Bauzeit-Skip Mindestkosten:** 20 Goldbarren, auch wenn die Formel weniger ergibt.

8. **Housing Space Clan-Burg:** Beim Stationieren prüfen: `sum(unit.housing_space * quantity) <= clan_castle.current_capacity`. Fehler zurückgeben wenn überschritten.

9. **Socket.io Battle-Rooms:** Jeder Kampf bekommt eine eigene Room-ID (`battle:{battleId}`). Nach Kampfende Room zerstören, State aus Redis löschen.

10. **Isometrisches Grid Z-Index:** Gebäude müssen in Rendering-Reihenfolge von hinten nach vorne gezeichnet werden (Painter's Algorithm): `sortBy(building => building.gridX + building.gridY)`.

---
---

# TEIL 2 — GRAFIK, ANIMATION & GAME JUICE

# Village Wars — Grafik, Animation & Game Juice
**Ergänzung zum Master-Briefing (Abschnitt 13 erweitert)**

> "Game Juice" bezeichnet die Summe kleiner visueller und akustischer Rückmeldungen, die ein Spiel lebendig wirken lassen, ohne die Spielmechanik zu verändern. Ein Knopfdruck, der den Knopf eindrückt, ein leichtes Zittern beim Treffer, aufsteigende Schadenszahlen, ein kurzes Aufblitzen beim Levelaufstieg. Diese Datei spezifiziert alle Effekte, die Village Wars von "funktioniert" zu "fühlt sich gut an" heben. Alle Effekte sind rein kosmetisch und beeinflussen keine Balance.

---

## 1. GRUNDPRINZIPIEN

1. **Jede Spieleraktion bekommt sofortige visuelle Rückmeldung.** Kein Tap ohne Reaktion.
2. **Effekte sind kurz.** Die meisten dauern 150 bis 600 Millisekunden. Lange Effekte ermüden.
3. **Effekte sind abschaltbar.** Eine Einstellung "Effekte reduzieren" für schwächere Geräte und für Spieler die es ruhiger mögen.
4. **Nie die Lesbarkeit opfern.** Partikel und Glows dürfen die Spielinformation nie verdecken.
5. **Performance zuerst.** Auf einem Mittelklasse-Handy müssen stabile 60 FPS gehalten werden. Partikel-Obergrenzen einhalten.

---

## 2. ANIMATIONS-PRINZIPIEN (Easing)

Lineare Bewegung wirkt mechanisch. Alle Animationen nutzen Easing-Kurven.

```typescript
const EASING = {
  easeOutBack:  (t: number) => 1 + 2.7 * Math.pow(t-1,3) + 1.7 * Math.pow(t-1,2), // Überschwingen, für Pop-Ins
  easeOutCubic: (t: number) => 1 - Math.pow(1-t,3),                                 // weiches Auslaufen
  easeInOutQuad:(t: number) => t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2,              // sanft hin und zurück
  easeOutElastic:(t: number) => {                                                    // federnd, für Belohnungen
    const c = (2*Math.PI)/3;
    return t===0?0:t===1?1:Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c)+1;
  },
};
```

**Regel:** Pop-Ins (Dialoge, neue Gebäude, Belohnungs-Icons) nutzen `easeOutBack`. Bewegungen die anhalten nutzen `easeOutCubic`. Belohnungen die Aufmerksamkeit wollen nutzen `easeOutElastic`.

---

## 3. KERN-EFFEKTE (Game Juice)

### 3.1 Screenshake (Bildschirmzittern)
Bei Einschlägen, Zerstörung, schweren Einheiten. Kurzes Versetzen der gesamten Kamera, das schnell ausklingt.

```typescript
interface ShakeState { intensity: number; }
// Bei Ereignis: shake.intensity = startwert
// Pro Frame:
const offsetX = (Math.random()*2-1) * shake.intensity;
const offsetY = (Math.random()*2-1) * shake.intensity;
shake.intensity *= 0.85;            // Abklingen
if (shake.intensity < 0.5) shake.intensity = 0;
// offsetX/Y auf die gesamte Render-Transform anwenden
```

| Ereignis | Start-Intensität |
|---|---|
| Einheit trifft Mauer | 3 |
| Verteidigungsturm feuert | 4 |
| Schwere Einheit (Steinriese) landet | 10 |
| Gebäude zerstört | 14 |
| Rathaus zerstört (Kampfende) | 20 |

### 3.2 Squash & Stretch
Objekte stauchen und strecken sich kurz bei Aktionen. Lässt sie elastisch und lebendig wirken.

- Gebäude bei Upgrade-Abschluss: schnell auf 1.35x Skalierung, dann mit `easeOutElastic` zurück auf 1.0x
- Einheit beim Spawnen: von 0.2x auf 1.1x auf 1.0x
- Knöpfe beim Antippen: auf 0.94x während gedrückt, zurück auf 1.0x beim Loslassen

### 3.3 Hit-Flash
Getroffene Objekte blitzen einen Frame lang weiß auf, dann zurück zur Normalfarbe. Macht Treffer fühlbar.

```typescript
// Bei Treffer: hitFlash = 1.0
// Beim Zeichnen: wenn hitFlash > 0, ersetze alle Füllfarben durch Weiß mit alpha = hitFlash
// Pro Frame: hitFlash -= 0.12
```

### 3.4 Aufsteigende Zahlen (Floating Combat Text)
Schadenszahlen, Ressourcengewinne, Trophäen steigen vom Ereignisort auf und verblassen.

| Typ | Farbe | Beispiel |
|---|---|---|
| Schaden | Rot `#ff4444` | -247 |
| Ressourcengewinn | Grün `#7cdc5a` | +1.240 Holz |
| Trophäen-Gewinn | Gold `#f0c040` | +28 🏆 |
| Trophäen-Verlust | Grau `#888` | -22 🏆 |
| Kritischer Treffer | Orange, größer | -500! |

Bewegung: 1.2 px pro Frame nach oben, `life` sinkt um 0.015 pro Frame, Text verblasst mit `life`. Leichter Schatten für Lesbarkeit auf jedem Hintergrund.

---

## 4. PARTIKELSYSTEM

Ein einziges, wiederverwendbares Partikelsystem für alle Effekte. Partikel-Obergrenze global: 200 gleichzeitig (ältester wird entfernt wenn überschritten).

```typescript
interface Particle {
  x: number; y: number;
  vx: number; vy: number;     // Geschwindigkeit
  life: number;               // 1.0 bis 0.0
  decay: number;              // Abnahme pro Frame
  size: number;
  color: string;
  gravity: number;            // vy += gravity pro Frame
  type: 'spark' | 'coin' | 'smoke' | 'star' | 'rune';
  spin?: number;
}
```

### Partikel-Presets

| Preset | Auslöser | Partikel | Verhalten |
|---|---|---|---|
| `upgradeBurst` | Gebäude-Upgrade fertig | 28 Funken gold/weiß | radial nach außen, leichte Gravitation |
| `levelUpAura` | Level 9/10 erreicht | 40 Sterne lila/pink | Ring der nach außen wandert |
| `coinRain` | Ressourcen sammeln | 22 Münzen | fallen von oben, rotieren |
| `hitSpark` | Treffer | 18 Funken rot/orange | kurzer Spritzer, starke Gravitation |
| `deploySpawn` | Einheit platziert | 16 Funken blau | aufwärts, dann fallend |
| `destroyBurst` | Gebäude zerstört | 34 Trümmer + 12 Rauch | explosiv + aufsteigender Rauch |
| `magicAmbient` | Magisches Gebäude (Lvl 7+) | langsame Runen | schweben dauerhaft langsam auf |

### Münz-Rotation (für coinRain)
Die Münze wirkt 3D durch Stauchen der Breite:
```typescript
const squash = Math.abs(Math.sin(Date.now()/100 + particle.spin));
// ellipse mit radiusX = size * squash, radiusY = size
// kleine weiße Glanzstelle oben links
```

---

## 5. EFFEKTE PRO SPIELBEREICH

### 5.1 Dorf-Ansicht (VillageScreen)
- **Idle-Atmung:** Alle Gebäude pulsieren minimal (Skalierung 1.0 bis 1.012 über 2 Sekunden, Sinus). Lässt das Dorf lebendig wirken statt eingefroren.
- **Fahnen wehen:** Fahnen auf Gebäuden schwingen per Sinus.
- **Produktions-Glitzer:** Über produzierenden Gebäuden steigen alle paar Sekunden kleine Ressourcen-Icons auf, wenn Lager sich füllt.
- **Sammel-Tap:** Tap auf produzierendes Gebäude löst `coinRain` aus, plus aufsteigende Zahl mit Menge.
- **Upgrade-Abschluss:** `upgradeBurst` + Squash&Stretch + "LEVEL UP!" Floating Text + kurzes Glow-Pulsieren in Materialfarbe der neuen Stufe.
- **Gebäude platzieren:** Pop-In mit `easeOutBack`, Staubwölkchen am Boden.
- **Wasser animiert:** Bei Fischmenschen-Dorf leichte Wellenbewegung auf Wasser-Tiles (verschobene Sinus-Linien).

### 5.2 Kampf (BattleScreen)
- **Einheiten-Spawn:** `deploySpawn` + Squash&Stretch.
- **Lauf-Animation:** Einheiten wippen leicht beim Laufen (vertikaler Sinus-Versatz).
- **Angriff:** Kurzer Vorwärts-Lunge der Einheit, `hitSpark` am Ziel, `hitFlash` auf getroffenem Gebäude, Floating-Schadenszahl.
- **Turm feuert:** Mündungsblitz, Projektil fliegt mit Spur, Einschlag-Funken, leichter Screenshake.
- **Gebäude-HP sinkt:** HP-Balken animiert weich runter (nicht sprunghaft), färbt sich grün → gelb → rot.
- **Gebäude zerstört:** `destroyBurst`, Screenshake, das Gebäude sackt zusammen (Squash auf 0 mit Rauch).
- **Kampf gewonnen:** Goldener Vollbild-Glow, "SIEG!" mit `easeOutElastic`, `coinRain` der Beute, Trophäen-Zähler tickt hoch.
- **Kampf verloren:** Bildschirm entsättigt kurz, "Niederlage" sachlich eingeblendet (nicht entmutigend gestalten).
- **Sterne-Vergabe:** Wie im Genre üblich, Sterne ploppen einzeln mit `easeOutBack` und kleinem Sound-Cue ein.

### 5.3 Dungeon (DungeonScreen)
- **Wellen-Start:** "Welle 1" wischt von links ein, rote Warnfarbe.
- **Boss-Auftritt:** Bildschirm verdunkelt am Rand (Vignette), Boss-Name dramatisch eingeblendet, stärkerer Screenshake bei seinen Angriffen.
- **Wellen-Abschluss:** Belohnungs-Icons ploppen mit `easeOutElastic` und `levelUpAura`.

### 5.4 Belohnungen & Fortschritt
- **Levelaufstieg Dorf:** Vollbild-Effekt, neue freigeschaltete Gebäude erscheinen als Karten die hereinfliegen.
- **Truhen-Öffnung:** Truhe wackelt aufbauend (3x stärker werdend), springt auf mit Lichtstrahl und Partikelfontäne.
- **Saison-Belohnung (Goldbarren):** Besonders üppige Animation, da seltenes Ereignis.

---

## 6. ÜBERGÄNGE ZWISCHEN BILDSCHIRMEN
- Keine harten Schnitte. Bildschirmwechsel nutzen kurze Slide- oder Fade-Übergänge (200 bis 300 ms).
- In den Kampf: kurzes Heranzoomen auf das gegnerische Dorf.
- Aus dem Kampf zurück: Beute-Zusammenfassung fliegt herein, dann sanft zurück zum Dorf.

---

## 7. FARB- & LICHT-PROGRESSION (verknüpft mit Abschnitt 13 des Master-Briefings)

Die visuelle Levelprogression aus dem Master-Briefing wird durch animierte Effekte verstärkt:
- **Level 1 bis 4:** keine Eigenleuchteffekte, nur die Material- und Detailänderung.
- **Level 5 bis 6:** Gold-Akzente glänzen periodisch (wandernder Glanzstreifen).
- **Level 7 bis 8:** dauerhafte `magicAmbient` Runen-Partikel, sanftes Glühen das atmet.
- **Level 9 bis 10:** vollständige pulsierende Aura, schwebende Magie-Partikel, gelegentliche Energie-Funken.

---

## 8. SOUND (kurz, da Effekt-eng verwandt)
Auch wenn diese Datei grafisch ist: jeder größere visuelle Effekt sollte einen kurzen Sound-Cue bekommen (Upgrade-Ding, Treffer-Thud, Münz-Klimpern, Sieg-Fanfare). Sounds getrennt abschaltbar von Musik. Bibliothek-Empfehlung: `expo-av` für React Native.

---

## 9. PERFORMANCE-LEITPLANKEN

| Regel | Wert |
|---|---|
| Globale Partikel-Obergrenze | 200 gleichzeitig |
| Ziel-Bildrate | 60 FPS Mittelklasse-Gerät |
| Bei FPS-Einbruch | Partikel-Obergrenze automatisch auf 80 senken |
| Idle-Atmung | nur sichtbare Gebäude, nicht außerhalb des Viewports |
| Glow/Schatten (teuer) | nur ab Level 5, max. auf sichtbaren Objekten |
| Einstellung "Effekte reduzieren" | deaktiviert Screenshake, halbiert Partikel, entfernt Idle-Atmung |

Implementierungs-Hinweis: react-native-skia rendert auf der GPU. Partikel als einfache Kreise/Ellipsen zeichnen, keine teuren Pfade pro Partikel. Glow sparsam einsetzen, da `shadowBlur`-Äquivalente teuer sind. Ein einziger Render-Loop über `useFrameCallback` von Skia steuert alle Animationen.

---

## 10. UMSETZUNGS-REIHENFOLGE FÜR EFFEKTE

Diese Effekte werden NACH der funktionalen Implementierung (Master-Briefing Phasen 1 bis 5) in Phase 6 ergänzt. Reihenfolge nach Wirkung pro Aufwand:

1. Knopf-Druck-Feedback (Squash) — winziger Aufwand, überall spürbar
2. Floating Combat Text — hoher Wirkungsgrad im Kampf
3. Hit-Flash + Screenshake — macht Kämpfe fühlbar
4. Partikelsystem-Grundgerüst + `upgradeBurst` und `coinRain`
5. Squash&Stretch für Gebäude und Einheiten-Spawns
6. Sieg/Niederlage-Sequenzen
7. Idle-Atmung und Fahnen (Atmosphäre)
8. Magische Aura-Progression Level 7 bis 10
9. Bildschirmübergänge
10. Sound-Cues

---
---

# ANHANG: GAME-CONFIG.JSON

> Diesen kompletten JSON-Inhalt als `server/config/game-config.json` speichern. Dies ist die einzige Quelle aller Zahlenwerte.

```json
{
  "_meta": {
    "version": "0.1.0",
    "description": "Zentrale Balancing-Konfiguration für Village Wars. Alle Zahlenwerte (Kosten, Zeiten, Kampfwerte) gehören hierher, nicht in den Code.",
    "currency_legend": {
      "wood": "Holz",
      "stone": "Stein",
      "gold": "Gold (selten, NICHT die Premium-Währung)",
      "gems": "Edelsteine (sehr selten, Dungeon-exklusiv)",
      "bars": "Goldbarren (Premium-Ingame-Währung, NICHT spielerisch erwirtschaftbar)"
    },
    "balance_principle": "Humans = 100% Baseline auf allen Werten. Jede andere Fraktion hat genau einen Bonus (+10% bis +20%) und genau einen Malus (-10% bis -20%) gegenüber dem Baseline. Keine Fraktion darf in Summe stärker oder schwächer sein."
  },

  "factions": {
    "humans": {
      "display_name": "Menschen",
      "theme": "Grasland, Burgen, Flüsse",
      "bonus": null,
      "malus": null,
      "bonus_description": "Keiner – Allrounder-Fraktion, dient als 100%-Baseline für alle anderen Werte.",
      "malus_description": "Keiner.",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "resource_production_multiplier": 1.0,
        "wall_hp_multiplier": 1.0,
        "unit_hp_multiplier": 1.0,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 1.0,
        "defense_building_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 1.0
      }
    },
    "fishfolk": {
      "display_name": "Fischmenschen",
      "theme": "Küsten-/Sumpfdorf, Stege, Wasserkanäle",
      "bonus_description": "+15% Ressourcenproduktion bei Gebäuden, die an Wasserkanal-Tiles angrenzen.",
      "malus_description": "-15% Mauer-HP (schwächere Landverteidigung).",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "resource_production_multiplier": 1.0,
        "resource_production_multiplier_water_adjacent": 1.15,
        "wall_hp_multiplier": 0.85,
        "unit_hp_multiplier": 1.0,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 1.0,
        "defense_building_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 1.0
      }
    },
    "giants": {
      "display_name": "Riesen",
      "theme": "Grobe Steinhütten, große Bauplätze",
      "bonus_description": "+20% HP und +15% Schaden auf alle Einheiten.",
      "malus_description": "+20% Bauzeit und +15% Baukosten auf alle Gebäude/Upgrades.",
      "modifiers": {
        "build_time_multiplier": 1.20,
        "build_cost_multiplier": 1.15,
        "resource_production_multiplier": 1.0,
        "wall_hp_multiplier": 1.0,
        "unit_hp_multiplier": 1.20,
        "unit_damage_multiplier": 1.15,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 1.15,
        "defense_building_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 1.15
      }
    },
    "dwarves": {
      "display_name": "Zwerge",
      "theme": "Bergbau-Siedlung, Stollen, Schmieden",
      "bonus_description": "-15% Gebäude-Upgrade-Kosten, +15% Stein-/Goldabbau.",
      "malus_description": "-20% Schaden für Fernkampf-Einheiten.",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 0.85,
        "resource_production_multiplier": 1.0,
        "resource_production_multiplier_stone": 1.15,
        "resource_production_multiplier_gold": 1.15,
        "wall_hp_multiplier": 1.0,
        "unit_hp_multiplier": 1.0,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 0.80,
        "defense_building_cost_multiplier": 1.0
      }
    },
    "elves": {
      "display_name": "Elfen",
      "theme": "Waldlichtung, Baumhäuser",
      "bonus_description": "+20% Bewegungsgeschwindigkeit und +15% Angriffsgeschwindigkeit (Angriffe pro Sekunde) im Kampf.",
      "malus_description": "-15% Gebäude-HP (leichter zu zerstören).",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "resource_production_multiplier": 1.0,
        "wall_hp_multiplier": 1.0,
        "building_hp_multiplier": 0.85,
        "unit_hp_multiplier": 1.0,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.20,
        "attack_speed_multiplier": 1.15,
        "ranged_unit_damage_multiplier": 1.0,
        "defense_building_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 1.0
      }
    },
    "undead": {
      "display_name": "Untote",
      "theme": "Friedhof, verfallene Ruinen",
      "bonus_description": "-15% Ressourcenkosten für Einheiten, ausgewählte Einheiten regenerieren HP im Kampf (siehe unit_special_abilities).",
      "malus_description": "-15% Basis-Ressourcenproduktion (Holz/Stein).",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "resource_production_multiplier": 0.85,
        "unit_cost_multiplier": 0.85,
        "wall_hp_multiplier": 1.0,
        "unit_hp_multiplier": 1.0,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 1.0,
        "defense_building_cost_multiplier": 1.0,
        "upgrade_cost_multiplier": 1.0
      }
    },
    "orcs": {
      "display_name": "Orks",
      "theme": "Lagerfeste, Palisaden, Kriegszelte",
      "bonus_description": "+20% Nahkampfschaden.",
      "malus_description": "+20% Baukosten für Verteidigungsgebäude.",
      "modifiers": {
        "build_time_multiplier": 1.0,
        "build_cost_multiplier": 1.0,
        "resource_production_multiplier": 1.0,
        "wall_hp_multiplier": 1.0,
        "unit_hp_multiplier": 1.0,
        "melee_unit_damage_multiplier": 1.20,
        "unit_damage_multiplier": 1.0,
        "unit_speed_multiplier": 1.0,
        "ranged_unit_damage_multiplier": 1.0,
        "defense_building_cost_multiplier": 1.20,
        "upgrade_cost_multiplier": 1.0
      }
    }
  },

  "town_hall_levels": {
    "description": "Dorf-Level 1-10. Schaltet Gebäude/Einheiten progressiv frei (siehe unlock_town_hall_level in buildings/units). Level 5 schaltet Clans frei.",
    "max_level": 10,
    "upgrade_requirements": [
      { "level": 1, "wood": 0, "stone": 0, "build_time_minutes": 0 },
      { "level": 2, "wood": 500, "stone": 300, "build_time_minutes": 15 },
      { "level": 3, "wood": 1500, "stone": 1000, "build_time_minutes": 60 },
      { "level": 4, "wood": 4000, "stone": 2800, "build_time_minutes": 240 },
      { "level": 5, "wood": 9000, "stone": 6500, "build_time_minutes": 720 },
      { "level": 6, "wood": 18000, "stone": 13000, "gold": 1000, "build_time_minutes": 1440 },
      { "level": 7, "wood": 32000, "stone": 24000, "gold": 3000, "build_time_minutes": 2880 },
      { "level": 8, "wood": 55000, "stone": 42000, "gold": 7000, "build_time_minutes": 4320 },
      { "level": 9, "wood": 90000, "stone": 70000, "gold": 14000, "build_time_minutes": 7200 },
      { "level": 10, "wood": 140000, "stone": 110000, "gold": 25000, "gems": 200, "build_time_minutes": 10080 }
    ]
  },

  "build_time_skip": {
    "description": "Bauzeit-Verkürzung gegen Goldbarren ist erlaubt, aber bewusst teuer kalkuliert, damit nicht alles 'durchgerusht' werden kann. Zweiter Verwendungszweck der Goldbarren neben Skins.",
    "cost_per_minute_remaining": {
      "tier_short": { "max_minutes": 60, "bars_per_minute": 2 },
      "tier_medium": { "max_minutes": 720, "bars_per_minute": 1.2 },
      "tier_long": { "max_minutes": 100000, "bars_per_minute": 0.6 }
    },
    "minimum_cost_bars": 20,
    "notes": "Degressive Staffelung: lange Bauzeiten kosten pro Minute weniger, aber in Summe trotzdem hohe Gesamtkosten. Mindestkosten verhindern Mikro-Skips für 1-2 Goldbarren."
  },

  "resources": {
    "wood": { "display_name": "Holz", "type": "basic", "earnable_passively": true, "lootable_pvp": true, "loot_percentage_on_defeat": 20 },
    "stone": { "display_name": "Stein", "type": "basic", "earnable_passively": true, "lootable_pvp": true, "loot_percentage_on_defeat": 20 },
    "gold": { "display_name": "Gold", "type": "rare", "earnable_passively": true, "lootable_pvp": false, "source": ["passive_production_low_rate", "dungeon_reward"] },
    "gems": { "display_name": "Edelsteine", "type": "very_rare", "earnable_passively": false, "lootable_pvp": false, "source": ["dungeon_reward"] },
    "bars": { "display_name": "Goldbarren", "type": "premium", "earnable_passively": false, "lootable_pvp": false, "source": ["real_money_purchase", "clan_leaderboard_top5_seasonal"] }
  },

  "pvp": {
    "match_duration_seconds": 300,
    "loot_on_victory": { "wood_percentage": 20, "stone_percentage": 20, "gold_percentage": 0, "gems_percentage": 0 },
    "loot_note": "Nur Holz und Stein sind plünderbar. Gold und Edelsteine sind explizit ausgenommen, damit Dungeons (PvE) ihren eigenen Sinn als alleinige Gold/Edelstein-Quelle behalten.",
    "trophy_change": { "win_base": 28, "loss_base": -22, "note": "Feinjustierung über Elo-ähnliches System nach Trophäen-Differenz der Gegner." },
    "modes": ["solo_1v1", "clan_vs_clan"]
  },

  "dungeon": {
    "schedule": {
      "opens": "Saturday 05:00 CET",
      "closes": "Sunday 00:00 CET",
      "duration_hours": 19,
      "frequency": "weekly"
    },
    "structure": { "waves": 5, "final_boss": true },
    "rewards_on_completion": { "gold_min": 150, "gold_max": 400, "gems_min": 3, "gems_max": 10, "bars": 0 }
  },

  "clan": {
    "unlock_town_hall_level": 5,
    "max_members": 50,
    "tag_length_min": 3,
    "tag_length_max": 5,
    "season_reset_weeks": 8,
    "leaderboard_rewards_bars": {
      "rank_1": 500,
      "rank_2": 350,
      "rank_3": 250,
      "rank_4": 150,
      "rank_5": 100
    },
    "clan_castle": {
      "description": "Housing Space (Stellplätze) skaliert mit Clan-Burg-Level. Stärkere Einheiten verbrauchen mehr Stellplätze als schwächere (siehe units[].housing_space).",
      "levels": [
        { "level": 1, "housing_space": 10, "wood": 2000, "stone": 1500, "build_time_minutes": 180 },
        { "level": 2, "housing_space": 15, "wood": 5000, "stone": 3500, "build_time_minutes": 480 },
        { "level": 3, "housing_space": 20, "wood": 10000, "stone": 7500, "gold": 500, "build_time_minutes": 1440 },
        { "level": 4, "housing_space": 25, "wood": 18000, "stone": 14000, "gold": 1200, "build_time_minutes": 2880 },
        { "level": 5, "housing_space": 30, "wood": 30000, "stone": 24000, "gold": 2500, "build_time_minutes": 5760 }
      ]
    }
  },

  "buildings_common": {
    "description": "Gebäude, die JEDE Fraktion bauen kann (Basisgebäude). Fraktionsspezifische Exklusiv-Gebäude stehen unter factions_exclusive_content.",
    "town_hall": {
      "display_name": "Rathaus",
      "unlock_town_hall_level": 1,
      "max_level": 10,
      "function": "Bestimmt Dorf-Level, schaltet alle anderen Gebäude/Einheiten progressiv frei."
    },
    "lumber_camp": {
      "display_name": "Holzfällerlager",
      "unlock_town_hall_level": 1,
      "max_level": 10,
      "base_production_per_hour": 200,
      "production_growth_per_level_percent": 18,
      "levels": [
        { "level": 1, "wood_cost": 0, "stone_cost": 0, "build_time_minutes": 0 },
        { "level": 2, "wood_cost": 300, "stone_cost": 0, "build_time_minutes": 10 },
        { "level": 3, "wood_cost": 700, "stone_cost": 0, "build_time_minutes": 30 },
        { "level": 4, "wood_cost": 1500, "stone_cost": 200, "build_time_minutes": 90 },
        { "level": 5, "wood_cost": 3000, "stone_cost": 500, "build_time_minutes": 240 },
        { "level": 6, "wood_cost": 6000, "stone_cost": 1200, "build_time_minutes": 600 },
        { "level": 7, "wood_cost": 11000, "stone_cost": 2500, "build_time_minutes": 1200 },
        { "level": 8, "wood_cost": 19000, "stone_cost": 4500, "build_time_minutes": 2160 },
        { "level": 9, "wood_cost": 30000, "stone_cost": 7500, "build_time_minutes": 3600 },
        { "level": 10, "wood_cost": 45000, "stone_cost": 12000, "build_time_minutes": 5760 }
      ]
    },
    "quarry": {
      "display_name": "Steinbruch",
      "unlock_town_hall_level": 1,
      "max_level": 10,
      "base_production_per_hour": 150,
      "production_growth_per_level_percent": 18,
      "levels": "Analog lumber_camp-Struktur, gleiche Kosten/Zeit-Kurve, Stein statt Holz als Hauptertrag."
    },
    "gold_mine": {
      "display_name": "Goldmine",
      "unlock_town_hall_level": 3,
      "max_level": 8,
      "base_production_per_hour": 25,
      "production_growth_per_level_percent": 20,
      "levels": [
        { "level": 1, "wood_cost": 2000, "stone_cost": 1000, "build_time_minutes": 120 },
        { "level": 2, "wood_cost": 4000, "stone_cost": 2500, "build_time_minutes": 360 },
        { "level": 3, "wood_cost": 8000, "stone_cost": 5000, "build_time_minutes": 720 },
        { "level": 4, "wood_cost": 15000, "stone_cost": 9000, "build_time_minutes": 1440 },
        { "level": 5, "wood_cost": 25000, "stone_cost": 16000, "build_time_minutes": 2880 },
        { "level": 6, "wood_cost": 40000, "stone_cost": 26000, "build_time_minutes": 4320 },
        { "level": 7, "wood_cost": 60000, "stone_cost": 40000, "build_time_minutes": 5760 },
        { "level": 8, "wood_cost": 85000, "stone_cost": 58000, "build_time_minutes": 7200 }
      ]
    },
    "storage_wood": { "display_name": "Holzlager", "unlock_town_hall_level": 1, "max_level": 10, "base_capacity": 2000, "capacity_growth_per_level_percent": 35 },
    "storage_stone": { "display_name": "Steinlager", "unlock_town_hall_level": 1, "max_level": 10, "base_capacity": 1500, "capacity_growth_per_level_percent": 35 },
    "storage_gold": { "display_name": "Goldtresor", "unlock_town_hall_level": 3, "max_level": 8, "base_capacity": 500, "capacity_growth_per_level_percent": 35 },
    "wall": {
      "display_name": "Mauer",
      "unlock_town_hall_level": 2,
      "max_level": 10,
      "base_hp": 300,
      "hp_growth_per_level_percent": 30,
      "cost_per_segment_level_1": { "stone": 50 }
    },
    "barracks": {
      "display_name": "Kaserne",
      "unlock_town_hall_level": 1,
      "max_level": 6,
      "function": "Rekrutiert Basis-Einheiten. Fraktionsspezifische Einheiten benötigen teils zusätzliche Spezialgebäude (siehe factions_exclusive_content)."
    },
    "clan_castle": {
      "display_name": "Clan-Burg",
      "unlock_town_hall_level": 5,
      "see": "clan.clan_castle für Level-Werte"
    },
    "watchtower": {
      "display_name": "Wachturm",
      "unlock_town_hall_level": 2,
      "max_level": 8,
      "type": "defense",
      "base_damage_per_second": 12,
      "base_hp": 400,
      "range_tiles": 6
    },
    "cannon": {
      "display_name": "Kanone",
      "unlock_town_hall_level": 4,
      "max_level": 8,
      "type": "defense",
      "base_damage_per_second": 22,
      "base_hp": 500,
      "range_tiles": 7
    }
  },

  "units_common": {
    "description": "Basis-Einheiten, die jede Fraktion rekrutieren kann. housing_space = Stellplatz-Verbrauch in Clan-Burg/Armeelager (stärkere Einheiten verbrauchen mehr).",
    "militia": {
      "display_name": "Milizionär",
      "unlock_town_hall_level": 1,
      "role": "melee_basic",
      "housing_space": 1,
      "hp": 60,
      "damage_per_second": 8,
      "speed": "medium",
      "cost": { "wood": 30 },
      "train_time_seconds": 20
    },
    "archer": {
      "display_name": "Bogenschütze",
      "unlock_town_hall_level": 2,
      "role": "ranged_basic",
      "housing_space": 1,
      "hp": 40,
      "damage_per_second": 14,
      "range_tiles": 4,
      "speed": "medium",
      "cost": { "wood": 50 },
      "train_time_seconds": 30
    },
    "knight": {
      "display_name": "Ritter",
      "unlock_town_hall_level": 4,
      "role": "melee_tank",
      "housing_space": 3,
      "hp": 180,
      "damage_per_second": 16,
      "speed": "slow",
      "cost": { "wood": 120, "stone": 40 },
      "train_time_seconds": 90
    },
    "catapult": {
      "display_name": "Katapult",
      "unlock_town_hall_level": 6,
      "role": "siege_ranged",
      "housing_space": 6,
      "hp": 120,
      "damage_per_second": 35,
      "range_tiles": 8,
      "splash_damage": true,
      "speed": "very_slow",
      "cost": { "wood": 300, "stone": 150 },
      "train_time_seconds": 240
    },
    "healer": {
      "display_name": "Heiler",
      "unlock_town_hall_level": 7,
      "role": "support",
      "housing_space": 4,
      "hp": 70,
      "heal_per_second": 12,
      "speed": "medium",
      "cost": { "wood": 200, "gold": 20 },
      "train_time_seconds": 180
    }
  },

  "factions_exclusive_content": {
    "humans": {
      "exclusive_buildings": [
        {
          "id": "trade_post",
          "display_name": "Handelsposten",
          "unlock_town_hall_level": 5,
          "function": "Tauscht Holz/Stein im festen Kurs gegen die jeweils andere Ressource (Notfall-Liquidität).",
          "wood_cost": 4000,
          "stone_cost": 3000,
          "build_time_minutes": 480
        }
      ],
      "exclusive_units": [
        {
          "id": "knight_captain",
          "display_name": "Hauptmann",
          "unlock_town_hall_level": 8,
          "role": "melee_elite",
          "housing_space": 5,
          "hp": 260,
          "damage_per_second": 22,
          "speed": "medium",
          "cost": { "wood": 250, "stone": 100, "gold": 30 },
          "train_time_seconds": 150,
          "special_ability": "Erhöht Moral (kleiner Schadensbonus) für benachbarte Einheiten im Kampf."
        }
      ]
    },

    "fishfolk": {
      "exclusive_buildings": [
        {
          "id": "tide_well",
          "display_name": "Gezeitenbrunnen",
          "unlock_town_hall_level": 4,
          "function": "Erhöht Holz-/Steinertrag aller angrenzenden Gebäude um den fraktionseigenen Wasser-Bonus (siehe factions.fishfolk.modifiers).",
          "wood_cost": 3000,
          "stone_cost": 2200,
          "build_time_minutes": 360
        },
        {
          "id": "canal_lock",
          "display_name": "Kanalschleuse",
          "unlock_town_hall_level": 6,
          "function": "Defensivgebäude, das gegnerische Bodeneinheiten beim Durchqueren von Wasser-Tiles verlangsamt.",
          "type": "defense",
          "base_hp": 350,
          "wood_cost": 5000,
          "stone_cost": 4000,
          "build_time_minutes": 720
        }
      ],
      "exclusive_units": [
        {
          "id": "tide_warrior",
          "display_name": "Gezeitenkämpfer",
          "unlock_town_hall_level": 5,
          "role": "melee_amphibious",
          "housing_space": 3,
          "hp": 150,
          "damage_per_second": 17,
          "speed": "medium",
          "special_trait": "Volle Bewegungsgeschwindigkeit auf Wasser-Tiles (andere Einheiten sind dort verlangsamt).",
          "cost": { "wood": 130, "stone": 30 },
          "train_time_seconds": 100
        },
        {
          "id": "net_thrower",
          "display_name": "Netzwerfer",
          "unlock_town_hall_level": 7,
          "role": "ranged_support",
          "housing_space": 4,
          "hp": 80,
          "damage_per_second": 10,
          "range_tiles": 5,
          "special_ability": "Verlangsamt getroffene Gegner kurzzeitig um 25%.",
          "cost": { "wood": 220, "gold": 15 },
          "train_time_seconds": 160
        }
      ]
    },

    "giants": {
      "exclusive_buildings": [
        {
          "id": "boulder_quarry",
          "display_name": "Felsbrocken-Grube",
          "unlock_town_hall_level": 5,
          "function": "Spezial-Steinproduktion mit höherem Output pro Gebäude-Slot (kompensiert lange Bauzeiten durch Effizienz statt Geschwindigkeit).",
          "wood_cost": 4500,
          "stone_cost": 3500,
          "build_time_minutes": 600
        }
      ],
      "exclusive_units": [
        {
          "id": "stone_giant",
          "display_name": "Steinriese",
          "unlock_town_hall_level": 6,
          "role": "melee_tank_heavy",
          "housing_space": 8,
          "hp": 420,
          "damage_per_second": 30,
          "speed": "very_slow",
          "cost": { "wood": 400, "stone": 250 },
          "train_time_seconds": 300
        },
        {
          "id": "boulder_thrower",
          "display_name": "Felswerfer",
          "unlock_town_hall_level": 8,
          "role": "ranged_siege",
          "housing_space": 7,
          "hp": 280,
          "damage_per_second": 38,
          "range_tiles": 6,
          "splash_damage": true,
          "speed": "very_slow",
          "cost": { "wood": 350, "stone": 300, "gold": 40 },
          "train_time_seconds": 280
        }
      ]
    },

    "dwarves": {
      "exclusive_buildings": [
        {
          "id": "deep_mine_shaft",
          "display_name": "Tiefer Stollen",
          "unlock_town_hall_level": 4,
          "function": "Alternative/zusätzliche Steinproduktionsstätte mit fraktionseigenem Abbau-Bonus.",
          "wood_cost": 2500,
          "stone_cost": 1800,
          "build_time_minutes": 300
        },
        {
          "id": "forge",
          "display_name": "Schmiede",
          "unlock_town_hall_level": 5,
          "function": "Reduziert Upgrade-Kosten für Verteidigungsgebäude zusätzlich zum allgemeinen Zwerge-Rabatt.",
          "wood_cost": 3500,
          "stone_cost": 3000,
          "gold_cost": 200,
          "build_time_minutes": 480
        }
      ],
      "exclusive_units": [
        {
          "id": "axe_dwarf",
          "display_name": "Axtzwerg",
          "unlock_town_hall_level": 4,
          "role": "melee_basic_armored",
          "housing_space": 2,
          "hp": 110,
          "damage_per_second": 15,
          "speed": "slow",
          "cost": { "wood": 80, "stone": 30 },
          "train_time_seconds": 60
        },
        {
          "id": "rune_smith",
          "display_name": "Runenschmied",
          "unlock_town_hall_level": 7,
          "role": "support_buff",
          "housing_space": 4,
          "hp": 90,
          "special_ability": "Erhöht die HP nahestehender Einheiten temporär um 15%.",
          "speed": "slow",
          "cost": { "wood": 180, "gold": 35 },
          "train_time_seconds": 170
        }
      ]
    },

    "elves": {
      "exclusive_buildings": [
        {
          "id": "treetop_lookout",
          "display_name": "Baumwipfel-Ausguck",
          "unlock_town_hall_level": 5,
          "function": "Erhöht Reichweite aller Verteidigungsgebäude in der Nähe leicht.",
          "type": "defense_support",
          "wood_cost": 4000,
          "stone_cost": 1500,
          "build_time_minutes": 420
        }
      ],
      "exclusive_units": [
        {
          "id": "forest_archer",
          "display_name": "Waldschütze",
          "unlock_town_hall_level": 4,
          "role": "ranged_fast",
          "housing_space": 2,
          "hp": 55,
          "damage_per_second": 18,
          "range_tiles": 5,
          "speed": "fast",
          "cost": { "wood": 90 },
          "train_time_seconds": 50
        },
        {
          "id": "blade_dancer",
          "display_name": "Klingentänzer",
          "unlock_town_hall_level": 6,
          "role": "melee_fast_fragile",
          "housing_space": 3,
          "hp": 95,
          "damage_per_second": 24,
          "speed": "very_fast",
          "cost": { "wood": 160, "gold": 10 },
          "train_time_seconds": 110
        }
      ]
    },

    "undead": {
      "exclusive_buildings": [
        {
          "id": "bone_yard",
          "display_name": "Knochenhof",
          "unlock_town_hall_level": 5,
          "function": "Reduziert Rekrutierungskosten für Untoten-Einheiten zusätzlich zum allgemeinen Fraktionsrabatt.",
          "wood_cost": 3000,
          "stone_cost": 2000,
          "build_time_minutes": 420
        }
      ],
      "exclusive_units": [
        {
          "id": "skeleton_soldier",
          "display_name": "Skelettsoldat",
          "unlock_town_hall_level": 3,
          "role": "melee_basic_cheap",
          "housing_space": 1,
          "hp": 50,
          "damage_per_second": 9,
          "speed": "medium",
          "cost": { "wood": 20 },
          "train_time_seconds": 18,
          "special_ability": "Regeneriert 2 HP/Sekunde, solange im Kampf, sofern nicht durch Feuerschaden getroffen."
        },
        {
          "id": "wraith",
          "display_name": "Geist",
          "unlock_town_hall_level": 7,
          "role": "melee_evasive",
          "housing_space": 4,
          "hp": 130,
          "damage_per_second": 20,
          "speed": "fast",
          "special_trait": "10% Chance, gegnerischen Angriffen auszuweichen (Phasing).",
          "cost": { "wood": 150, "gold": 15 },
          "train_time_seconds": 130
        }
      ]
    },

    "orcs": {
      "exclusive_buildings": [
        {
          "id": "war_tent",
          "display_name": "Kriegszelt",
          "unlock_town_hall_level": 5,
          "function": "Beschleunigt Rekrutierung von Nahkampf-Einheiten zusätzlich.",
          "wood_cost": 3500,
          "stone_cost": 2500,
          "build_time_minutes": 420
        }
      ],
      "exclusive_units": [
        {
          "id": "orc_grunt",
          "display_name": "Ork-Schläger",
          "unlock_town_hall_level": 3,
          "role": "melee_basic_aggressive",
          "housing_space": 2,
          "hp": 90,
          "damage_per_second": 17,
          "speed": "medium",
          "cost": { "wood": 60, "stone": 10 },
          "train_time_seconds": 40
        },
        {
          "id": "berserker",
          "display_name": "Berserker",
          "unlock_town_hall_level": 6,
          "role": "melee_glass_cannon",
          "housing_space": 4,
          "hp": 140,
          "damage_per_second": 32,
          "speed": "fast",
          "special_trait": "Schaden steigt um 20%, wenn eigene HP unter 50% fallen (Rage-Mechanik).",
          "cost": { "wood": 200, "stone": 60 },
          "train_time_seconds": 140
        }
      ]
    }
  },

  "skins": {
    "description": "Rein kosmetisch, keine Statwerte. Einziger primärer Goldbarren-Sink neben Bauzeit-Skip.",
    "example_pricing_bars": {
      "unit_skin_common": 80,
      "unit_skin_rare": 200,
      "building_skin_common": 150,
      "building_skin_rare": 350,
      "village_theme_full_set": 1200
    }
  }
}
```
