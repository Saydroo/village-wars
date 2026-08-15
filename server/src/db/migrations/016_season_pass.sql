-- Migration 016: Season-/Battle-Pass (Roadmap P7)
-- Pass-Fortschritt (XP + Premium-Freischaltung) je Spieler und Saison, plus
-- abgeholte Stufen je Track (free/premium). An die seasons-Tabelle gekoppelt:
-- bei einem Saison-Reset (neue season_number) beginnt der Pass automatisch neu
-- (neue Zeilen), die alten bleiben als Historie erhalten.

CREATE TABLE season_pass_progress (
  player_id        UUID    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_number    INT     NOT NULL,
  xp               INT     NOT NULL DEFAULT 0 CHECK (xp >= 0),
  premium_unlocked BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, season_number)
);

CREATE TABLE season_pass_claims (
  player_id     UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_number INT         NOT NULL,
  tier          SMALLINT    NOT NULL,
  track         VARCHAR(10) NOT NULL CHECK (track IN ('free', 'premium')),
  claimed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season_number, tier, track)
);

CREATE INDEX season_pass_claims_player_season
  ON season_pass_claims(player_id, season_number);
