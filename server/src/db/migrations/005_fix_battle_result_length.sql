-- Phase 3: Schema-Korrektur.
-- Das Briefing-Schema (Abschnitt 3) definiert battles.result als VARCHAR(10),
-- die dort vorgegebenen Werte 'attacker_win' / 'defender_win' sind aber 12
-- Zeichen lang. Das ist ein Fehler in der Spec; wir weiten die Spalte auf
-- VARCHAR(20) (bewusste, dokumentierte Abweichung — analog players.password_hash).
ALTER TABLE battles ALTER COLUMN result TYPE VARCHAR(20);
