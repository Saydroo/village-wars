-- Migration 019: Clan-Spenden-Anfragen (Roadmap P9, Sozial-Ausbau)
-- Ein Mitglied öffnet eine Truppen-Anfrage; Clan-Kameraden spenden in seine
-- Clan-Burg (vorhandene donate-Logik). `capacity` = Burg-Housing zum Anfrage-
-- zeitpunkt (fix), `received` = kumulativ über diese Anfrage gespendetes Housing.
-- Eine Anfrage gilt als 'fulfilled', sobald received >= capacity (oder manuell).

CREATE TABLE clan_donation_requests (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id             UUID         NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  player_id           UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  requested_unit_type VARCHAR(50),
  capacity            INT          NOT NULL,
  received            INT          NOT NULL DEFAULT 0 CHECK (received >= 0),
  status              VARCHAR(10)  NOT NULL DEFAULT 'open',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fulfilled_at        TIMESTAMPTZ
);

-- Höchstens eine offene Anfrage je Spieler.
CREATE UNIQUE INDEX clan_donation_one_open ON clan_donation_requests(player_id) WHERE status = 'open';
-- Offene Anfragen eines Clans schnell auflisten.
CREATE INDEX clan_donation_clan_open ON clan_donation_requests(clan_id) WHERE status = 'open';
