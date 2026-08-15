-- Größeres, CoC-großzügiges Dorf-Grid. Die alten 30×30 waren für die kleinen
-- Alt-Sprites gedacht; mit den weltmaßstäblichen sockellosen Gebäuden (2–4
-- Kacheln Grundfläche) braucht es deutlich mehr Fläche, damit Gebäude mit Luft
-- dazwischen stehen und Platz zum Weiterbauen bleibt. 44×44 ≈ Clash-of-Clans.
ALTER TABLE villages ALTER COLUMN grid_width SET DEFAULT 44;
ALTER TABLE villages ALTER COLUMN grid_height SET DEFAULT 44;

-- Bestehende Dörfer mitziehen (nur vergrößern, nie verkleinern).
UPDATE villages SET grid_width = 44 WHERE grid_width < 44;
UPDATE villages SET grid_height = 44 WHERE grid_height < 44;
