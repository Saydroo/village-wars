-- Village Wars — Initiales Schema (Abschnitt 3 des Briefings).
--
-- Hinweise zur Reihenfolge:
--  * players.clan_id <-> clans.leader_id bilden einen zirkulaeren Fremdschluessel.
--    Daher wird players.clan_id zunaechst ohne FK angelegt und am Ende per
--    ALTER TABLE ergaenzt.
--  * clan_wars wird vor battles angelegt (battles referenziert clan_wars).
--
-- Zusatz ggue. Briefing-Schema:
--  * players.password_hash — notwendig fuer auth_provider='email'
--    (Registrierung/Login mit Passwort). Bei OAuth bleibt es NULL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Spieler
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),            -- nur bei auth_provider='email'
  auth_provider VARCHAR(20) NOT NULL,    -- 'apple' | 'google' | 'email'
  auth_provider_id VARCHAR(255),
  faction VARCHAR(20) NOT NULL,          -- 'humans'|'fishfolk'|'giants'|'dwarves'|'elves'|'undead'|'orcs'|'dragonfolk'
  village_level INT DEFAULT 1,
  trophies INT DEFAULT 0,
  gold_bars INT DEFAULT 0,               -- Premium-Waehrung
  wood BIGINT DEFAULT 500,
  stone BIGINT DEFAULT 300,
  gold BIGINT DEFAULT 0,
  gems BIGINT DEFAULT 0,
  clan_id UUID,                          -- FK wird am Ende ergaenzt
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doerfer (Grid-Layout)
CREATE TABLE villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  grid_width INT DEFAULT 30,
  grid_height INT DEFAULT 30,
  layout JSONB DEFAULT '[]',             -- Array von {building_id, grid_x, grid_y}
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gebaeude-Instanzen
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  building_type VARCHAR(50) NOT NULL,
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
  tag VARCHAR(5) UNIQUE NOT NULL,        -- 3-5 Zeichen, moderiert
  banner JSONB NOT NULL,                 -- {shape, colors, symbol} Baukasten
  leader_id UUID REFERENCES players(id),
  season_points INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clan-Mitglieder
CREATE TABLE clan_members (
  clan_id UUID REFERENCES clans(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',     -- 'leader' | 'co_leader' | 'member'
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

-- Clan-Kriege (vor battles, da battles darauf referenziert)
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

-- PvP-Kaempfe
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID REFERENCES players(id),
  defender_id UUID REFERENCES players(id),
  mode VARCHAR(20) NOT NULL,             -- 'solo' | 'clan_war'
  clan_war_id UUID REFERENCES clan_wars(id),
  result VARCHAR(10),                    -- 'attacker_win' | 'defender_win' | 'draw'
  attacker_destruction_pct INT DEFAULT 0,
  defender_destruction_pct INT DEFAULT 0,
  loot_wood BIGINT DEFAULT 0,
  loot_stone BIGINT DEFAULT 0,
  trophies_change INT DEFAULT 0,
  duration_seconds INT,
  replay JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Solo-Rangliste (Snapshot)
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
  target_type VARCHAR(20) NOT NULL,      -- 'unit' | 'building' | 'village_theme'
  target_id VARCHAR(50) NOT NULL,
  rarity VARCHAR(20) NOT NULL,           -- 'common' | 'rare'
  price_bars INT NOT NULL,
  preview_data JSONB
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

-- Zirkulaeren FK players.clan_id -> clans.id nachtraeglich ergaenzen
ALTER TABLE players
  ADD CONSTRAINT players_clan_id_fkey
  FOREIGN KEY (clan_id) REFERENCES clans(id);

-- Indizes
CREATE INDEX idx_buildings_player ON buildings(player_id);
CREATE INDEX idx_battles_attacker ON battles(attacker_id);
CREATE INDEX idx_battles_defender ON battles(defender_id);
CREATE INDEX idx_leaderboard_solo_trophies ON leaderboard_solo(trophies DESC);
CREATE INDEX idx_leaderboard_clan_season ON leaderboard_clan(season_number, season_points DESC);
CREATE INDEX idx_players_clan ON players(clan_id);
CREATE INDEX idx_units_player ON units(player_id);
