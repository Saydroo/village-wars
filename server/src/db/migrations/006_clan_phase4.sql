-- Village Wars — Phase 4 (Clans & Ranglisten).
--
-- Ergaenzt das Clan-Kriegs-/Ranglisten-Schema aus Abschnitt 10/11:
--  * clan_wars.status / ends_at / season_number — Lebenszyklus eines Clan-Kriegs
--    (in_progress -> ended) mit Ablaufzeitpunkt und Saison-Zuordnung.
--  * Index clan_members(player_id) — Mitgliedschafts-Lookup je Spieler.
--  * Unique-Index clan_castle_defenders(player_id, unit_type) — erlaubt das
--    Aufaddieren stationierter Einheiten je Spieler-Burg via UPSERT (Housing).
--  * Aktive Saison 1 wird geseedet (leaderboard_clan ist saisonbasiert).

-- Clan-Krieg-Lebenszyklus
ALTER TABLE clan_wars
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'ended'
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_number INT;

-- Mitgliedschafts-Lookup je Spieler (z.B. "welcher Clan?")
CREATE INDEX IF NOT EXISTS idx_clan_members_player ON clan_members(player_id);

-- Stationierte Burg-Einheiten je Spieler aufaddierbar (UPSERT-Ziel, Housing-Logik)
CREATE UNIQUE INDEX IF NOT EXISTS ux_castle_defenders_player_unit
  ON clan_castle_defenders(player_id, unit_type);

-- Schnellzugriff auf laufende Kriege eines Clans
CREATE INDEX IF NOT EXISTS idx_clan_wars_status ON clan_wars(status);
CREATE INDEX IF NOT EXISTS idx_clan_wars_clan_a ON clan_wars(clan_a_id);
CREATE INDEX IF NOT EXISTS idx_clan_wars_clan_b ON clan_wars(clan_b_id);

-- Aktive Saison 1 sicherstellen (idempotent). leaderboard_clan referenziert season_number.
INSERT INTO seasons (season_number, started_at, is_active)
VALUES (1, NOW(), TRUE)
ON CONFLICT (season_number) DO NOTHING;
