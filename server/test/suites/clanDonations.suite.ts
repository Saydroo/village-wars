import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clanCastleHousing, unitHousing } from '@village-wars/shared';
import {
  api,
  registerPlayer,
  setTownHallLevel,
  sql,
  giveUnits,
  getGameConfig,
  uniqueSuffix,
  type TestPlayer,
} from '../harness';

/**
 * Clan-Spenden-Anfragen (Roadmap P9). Testet Anfrage-Erstellung (Burg-Gate,
 * max. eine offene), Auflistung, Spenden (Truppen-Transfer + Fortschritt),
 * Erfüllung, Selbst-Spende-Sperre, Abbruch und Validierung.
 */

let tagCounter = 2000;
function makeTag(): string {
  tagCounter += 1;
  return ('D' + tagCounter.toString(36).toUpperCase()).slice(0, 5).padEnd(3, 'X');
}

function validBanner() {
  const o = getGameConfig().clan.banner_options;
  return {
    shape: o.shapes[0],
    symbol: o.symbols[0],
    primary_color: o.colors[0],
    secondary_color: o.colors[1],
    symbol_color: o.colors[2],
  };
}

function errMsg(body: any): string {
  return body?.error?.message ?? body?.message ?? '';
}

/** Gibt einem Spieler eine Clan-Burg (Level 2) direkt in der DB. */
async function giveCastle(playerId: string, level = 2): Promise<void> {
  await sql(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
     VALUES ($1, 'clan_castle', $2, 7, 7)`,
    [playerId, level],
  );
}

/** Leader mit Clan + Clan-Burg (Level 2). */
async function leaderWithCastle(): Promise<{ leader: TestPlayer; clanId: string }> {
  const leader = await registerPlayer();
  await setTownHallLevel(leader.id, getGameConfig().clan.unlock_town_hall_level);
  const res = await api('POST', '/api/clan/create', {
    token: leader.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await giveCastle(leader.id, 2);
  return { leader, clanId: res.body.clan.id as string };
}

/** TH5-Mitglied im Clan (mit Truppen). */
async function memberWithUnits(clanId: string, militia = 20): Promise<TestPlayer> {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  const join = await api('POST', `/api/clan/join/${clanId}`, { token: p.token });
  assert.equal(join.status, 200, JSON.stringify(join.body));
  await giveUnits(p.id, 'militia', militia);
  return p;
}

test('POST /donations — ohne Clan → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/clan/donations', { token: p.token, body: {} });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /keinem Clan/i);
});

test('POST /donations — ohne Clan-Burg → 400', async () => {
  const leader = await registerPlayer();
  await setTownHallLevel(leader.id, getGameConfig().clan.unlock_town_hall_level);
  await api('POST', '/api/clan/create', {
    token: leader.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
  // keine Burg gebaut
  const res = await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /Clan-Burg/i);
});

test('Anfrage erstellen → 201, capacity gesetzt, received 0, open', async () => {
  const { leader } = await leaderWithCastle();
  const res = await api('POST', '/api/clan/donations', {
    token: leader.token,
    body: { requested_unit_type: 'militia' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'open');
  assert.equal(res.body.received, 0);
  assert.equal(res.body.requested_unit_type, 'militia');
  assert.equal(res.body.username, leader.username);
  assert.equal(res.body.capacity, clanCastleHousing(getGameConfig(), 2));
});

test('Zweite offene Anfrage desselben Spielers → 400', async () => {
  const { leader } = await leaderWithCastle();
  await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  const again = await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  assert.equal(again.status, 400);
  assert.match(errMsg(again.body), /bereits eine offene/i);
});

test('Anfrage mit unbekanntem Wunsch-Einheitstyp → 400', async () => {
  const { leader } = await leaderWithCastle();
  const res = await api('POST', '/api/clan/donations', {
    token: leader.token,
    body: { requested_unit_type: 'gibtsnicht' },
  });
  assert.equal(res.status, 400);
});

test('GET /donations — listet offene Anfragen + my_request', async () => {
  const { leader, clanId } = await leaderWithCastle();
  await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  const member = await memberWithUnits(clanId);

  const asLeader = await api('GET', '/api/clan/donations', { token: leader.token });
  assert.equal(asLeader.status, 200);
  assert.equal(asLeader.body.requests.length, 1);
  assert.ok(asLeader.body.my_request, 'Leader sieht eigene Anfrage als my_request');

  // Mitglied sieht dieselbe Anfrage, aber kein eigenes my_request.
  const asMember = await api('GET', '/api/clan/donations', { token: member.token });
  assert.equal(asMember.body.requests.length, 1);
  assert.equal(asMember.body.my_request, null);
});

test('Spenden → Truppen wandern in Burg, received steigt, Spender-Armee sinkt', async () => {
  const { leader, clanId } = await leaderWithCastle();
  const reqRes = await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  const reqId = reqRes.body.id;
  const member = await memberWithUnits(clanId, 20);

  const donate = await api('POST', `/api/clan/donations/${reqId}/donate`, {
    token: member.token,
    body: { unit_type: 'militia', quantity: 5 },
  });
  assert.equal(donate.status, 200, JSON.stringify(donate.body));
  const housing = unitHousing(getGameConfig(), 'militia');
  assert.equal(donate.body.request.received, 5 * housing);

  // Spender-Armee: 20 → 15.
  const army = await sql<{ quantity: number }>(
    `SELECT quantity FROM units WHERE player_id = $1 AND unit_type = 'militia'`,
    [member.id],
  );
  assert.equal(Number(army[0]!.quantity), 15);

  // Burg des Anfragenden enthält 5 Milizen.
  const cc = await sql<{ quantity: number }>(
    `SELECT quantity FROM clan_castle_defenders WHERE player_id = $1 AND unit_type = 'militia'`,
    [leader.id],
  );
  assert.equal(Number(cc[0]!.quantity), 5);
});

test('Spenden bis zur Kapazität → status fulfilled, fällt aus der Liste', async () => {
  const { leader, clanId } = await leaderWithCastle();
  const reqRes = await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  const reqId = reqRes.body.id;
  const capacity = clanCastleHousing(getGameConfig(), 2);
  const housing = unitHousing(getGameConfig(), 'militia');
  const need = Math.ceil(capacity / housing);
  const member = await memberWithUnits(clanId, need + 5);

  const donate = await api('POST', `/api/clan/donations/${reqId}/donate`, {
    token: member.token,
    body: { unit_type: 'militia', quantity: need },
  });
  assert.equal(donate.status, 200, JSON.stringify(donate.body));
  assert.equal(donate.body.request.status, 'fulfilled');

  // Nicht mehr in der offenen Liste.
  const list = await api('GET', '/api/clan/donations', { token: leader.token });
  assert.equal(list.body.requests.length, 0);
});

test('Spenden auf eigene Anfrage → 400', async () => {
  const { leader } = await leaderWithCastle();
  const reqRes = await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  await giveUnits(leader.id, 'militia', 5);
  const res = await api('POST', `/api/clan/donations/${reqRes.body.id}/donate`, {
    token: leader.token,
    body: { unit_type: 'militia', quantity: 1 },
  });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /eigene Anfrage/i);
});

test('Spenden auf nicht-existente Anfrage → 404', async () => {
  const { clanId } = await leaderWithCastle();
  const member = await memberWithUnits(clanId);
  const res = await api('POST', `/api/clan/donations/00000000-0000-0000-0000-000000000000/donate`, {
    token: member.token,
    body: { unit_type: 'militia', quantity: 1 },
  });
  assert.equal(res.status, 404);
});

test('Spenden aus fremdem Clan → 403', async () => {
  const a = await leaderWithCastle();
  const reqRes = await api('POST', '/api/clan/donations', { token: a.leader.token, body: {} });
  // Spender in einem ANDEREN Clan.
  const b = await leaderWithCastle();
  await giveUnits(b.leader.id, 'militia', 5);
  const res = await api('POST', `/api/clan/donations/${reqRes.body.id}/donate`, {
    token: b.leader.token,
    body: { unit_type: 'militia', quantity: 1 },
  });
  assert.equal(res.status, 403);
});

test('DELETE /donations — eigene Anfrage schließen, dann leere Liste', async () => {
  const { leader } = await leaderWithCastle();
  await api('POST', '/api/clan/donations', { token: leader.token, body: {} });
  const del = await api('DELETE', '/api/clan/donations', { token: leader.token });
  assert.equal(del.status, 200);

  const list = await api('GET', '/api/clan/donations', { token: leader.token });
  assert.equal(list.body.requests.length, 0);
  assert.equal(list.body.my_request, null);
});

test('DELETE /donations — ohne offene Anfrage → 400', async () => {
  const { leader } = await leaderWithCastle();
  const del = await api('DELETE', '/api/clan/donations', { token: leader.token });
  assert.equal(del.status, 400);
});

test('Auth: GET /donations ohne Token → 401', async () => {
  const res = await api('GET', '/api/clan/donations');
  assert.equal(res.status, 401);
});
