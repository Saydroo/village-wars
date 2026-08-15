import type { ClanChatMessage, ClanChatResponse } from '@village-wars/shared';
import { query } from '../db/pool';
import { badRequest } from '../utils/httpError';
import { getMembership } from './clanService';
import { getIO } from '../sockets/index';

/**
 * Clan-Chat (Roadmap P9, Sozial-Ausbau). Persistente Nachrichten je Clan,
 * server-autoritativ über REST. Beim Senden wird die Nachricht zusätzlich live
 * an alle online verbundenen Clan-Mitglieder gepusht (Socket-Room `clan:<id>`).
 * Nur Clan-Mitglieder dürfen lesen/schreiben (eigener Clan).
 */

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function mapMessage(row: Record<string, unknown>): ClanChatMessage {
  return {
    id: String(row.id),
    clan_id: String(row.clan_id),
    player_id: row.player_id ? String(row.player_id) : null,
    username: String(row.username),
    body: String(row.body),
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

/** Socket-Room-Name eines Clans (Live-Chat-Broadcast). */
export function clanRoom(clanId: string): string {
  return `clan:${clanId}`;
}

/**
 * Verlauf des eigenen Clans (neueste zuerst, paginiert). `before` = ISO-Zeitstempel
 * (created_at) der ältesten bereits geladenen Nachricht, um weiter zurückzublättern.
 */
export async function getClanMessages(
  playerId: string,
  before?: string,
  limit = DEFAULT_LIMIT,
): Promise<ClanChatResponse> {
  const membership = await getMembership(playerId);
  if (!membership) throw badRequest('Du bist in keinem Clan');

  const lim = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT));
  const beforeTs = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : null;

  // lim+1 laden, um has_more zu bestimmen.
  const res = await query(
    `SELECT id, clan_id, player_id, username, body, created_at
       FROM clan_messages
      WHERE clan_id = $1
        AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    [membership.clanId, beforeTs, lim + 1],
  );

  const rows = res.rows as Array<Record<string, unknown>>;
  const hasMore = rows.length > lim;
  const messages = rows.slice(0, lim).map(mapMessage);
  return { messages, has_more: hasMore };
}

/**
 * Sendet eine Nachricht im eigenen Clan. Persistiert + broadcastet live an den
 * Clan-Room. `body` ist bereits via Zod getrimmt/längenvalidiert (1..500).
 */
export async function postClanMessage(playerId: string, body: string): Promise<ClanChatMessage> {
  const membership = await getMembership(playerId);
  if (!membership) throw badRequest('Du bist in keinem Clan');

  // Username-Snapshot des Absenders.
  const pr = await query(`SELECT username FROM players WHERE id = $1`, [playerId]);
  const username = (pr.rows[0] as { username: string } | undefined)?.username;
  if (!username) throw badRequest('Spieler nicht gefunden');

  const ins = await query(
    `INSERT INTO clan_messages (clan_id, player_id, username, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, clan_id, player_id, username, body, created_at`,
    [membership.clanId, playerId, username, body],
  );
  const message = mapMessage(ins.rows[0] as Record<string, unknown>);

  // Live-Push an alle online verbundenen Clan-Mitglieder (best effort).
  getIO()?.to(clanRoom(membership.clanId)).emit('clanchat:message', message);

  return message;
}
