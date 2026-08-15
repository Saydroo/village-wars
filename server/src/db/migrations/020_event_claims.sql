-- Migration 020: Limited-Time-Event-Aufgaben-Claims (Roadmap P7-Folge)
-- Speichert pro Spieler nur die abgeholten Event-Aufgaben (event_id+challenge_id).
-- Der Fortschritt wird live aus dem Spielstand SEIT Event-Start berechnet
-- (gewonnene Kämpfe/Dungeons), daher keine Fortschrittsspalte. Eine Aufgabe ist
-- nur einmal und nur solange das Event aktiv ist abholbar.

CREATE TABLE player_event_claims (
  player_id    UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id     VARCHAR(50)  NOT NULL,
  challenge_id VARCHAR(50)  NOT NULL,
  claimed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, event_id, challenge_id)
);
