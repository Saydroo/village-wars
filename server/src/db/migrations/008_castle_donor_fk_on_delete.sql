-- Village Wars — Phase 4: FK-Verhalten für gelöschte Spender.
--
-- clan_castle_defenders.donated_by referenzierte players(id) OHNE ON DELETE.
-- Spendet Spieler A Truppen in die Burg von Spieler B und wird A später gelöscht,
-- schlug DELETE players(A) an dieser FK fehl (donated_by zeigt noch auf A), obwohl
-- die Truppen B gehören. Analog zur clan_wars-Korrektur (007): ON DELETE SET NULL —
-- die stationierten Einheiten bleiben erhalten, nur der Spender-Verweis wird genullt.
-- (clan_castle_defenders.player_id cascadet bereits aus Migration 001.)

ALTER TABLE clan_castle_defenders DROP CONSTRAINT IF EXISTS clan_castle_defenders_donated_by_fkey;
ALTER TABLE clan_castle_defenders
  ADD CONSTRAINT clan_castle_defenders_donated_by_fkey
  FOREIGN KEY (donated_by) REFERENCES players(id) ON DELETE SET NULL;
