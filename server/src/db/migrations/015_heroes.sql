-- Migration 015: Helden-System (Roadmap P6)
-- Speichert den Helden-Stand je Spieler (Level, Regen-Status) und die Upgrade-Queue.

CREATE TABLE heroes (
  player_id      UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE PRIMARY KEY,
  level          SMALLINT     NOT NULL DEFAULT 1 CHECK (level >= 1),
  regenerates_at TIMESTAMPTZ              -- null = bereit für Einsatz
);

CREATE TABLE hero_level_queue (
  player_id   UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE PRIMARY KEY,
  target_level SMALLINT    NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finishes_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX hero_level_queue_finishes ON hero_level_queue(finishes_at);
