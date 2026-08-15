-- Migration 017: Onboarding / Tutorial (Roadmap P8)
-- Speichert pro Spieler nur die Anzahl bereits abgeholter Tutorial-Schritte
-- (claimed_steps); der Fortschritt der einzelnen Schritte wird live aus dem
-- Spielstand berechnet (wie bei Achievements, keine Event-Instrumentierung).
-- Schritte werden strikt der Reihe nach abgeholt. completed_at wird gesetzt,
-- sobald alle Schritte abgeholt sind. Die Zeile entsteht beim ersten Claim.

CREATE TABLE player_onboarding (
  player_id     UUID         PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  claimed_steps INT          NOT NULL DEFAULT 0 CHECK (claimed_steps >= 0),
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
