-- Village Wars — Phase 4: FK-Verhalten für Clan-Auflösung.
--
-- clan_wars referenziert clans (clan_a_id/clan_b_id/winner_clan_id) bislang OHNE
-- ON DELETE. Löst der letzte Spieler einen Clan auf (leaveClan-Disband), der je in
-- einem (auch beendeten) Krieg war, würde DELETE clans an diesen FKs scheitern.
-- Lösung: ON DELETE SET NULL — historische Kriegszeilen bleiben erhalten, ihre
-- Clan-Verweise werden genullt (battles.clan_war_id bleibt gültig). leaderboard_clan
-- cascadet bereits (aus Migration 001).

ALTER TABLE clan_wars DROP CONSTRAINT IF EXISTS clan_wars_clan_a_id_fkey;
ALTER TABLE clan_wars
  ADD CONSTRAINT clan_wars_clan_a_id_fkey
  FOREIGN KEY (clan_a_id) REFERENCES clans(id) ON DELETE SET NULL;

ALTER TABLE clan_wars DROP CONSTRAINT IF EXISTS clan_wars_clan_b_id_fkey;
ALTER TABLE clan_wars
  ADD CONSTRAINT clan_wars_clan_b_id_fkey
  FOREIGN KEY (clan_b_id) REFERENCES clans(id) ON DELETE SET NULL;

ALTER TABLE clan_wars DROP CONSTRAINT IF EXISTS clan_wars_winner_clan_id_fkey;
ALTER TABLE clan_wars
  ADD CONSTRAINT clan_wars_winner_clan_id_fkey
  FOREIGN KEY (winner_clan_id) REFERENCES clans(id) ON DELETE SET NULL;
