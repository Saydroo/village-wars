-- Village Wars — Phase 5 (Dungeon, Shop/Skins, IAP, Saison-Reset).
--
-- Ergaenzungen zum Schema aus Abschnitt 3 fuer Phase 5:
--  * dungeon_runs: Lebenszyklus-Status + Armee-Snapshots, damit ein Lauf
--    server-autoritativ ueber mehrere Wellen (REST) fortgesetzt werden kann
--    (Spieler darf zwischen Wellen pausieren — Abschnitt 9).
--  * player_skins.is_active: angewandter (kosmetischer) Skin je Ziel.
--  * iap_transactions: idempotente Goldbarren-Gutschrift (verhindert
--    Doppel-Gutschrift desselben Belegs/derselben Transaktion).

-- Dungeon-Lauf-Zustand (PvE, mehrere Wellen pro Lauf)
ALTER TABLE dungeon_runs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'won' | 'lost'
  ADD COLUMN IF NOT EXISTS army_snapshot JSONB,   -- eingesetzte Armee beim Start (unit_type -> Anzahl)
  ADD COLUMN IF NOT EXISTS army_remaining JSONB;   -- aktuell ueberlebende Armee (zwischen den Wellen)

CREATE INDEX IF NOT EXISTS idx_dungeon_runs_player_week ON dungeon_runs(player_id, season_week);

-- Angewandter Skin je Spieler/Ziel (rein kosmetisch; nur einer pro Ziel aktiv)
ALTER TABLE player_skins
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

-- In-App-Kauf-Transaktionen (idempotente Goldbarren-Gutschrift)
CREATE TABLE IF NOT EXISTS iap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  platform VARCHAR(10) NOT NULL,            -- 'apple' | 'google'
  product_id VARCHAR(100) NOT NULL,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  bars_credited INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iap_transactions_player ON iap_transactions(player_id);
