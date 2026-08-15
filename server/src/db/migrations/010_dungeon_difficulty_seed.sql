-- Village Wars — Dungeon: Schwierigkeitsstufen + geseedete Zufallswellen.
--
-- difficulty: bei Start gewählte Schwierigkeit (skaliert Gegner + Belohnung).
-- seed: Zufalls-Seed des Laufs — die Wellen werden daraus deterministisch
--   generiert (gleicher Seed → gleiche Wellen), sodass jeder Lauf andere,
--   vorab verborgene Gegner hat.

ALTER TABLE dungeon_runs
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS seed BIGINT NOT NULL DEFAULT 0;
