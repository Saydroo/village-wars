import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, grant, setTownHallLevel } from '../harness';

/**
 * Truppen-Level-Forschung (Roadmap P3). Testet Status, Start (Goldabzug,
 * Validierung), Doppel-Start-Block, Sofortabschluss (finishes_at in der
 * Vergangenheit) und Abbruch.
 */

/** Platziert ein Forschungslabor auf Level 1 direkt in der DB (Testhelfer). */
async function giveResearchLab(playerId: string): Promise<void> {
  await sql(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
     VALUES ($1, 'research_lab', 1, 5, 5)
     ON CONFLICT DO NOTHING`,
    [playerId],
  );
}

/** Setzt eine laufende Forschung auf finishes_at = jetzt - 1s (sofort fällig). */
async function makeResearchFinishNow(playerId: string): Promise<void> {
  await sql(
    `UPDATE research_queue SET finishes_at = now() - interval '1 second'
     WHERE player_id = $1`,
    [playerId],
  );
}

test('GET /api/research — frischer Spieler: leere unit_levels, kein active', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/research', { token: p.token });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.unit_levels, {});
  assert.equal(res.body.active, null);
});

test('Ohne Labor → 400 beim Start', async () => {
  const p = await registerPlayer();
  await grant(p.id, { gold: 50000 });
  const res = await api('POST', '/api/research/start', {
    token: p.token,
    body: { unit_type: 'militia' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error?.message ?? res.body.message ?? '', /Labor/i);
});

test('Forschung starten: Gold abgezogen, active gesetzt', async () => {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, 3);
  await giveResearchLab(p.id);
  await grant(p.id, { gold: 50000 });

  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const res = await api('POST', '/api/research/start', {
    token: p.token,
    body: { unit_type: 'militia' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.active !== null, 'active muss gesetzt sein');
  assert.equal(res.body.active.unit_type, 'militia');
  assert.equal(res.body.active.target_level, 2);

  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  // Gold wurde abgezogen (Kosten für Level 2 aus Config).
  assert.ok(after.gold < before.gold, 'Gold muss nach Forschungsstart gesunken sein');
});

test('Zweite Forschung bei laufender → 400', async () => {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, 3);
  await giveResearchLab(p.id);
  await grant(p.id, { gold: 100000 });

  await api('POST', '/api/research/start', { token: p.token, body: { unit_type: 'militia' } });
  const second = await api('POST', '/api/research/start', {
    token: p.token,
    body: { unit_type: 'archer' },
  });
  assert.equal(second.status, 400);
  assert.match(second.body.error?.message ?? second.body.message ?? '', /läuft/i);
});

test('Zu wenig Gold → 400', async () => {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, 3);
  await giveResearchLab(p.id);
  // Gold auf 0 lassen (Standard nach Register).
  const res = await api('POST', '/api/research/start', {
    token: p.token,
    body: { unit_type: 'militia' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error?.message ?? res.body.message ?? '', /Gold/i);
});

test('Settle-on-Read: abgeschlossene Forschung erscheint in unit_levels', async () => {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, 3);
  await giveResearchLab(p.id);
  await grant(p.id, { gold: 50000 });

  await api('POST', '/api/research/start', { token: p.token, body: { unit_type: 'archer' } });
  await makeResearchFinishNow(p.id);

  const res = await api('GET', '/api/research', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.unit_levels.archer, 2, 'Archer muss auf Level 2 sein');
  assert.equal(res.body.active, null, 'Keine aktive Forschung mehr');
});

test('Abbruch: laufende Forschung entfernt, kein Gold zurück', async () => {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, 3);
  await giveResearchLab(p.id);
  await grant(p.id, { gold: 50000 });

  await api('POST', '/api/research/start', { token: p.token, body: { unit_type: 'militia' } });
  const goldAfterStart = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold;

  const cancel = await api('DELETE', '/api/research/cancel', { token: p.token });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.active, null);

  const goldAfterCancel = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold;
  assert.equal(goldAfterCancel, goldAfterStart, 'Kein Gold-Rückerstattung beim Abbruch');
});

test('Abbruch ohne laufende Forschung → 400', async () => {
  const p = await registerPlayer();
  const res = await api('DELETE', '/api/research/cancel', { token: p.token });
  assert.equal(res.status, 400);
});

test('Auth: GET ohne Token → 401', async () => {
  const res = await api('GET', '/api/research');
  assert.equal(res.status, 401);
});
