import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, giveUnits, grant } from '../harness';

/**
 * Onboarding / Tutorial (Roadmap P8). Testet die geordnete Schrittfolge: Live-
 * Fortschritt aus dem Spielstand, strikt sequentielles Abholen, Belohnungs-
 * gutschrift (Ressourcen gekappt), Abschluss und Validierung.
 *
 * Schritte (Config): welcome(none,0) → build_first(buildings_count,2) →
 * train_army(army_size,5) → first_battle(battles_won,1) → join_clan(clan_member,1).
 */

function errMsg(body: any): string {
  return body?.error?.message ?? body?.message ?? '';
}

/** Hängt einem Spieler ein zweites Gebäude an (buildings_count → 2). */
async function addBuilding(playerId: string): Promise<void> {
  await sql(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
     VALUES ($1, 'barracks', 1, 1, 1)`,
    [playerId],
  );
}

/** Trägt einen gewonnenen Solo-Kampf ein (battles_won → 1). */
async function recordWin(playerId: string): Promise<void> {
  await sql(
    `INSERT INTO battles (attacker_id, mode, result) VALUES ($1, 'solo', 'attacker_win')`,
    [playerId],
  );
}

/** Steckt den Spieler in einen (minimalen) Clan (clan_member → 1). */
async function joinAnyClan(playerId: string): Promise<void> {
  const tag = `T${Math.floor(Math.random() * 90000 + 10000)}`;
  const rows = await sql<{ id: string }>(
    `INSERT INTO clans (name, tag, banner, leader_id)
     VALUES ($1, $2, '{}'::jsonb, $3) RETURNING id`,
    [`Clan ${tag}`, tag.slice(0, 5), playerId],
  );
  const clanId = rows[0]!.id;
  await sql(
    `INSERT INTO clan_members (clan_id, player_id, role) VALUES ($1, $2, 'leader')`,
    [clanId, playerId],
  );
  await sql(`UPDATE players SET clan_id = $1 WHERE id = $2`, [clanId, playerId]);
}

test('GET /api/onboarding — frischer Spieler: 5 Schritte, welcome aktiv+erfüllt', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/onboarding', { token: p.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.steps.length, 5);
  assert.equal(res.body.claimed_steps, 0);
  assert.equal(res.body.all_complete, false);
  assert.equal(res.body.active_step_id, 'welcome');

  const welcome = res.body.steps[0];
  assert.equal(welcome.id, 'welcome');
  assert.equal(welcome.complete, true, 'welcome (metric none) ist sofort erfüllt');
  assert.equal(welcome.active, true);
  assert.equal(welcome.claimed, false);

  // Spätere Schritte sind weder aktiv noch erfüllt (frischer Spieler).
  const build = res.body.steps[1];
  assert.equal(build.active, false);
  assert.equal(build.complete, false); // 1 Gebäude < target 2
});

test('Claim welcome → Belohnung gutgeschrieben, Schritt 1 abgeholt, nächster aktiv', async () => {
  const p = await registerPlayer();
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;

  const res = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'welcome' },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.all_complete, false);
  assert.equal(res.body.claimed_gems, 5, 'welcome gibt 5 Gems (Config)');
  assert.equal(res.body.step.claimed, true);

  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  assert.equal(after.gems, before.gems + 5, 'Gems sind ungekappt');

  const status = await api('GET', '/api/onboarding', { token: p.token });
  assert.equal(status.body.claimed_steps, 1);
  assert.equal(status.body.active_step_id, 'build_first');
  assert.equal(status.body.steps[0].claimed, true);
  assert.equal(status.body.steps[1].active, true);
});

test('Sequenz: nicht-aktiven Schritt abholen → 400', async () => {
  const p = await registerPlayer();
  // build_first ist noch nicht aktiv (welcome zuerst) → Ablehnung.
  const res = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'build_first' },
  });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /nicht der aktuell offene/i);
});

test('Aktiven Schritt abholen, der noch nicht erfüllt ist → 400', async () => {
  const p = await registerPlayer();
  await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'welcome' } });
  // build_first ist jetzt aktiv, aber nur 1 Gebäude (target 2).
  const res = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'build_first' },
  });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /noch nicht erfüllt/i);
});

test('Doppel-Claim desselben Schritts → 400 (nicht mehr aktiv)', async () => {
  const p = await registerPlayer();
  const first = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'welcome' },
  });
  assert.equal(first.status, 200);
  const second = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'welcome' },
  });
  assert.equal(second.status, 400);
});

test('Voller Durchlauf: alle 5 Schritte der Reihe nach → all_complete', async () => {
  const p = await registerPlayer();

  // 1) welcome (sofort)
  let r = await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'welcome' } });
  assert.equal(r.status, 200);

  // 2) build_first — zweites Gebäude
  await addBuilding(p.id);
  r = await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'build_first' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  // 3) train_army — 5 Truppen
  await giveUnits(p.id, 'militia', 5);
  r = await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'train_army' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  // 4) first_battle — gewonnener Kampf
  await recordWin(p.id);
  r = await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'first_battle' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  // 5) join_clan
  await joinAnyClan(p.id);
  r = await api('POST', '/api/onboarding/claim', { token: p.token, body: { step_id: 'join_clan' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.all_complete, true);

  const status = await api('GET', '/api/onboarding', { token: p.token });
  assert.equal(status.body.claimed_steps, 5);
  assert.equal(status.body.all_complete, true);
  assert.equal(status.body.active_step_id, null);

  // completed_at wurde gesetzt.
  const rows = await sql<{ completed_at: string | null }>(
    `SELECT completed_at FROM player_onboarding WHERE player_id = $1`,
    [p.id],
  );
  assert.ok(rows[0]!.completed_at, 'completed_at muss bei Abschluss gesetzt sein');
});

test('Claim nach Abschluss → 400 (Onboarding bereits abgeschlossen)', async () => {
  const p = await registerPlayer();
  // Direkt auf abgeschlossen setzen.
  await sql(
    `INSERT INTO player_onboarding (player_id, claimed_steps, completed_at)
     VALUES ($1, 5, NOW())`,
    [p.id],
  );
  const res = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'join_clan' },
  });
  assert.equal(res.status, 400);
  assert.match(errMsg(res.body), /abgeschlossen/i);

  const status = await api('GET', '/api/onboarding', { token: p.token });
  assert.equal(status.body.all_complete, true);
  assert.equal(status.body.active_step_id, null);
});

test('Ressourcen-Belohnung wird auf das Lager-Cap gekappt', async () => {
  const p = await registerPlayer();
  // Spieler-Holz weit über jedes Cap heben; welcome gibt +1000 Holz, darf das Cap nicht sprengen.
  await grant(p.id, { wood: 99_999_999 });
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;

  const res = await api('POST', '/api/onboarding/claim', {
    token: p.token,
    body: { step_id: 'welcome' },
  });
  assert.equal(res.status, 200);

  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  assert.ok(after.wood <= before.wood, 'Holz über dem Cap darf durch die Belohnung nicht weiter steigen');
});

test('Validierung: fehlende step_id → 400 (Zod)', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/onboarding/claim', { token: p.token, body: {} });
  assert.equal(res.status, 400);
});

test('Auth: GET ohne Token → 401', async () => {
  const res = await api('GET', '/api/onboarding');
  assert.equal(res.status, 401);
});

test('Auth: POST claim ohne Token → 401', async () => {
  const res = await api('POST', '/api/onboarding/claim', { body: { step_id: 'welcome' } });
  assert.equal(res.status, 401);
});
