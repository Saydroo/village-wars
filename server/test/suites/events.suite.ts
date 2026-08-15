import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql } from '../harness';

/**
 * Limited-Time-Events (Roadmap P7-Folge). Das Config-Event `summer_clash_2026`
 * (01.06.–01.09.2026) ist zur Testlaufzeit aktiv. Aufgaben-Fortschritt wird live
 * SEIT Event-Start gezählt — Kämpfe/Dungeons werden direkt per SQL geseedet.
 */

function errMsg(body: any): string {
  return body?.error?.message ?? body?.message ?? '';
}

/** Trägt N gewonnene Solo-Kämpfe ein (zählen als battles_won seit Event-Start). */
async function seedWins(playerId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await sql(
      `INSERT INTO battles (attacker_id, mode, result, started_at)
       VALUES ($1, 'solo', 'attacker_win', NOW())`,
      [playerId],
    );
  }
}

/** Trägt N gewonnene Dungeon-Läufe ein. */
async function seedDungeons(playerId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await sql(
      `INSERT INTO dungeon_runs (player_id, season_week, status, started_at)
       VALUES ($1, CURRENT_DATE, 'won', NOW())`,
      [playerId],
    );
  }
}

test('GET /api/events — aktives Event mit 4 Aufgaben, alle 0/nicht erfüllt', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/events', { token: p.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.event, 'Event ist aktiv');
  assert.equal(res.body.event.id, 'summer_clash_2026');
  assert.equal(res.body.event.challenges.length, 4);
  for (const c of res.body.event.challenges as Array<{ value: number; complete: boolean; claimed: boolean }>) {
    assert.equal(c.value, 0);
    assert.equal(c.complete, false);
    assert.equal(c.claimed, false);
  }
});

test('Fortschritt: 5 Siege → win5 complete', async () => {
  const p = await registerPlayer();
  await seedWins(p.id, 5);
  const res = await api('GET', '/api/events', { token: p.token });
  const win5 = res.body.event.challenges.find((c: any) => c.id === 'win5');
  assert.equal(win5.value, 5);
  assert.equal(win5.complete, true);
  // Höhere Stufe noch nicht erfüllt.
  const win15 = res.body.event.challenges.find((c: any) => c.id === 'win15');
  assert.equal(win15.complete, false);
});

test('Claim: erfüllte Aufgabe → Belohnung (Gems) gutgeschrieben', async () => {
  const p = await registerPlayer();
  await seedWins(p.id, 5);
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;

  const res = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'win5' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.claimed_gems, 5);
  assert.equal(res.body.challenge.claimed, true);

  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  assert.equal(after.gems, before.gems + 5, 'Gems ungekappt gutgeschrieben');
});

test('Claim: noch nicht erfüllt → 400', async () => {
  const p = await registerPlayer();
  await seedWins(p.id, 4); // target 5
  const res = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'win5' } });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /noch nicht erfüllt/i);
});

test('Claim: doppelt → 400', async () => {
  const p = await registerPlayer();
  await seedWins(p.id, 5);
  const first = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'win5' } });
  assert.equal(first.status, 200);
  const second = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'win5' } });
  assert.equal(second.status, 400);
  assert.match(errMsg(second.body), /bereits/i);
});

test('Claim: nach Claim ist die Aufgabe als claimed markiert', async () => {
  const p = await registerPlayer();
  await seedWins(p.id, 5);
  await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'win5' } });
  const res = await api('GET', '/api/events', { token: p.token });
  const win5 = res.body.event.challenges.find((c: any) => c.id === 'win5');
  assert.equal(win5.claimed, true);
});

test('Dungeon-Metrik: 3 Dungeons → dungeon3 abholbar → Gems', async () => {
  const p = await registerPlayer();
  await seedDungeons(p.id, 3);
  const status = await api('GET', '/api/events', { token: p.token });
  const d3 = status.body.event.challenges.find((c: any) => c.id === 'dungeon3');
  assert.equal(d3.value, 3);
  assert.equal(d3.complete, true);

  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const claim = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'dungeon3' } });
  assert.equal(claim.status, 200);
  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  assert.equal(after.gems, before.gems + 10);
});

test('Claim: unbekannte Aufgabe → 404', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/events/claim', { token: p.token, body: { challenge_id: 'gibtsnicht' } });
  assert.equal(res.status, 404);
});

test('Auth: GET /api/events ohne Token → 401', async () => {
  const res = await api('GET', '/api/events');
  assert.equal(res.status, 401);
});

test('Auth: POST /api/events/claim ohne Token → 401', async () => {
  const res = await api('POST', '/api/events/claim', { body: { challenge_id: 'win5' } });
  assert.equal(res.status, 401);
});
