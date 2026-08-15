import type { ClanDonationListResponse, ClanDonationRequest } from '@village-wars/shared';
import { unitHousing } from '@village-wars/shared';
import { query } from '../db/pool';
import { badRequest, notFound } from '../utils/httpError';
import { getGameConfig } from '../gameConfig';
import { getMembership, getCastle, donateToCastle } from './clanService';

/**
 * Clan-Spenden-Anfragen (Roadmap P9, Sozial-Ausbau). Ein Mitglied öffnet eine
 * Truppen-Anfrage (max. eine offene je Spieler); Clan-Kameraden spenden in seine
 * Clan-Burg über die vorhandene `donateToCastle`-Logik. Der Fortschritt
 * (received/capacity, in Housing) wird je Anfrage atomar mitgezählt; bei voller
 * Kapazität gilt die Anfrage als erfüllt.
 */

function mapRequest(row: Record<string, unknown>): ClanDonationRequest {
  return {
    id: String(row.id),
    clan_id: String(row.clan_id),
    player_id: String(row.player_id),
    username: String(row.username),
    requested_unit_type: row.requested_unit_type ? String(row.requested_unit_type) : null,
    capacity: Number(row.capacity),
    received: Number(row.received),
    status: row.status as 'open' | 'fulfilled',
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

/** Öffnet eine Spenden-Anfrage für den eigenen Clan (Burg erforderlich). */
export async function createDonationRequest(
  playerId: string,
  input: { requested_unit_type?: string },
): Promise<ClanDonationRequest> {
  const config = getGameConfig();
  const membership = await getMembership(playerId);
  if (!membership) throw badRequest('Du bist in keinem Clan');

  if (input.requested_unit_type && unitHousing(config, input.requested_unit_type) <= 0) {
    throw badRequest(`Unbekannte Einheit: ${input.requested_unit_type}`);
  }

  const castle = await getCastle(playerId);
  if (castle.housing_capacity <= 0) {
    throw badRequest('Du brauchst eine (fertige) Clan-Burg, um Truppen anzufordern');
  }

  // Höchstens eine offene Anfrage je Spieler (Partial-Unique-Index sichert das zusätzlich).
  const existing = await query(
    `SELECT 1 FROM clan_donation_requests WHERE player_id = $1 AND status = 'open'`,
    [playerId],
  );
  if (existing.rows.length > 0) throw badRequest('Du hast bereits eine offene Anfrage');

  const ins = await query(
    `INSERT INTO clan_donation_requests (clan_id, player_id, requested_unit_type, capacity)
     VALUES ($1, $2, $3, $4)
     RETURNING id, clan_id, player_id, requested_unit_type, capacity, received, status, created_at`,
    [membership.clanId, playerId, input.requested_unit_type ?? null, castle.housing_capacity],
  );
  const row = ins.rows[0] as Record<string, unknown>;
  const pr = await query(`SELECT username FROM players WHERE id = $1`, [playerId]);
  row.username = (pr.rows[0] as { username: string }).username;
  return mapRequest(row);
}

/** Offene Anfragen des eigenen Clans + eigene offene Anfrage. */
export async function listDonationRequests(playerId: string): Promise<ClanDonationListResponse> {
  const membership = await getMembership(playerId);
  if (!membership) throw badRequest('Du bist in keinem Clan');

  const res = await query(
    `SELECT r.id, r.clan_id, r.player_id, p.username, r.requested_unit_type,
            r.capacity, r.received, r.status, r.created_at
       FROM clan_donation_requests r
       JOIN players p ON p.id = r.player_id
      WHERE r.clan_id = $1 AND r.status = 'open'
      ORDER BY r.created_at ASC`,
    [membership.clanId],
  );
  const requests = res.rows.map((r) => mapRequest(r as Record<string, unknown>));
  const my = requests.find((r) => r.player_id === playerId) ?? null;
  return { requests, my_request: my };
}

/**
 * Spendet Truppen auf eine offene Anfrage (Truppen wandern in die Burg des
 * Anfragenden). Nutzt die geprüfte `donateToCastle`-Logik (gleicher Clan, Housing-
 * Cap, Armee-Bestand) und zählt den Fortschritt atomar mit.
 */
export async function donateToRequest(
  donorId: string,
  requestId: string,
  input: { unit_type: string; quantity: number },
): Promise<ClanDonationRequest> {
  const config = getGameConfig();

  const rres = await query(
    `SELECT id, clan_id, player_id, requested_unit_type, capacity, received, status, created_at
       FROM clan_donation_requests WHERE id = $1`,
    [requestId],
  );
  const reqRow = rres.rows[0] as Record<string, unknown> | undefined;
  if (!reqRow || reqRow.status !== 'open') throw notFound('Keine offene Anfrage');
  if (String(reqRow.player_id) === donorId) {
    throw badRequest('Du kannst nicht auf deine eigene Anfrage spenden');
  }

  // Truppen-Transfer in die Burg des Anfragenden (prüft Clan/Housing/Armee).
  await donateToCastle(donorId, {
    unit_type: input.unit_type,
    quantity: input.quantity,
    target_player_id: String(reqRow.player_id),
  });

  // Fortschritt atomar erhöhen + ggf. als erfüllt markieren.
  const delta = unitHousing(config, input.unit_type) * input.quantity;
  const upd = await query(
    `UPDATE clan_donation_requests
        SET received = received + $1,
            status = CASE WHEN received + $1 >= capacity THEN 'fulfilled' ELSE status END,
            fulfilled_at = CASE WHEN received + $1 >= capacity AND fulfilled_at IS NULL
                                THEN NOW() ELSE fulfilled_at END
      WHERE id = $2
      RETURNING id, clan_id, player_id, requested_unit_type, capacity, received, status, created_at`,
    [delta, requestId],
  );
  const row = upd.rows[0] as Record<string, unknown>;
  const pr = await query(`SELECT username FROM players WHERE id = $1`, [row.player_id]);
  row.username = (pr.rows[0] as { username: string }).username;
  return mapRequest(row);
}

/** Schließt die eigene offene Anfrage (manuell). */
export async function cancelDonationRequest(playerId: string): Promise<void> {
  const res = await query(
    `UPDATE clan_donation_requests
        SET status = 'fulfilled', fulfilled_at = NOW()
      WHERE player_id = $1 AND status = 'open'
      RETURNING id`,
    [playerId],
  );
  if (res.rows.length === 0) throw badRequest('Keine offene Anfrage');
}
