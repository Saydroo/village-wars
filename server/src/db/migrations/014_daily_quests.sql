-- Migration 014: Daily Quests (Roadmap P4)
-- Fortschritt + Claim-Status je Spieler, Quest-ID und UTC-Tag.
-- Zeilen entstehen beim ersten Inkrementieren; bei Tageswechsel neue Zeile.

CREATE TABLE daily_quest_progress (
  player_id  UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_id   VARCHAR(50)  NOT NULL,
  quest_date DATE         NOT NULL DEFAULT CURRENT_DATE,
  progress   INT          NOT NULL DEFAULT 0 CHECK (progress >= 0),
  claimed    BOOLEAN      NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, quest_id, quest_date)
);

CREATE INDEX daily_quest_progress_date ON daily_quest_progress(quest_date);
