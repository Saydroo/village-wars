-- Migration 018: Clan-Chat (Roadmap P9, Sozial-Ausbau)
-- Persistente Chat-Nachrichten je Clan. username wird als Snapshot gespeichert,
-- damit Nachrichten auch nach Austritt/Löschung des Absenders lesbar bleiben
-- (player_id-FK auf ON DELETE SET NULL). Verlauf wird neueste-zuerst paginiert.

CREATE TABLE clan_messages (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id    UUID         NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  player_id  UUID         REFERENCES players(id) ON DELETE SET NULL,
  username   VARCHAR(50)  NOT NULL,
  body       VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Verlauf eines Clans, neueste zuerst (Paginierung über created_at/id).
CREATE INDEX clan_messages_clan_created ON clan_messages(clan_id, created_at DESC, id DESC);
