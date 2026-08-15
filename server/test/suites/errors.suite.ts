import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer } from '../harness';

test('GET /api/health → 200', async () => {
  const res = await api('GET', '/api/health');
  assert.equal(res.status, 200);
});

test('GET /api/config → komplette Config (öffentlich)', async () => {
  const res = await api('GET', '/api/config');
  assert.equal(res.status, 200);
  assert.ok(res.body.factions && res.body._meta);
});

test('Unbekannte Route → 404 mit not_found-Code', async () => {
  const res = await api('GET', '/api/gibtsnicht');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
});

test('Geschützte Route mit ungültigem Token → 401', async () => {
  const res = await api('GET', '/api/player/me', { token: 'kaputtes.token.hier' });
  assert.equal(res.status, 401);
});

test('Nicht-UUID-Pfadparameter → 400 (zentrale 22P02-Abbildung), nicht 500', async () => {
  const p = await registerPlayer();
  // Clan-Detail mit Müll-ID fließt in eine UUID-Spalte → Postgres 22P02 → 400.
  const res = await api('GET', '/api/clan/kein-uuid-wert', { token: p.token });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'bad_request');
});
