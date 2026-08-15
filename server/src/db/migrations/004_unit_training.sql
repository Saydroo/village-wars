-- Phase 3: Einheiten-Training.
-- Die units-Tabelle (Migration 001) hält die FERTIGE Armee (quantity je
-- unit_type). Trainings laufen zeitbasiert über eine separate Warteschlange,
-- analog zum Upgrade-/Ressourcen-Settlement aus Phase 2: ein Auftrag wird mit
-- finish_at eingereiht; ein Cron (bzw. Settle-on-Read) verschiebt fertige
-- Aufträge in units. So bleibt die units-Zeile sauber pro Typ.
CREATE TABLE unit_training_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  unit_type VARCHAR(50) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finish_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_unit_training_player ON unit_training_queue (player_id);
CREATE INDEX idx_unit_training_finish ON unit_training_queue (finish_at);

-- Eindeutigkeit der fertigen Armee pro (Spieler, Typ): erleichtert das
-- Aufsummieren beim Settlement (ON CONFLICT ... DO UPDATE).
CREATE UNIQUE INDEX uniq_units_player_type ON units (player_id, unit_type);

-- battles: Bot-Gegner markieren (defender_id ist dann NULL, kein echter Spieler).
ALTER TABLE battles ADD COLUMN is_bot_defender BOOLEAN NOT NULL DEFAULT FALSE;
