-- Phase 2: Zeitbasierte Ressourcenproduktion.
-- resources_updated_at markiert, bis wann die passive Produktion eines Spielers
-- bereits gutgeschrieben wurde. Der Ressourcen-Tick (Cron) und Settle-on-Read
-- berechnen die seither verstrichene Zeit und schreiben die Produktion gut.
ALTER TABLE players
  ADD COLUMN resources_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
