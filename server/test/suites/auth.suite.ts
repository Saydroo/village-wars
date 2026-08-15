import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, uniqueSuffix } from '../harness';

test('register: neuer Spieler bekommt Dorf + Tokens', async () => {
  const s = uniqueSuffix();
  const username = `reg_${s}`;
  const res = await api('POST', '/api/auth/register', {
    body: { username, email: `${username}@test.dev`, password: 'password123', faction: 'humans' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.player.username, username);
  assert.equal(res.body.player.faction, 'humans');
  assert.equal(res.body.player.village_level, 1);
  assert.ok(res.body.tokens.accessToken && res.body.tokens.refreshToken);
});

test('register: doppelter Benutzername → 409', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/auth/register', {
    body: { username: p.username, email: `dup_${uniqueSuffix()}@test.dev`, password: 'password123', faction: 'humans' },
  });
  assert.equal(res.status, 409);
});

test('register: ungültige Eingabe (Zod) → 400', async () => {
  const res = await api('POST', '/api/auth/register', {
    body: { username: 'x', email: 'keine-email', password: 'short', faction: 'humans' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'validation_error');
});

test('register: unbekannte Fraktion → 400', async () => {
  const s = uniqueSuffix();
  const res = await api('POST', '/api/auth/register', {
    body: { username: `f_${s}`, email: `f_${s}@test.dev`, password: 'password123', faction: 'martians' },
  });
  assert.equal(res.status, 400);
});

test('login: korrekte Daten → Tokens; falsches Passwort → 401', async () => {
  const s = uniqueSuffix();
  const username = `log_${s}`;
  await api('POST', '/api/auth/register', {
    body: { username, email: `${username}@test.dev`, password: 'password123', faction: 'elves' },
  });
  const ok = await api('POST', '/api/auth/login', { body: { identifier: username, password: 'password123' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.tokens.accessToken);

  const bad = await api('POST', '/api/auth/login', { body: { identifier: username, password: 'falsch123' } });
  assert.equal(bad.status, 401);
});

test('refresh: gültiges Refresh-Token → neues Token-Paar', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/auth/refresh', { body: { refreshToken: p.refreshToken } });
  assert.equal(res.status, 200);
  assert.ok(res.body.tokens.accessToken);
});

test('geschützte Route ohne Token → 401', async () => {
  const res = await api('GET', '/api/player/me');
  assert.equal(res.status, 401);
});

test('player/me: mit Token → Spieler + Kapazitäten', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/player/me', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.player.id, p.id);
  assert.ok(res.body.capacities && typeof res.body.capacities.wood === 'number');
});
