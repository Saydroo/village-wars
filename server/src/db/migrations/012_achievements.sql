-- Roadmap P2 — Achievements (Ziele + verdienbare Belohnungen).
-- Speichert pro Spieler/Achievement nur die HÖCHSTE bereits abgeholte Stufe;
-- der Fortschritt (Metrik-Wert) wird live aus dem Spielstand berechnet.

CREATE TABLE player_achievements (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  achievement_id VARCHAR(50) NOT NULL,
  claimed_tier INT NOT NULL DEFAULT 0,   -- Anzahl abgeholter Stufen
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, achievement_id)
);
