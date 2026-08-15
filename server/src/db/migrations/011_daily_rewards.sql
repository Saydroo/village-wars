-- Roadmap P1 — Tägliche Login-Belohnung + Streak (Retention).
-- Eine Zeile pro Spieler; last_claim_date ist ein Europe/Berlin-Kalendertag.

CREATE TABLE player_daily_rewards (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  streak INT NOT NULL DEFAULT 0,            -- abgeholte Tage in Folge
  longest_streak INT NOT NULL DEFAULT 0,    -- bester je erreichter Streak
  last_claim_date DATE,                     -- letzter Abhol-Tag (Berlin), NULL = nie
  total_claims INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
