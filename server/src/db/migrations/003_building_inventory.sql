-- Phase 2: Gebäude-Inventar.
-- Statt ein Gebäude endgültig zu löschen, kann es eingelagert werden: Typ und
-- Stufe bleiben erhalten, das Gebäude verschwindet vom Grid und kann später
-- kostenlos wieder platziert werden. Das ist eine bewusste Erweiterung über das
-- Briefing hinaus (vom Nutzer gewünscht).
CREATE TABLE building_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  building_type VARCHAR(50) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_building_inventory_player ON building_inventory (player_id);
