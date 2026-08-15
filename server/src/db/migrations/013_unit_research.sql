-- Migration 013: Truppen-Level-Forschung (Roadmap P3)
-- Zwei Tabellen:
--   unit_research   – dauerhafter Stand: je Spieler × Einheitstyp → aktuelles Level
--   research_queue  – aktive Forschung (max. 1 pro Spieler, UNIQUE player_id)

CREATE TABLE unit_research (
  player_id  UUID      NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  unit_type  VARCHAR(50) NOT NULL,
  level      SMALLINT  NOT NULL DEFAULT 1 CHECK (level >= 1),
  PRIMARY KEY (player_id, unit_type)
);

CREATE TABLE research_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID        NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  unit_type    VARCHAR(50) NOT NULL,
  target_level SMALLINT    NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finishes_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX research_queue_finishes_at ON research_queue(finishes_at);
