import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  registerPlayer,
  setTownHallLevel,
  getGameConfig,
  uniqueSuffix,
  type TestPlayer,
} from '../harness';

/**
 * Clan-Chat (Roadmap P9). Testet Senden/Lesen, Mitgliedschafts-Gate,
 * Clan-Isolation, Paginierung und Validierung gegen echtes Postgres.
 */

let tagCounter = 1000;
function makeTag(): string {
  tagCounter += 1;
  return ('K' + tagCounter.toString(36).toUpperCase()).slice(0, 5).padEnd(3, 'X');
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

/** Erstellt einen Clan und gibt Leader + clanId zurück. */
async function clanWithLeader(): Promise<{ leader: TestPlayer; clanId: string }> {
  const leader = await registerPlayer();
  await setTownHallLevel(leader.id, getGameConfig().clan.unlock_town_hall_level);
  const res = await api('POST', '/api/clan/create', {
    token: leader.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { leader, clanId: res.body.clan.id as string };
}

/** Registriert einen Spieler (TH5) und lässt ihn dem Clan beitreten. */
async function memberOf(clanId: string): Promise<TestPlayer> {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  const join = await api('POST', `/api/clan/join/${clanId}`, { token: p.token });
  assert.equal(join.status, 200, JSON.stringify(join.body));
  return p;
}

function errMsg(body: any): string {
  return body?.error?.message ?? body?.message ?? '';
}

test('POST /api/clan/chat — ohne Clan → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/clan/chat', { token: p.token, body: { body: 'hallo' } });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /keinem Clan/i);
});

test('GET /api/clan/chat — ohne Clan → 400', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/clan/chat', { token: p.token });
  assert.equal(res.status, 400);
});

test('Mitglied sendet Nachricht → 201 mit username/body/player_id', async () => {
  const { leader } = await clanWithLeader();
  const res = await api('POST', '/api/clan/chat', {
    token: leader.token,
    body: { body: 'Willkommen im Clan!' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const m = res.body.message;
  assert.equal(m.body, 'Willkommen im Clan!');
  assert.equal(m.username, leader.username);
  assert.equal(m.player_id, leader.id);
  assert.ok(m.id && m.created_at, 'id + created_at gesetzt');
});

test('GET liefert gesendete Nachrichten, neueste zuerst', async () => {
  const { leader } = await clanWithLeader();
  await api('POST', '/api/clan/chat', { token: leader.token, body: { body: 'erste' } });
  await api('POST', '/api/clan/chat', { token: leader.token, body: { body: 'zweite' } });
  await api('POST', '/api/clan/chat', { token: leader.token, body: { body: 'dritte' } });

  const res = await api('GET', '/api/clan/chat', { token: leader.token });
  assert.equal(res.status, 200);
  const bodies = res.body.messages.map((m: any) => m.body);
  assert.deepEqual(bodies, ['dritte', 'zweite', 'erste'], 'neueste zuerst');
  assert.equal(res.body.has_more, false);
});

test('Zwei Mitglieder teilen denselben Verlauf', async () => {
  const { leader, clanId } = await clanWithLeader();
  const member = await memberOf(clanId);

  await api('POST', '/api/clan/chat', { token: leader.token, body: { body: 'vom Leader' } });
  await api('POST', '/api/clan/chat', { token: member.token, body: { body: 'vom Mitglied' } });

  const asMember = await api('GET', '/api/clan/chat', { token: member.token });
  const bodies = asMember.body.messages.map((m: any) => m.body);
  assert.deepEqual(bodies, ['vom Mitglied', 'vom Leader']);
});

test('Clan-Isolation: fremder Clan sieht die Nachrichten nicht', async () => {
  const a = await clanWithLeader();
  const b = await clanWithLeader();
  await api('POST', '/api/clan/chat', { token: a.leader.token, body: { body: 'geheim A' } });

  const bView = await api('GET', '/api/clan/chat', { token: b.leader.token });
  assert.equal(bView.status, 200);
  assert.equal(bView.body.messages.length, 0, 'Clan B sieht nichts von Clan A');
});

test('Paginierung: has_more + before blättert zurück', async () => {
  const { leader } = await clanWithLeader();
  // 5 Nachrichten senden.
  for (let i = 1; i <= 5; i++) {
    await api('POST', '/api/clan/chat', { token: leader.token, body: { body: `m${i}` } });
  }
  // limit=2 → neueste 2 (m5, m4), has_more true.
  const page1 = await api('GET', '/api/clan/chat?limit=2', { token: leader.token });
  assert.equal(page1.body.messages.length, 2);
  assert.deepEqual(page1.body.messages.map((m: any) => m.body), ['m5', 'm4']);
  assert.equal(page1.body.has_more, true);

  // before = created_at der ältesten geladenen (m4) → m3, m2.
  const oldest = page1.body.messages[1].created_at;
  const page2 = await api('GET', `/api/clan/chat?limit=2&before=${encodeURIComponent(oldest)}`, {
    token: leader.token,
  });
  assert.deepEqual(page2.body.messages.map((m: any) => m.body), ['m3', 'm2']);
  assert.equal(page2.body.has_more, true);
});

test('Validierung: leerer body → 400', async () => {
  const { leader } = await clanWithLeader();
  const res = await api('POST', '/api/clan/chat', { token: leader.token, body: { body: '   ' } });
  assert.equal(res.status, 400);
});

test('Validierung: body > 500 Zeichen → 400', async () => {
  const { leader } = await clanWithLeader();
  const res = await api('POST', '/api/clan/chat', {
    token: leader.token,
    body: { body: 'x'.repeat(501) },
  });
  assert.equal(res.status, 400);
});

test('body wird getrimmt gespeichert', async () => {
  const { leader } = await clanWithLeader();
  const res = await api('POST', '/api/clan/chat', {
    token: leader.token,
    body: { body: '  randständig  ' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.message.body, 'randständig');
});

test('Auth: GET /api/clan/chat ohne Token → 401', async () => {
  const res = await api('GET', '/api/clan/chat');
  assert.equal(res.status, 401);
});

test('Auth: POST /api/clan/chat ohne Token → 401', async () => {
  const res = await api('POST', '/api/clan/chat', { body: { body: 'hi' } });
  assert.equal(res.status, 401);
});
