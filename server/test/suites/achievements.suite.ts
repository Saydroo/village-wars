import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, getGameConfig } from '../harness';

/**
 * Achievements (Roadmap P2). Metriken werden live aus dem Spielstand berechnet;
 * für die Tests werden sie per SQL gesetzt (village_level/trophies). Belohnungen
 * werden aus der Config abgeleitet (nicht hartcodiert).
 */

function def(id: string) {
  const d = getGameConfig().achievements.definitions.find((x) => x.id === id);
  assert.ok(d, `Achievement ${id} fehlt in der Config`);
  return d!;
}

test('GET /achievements: alle Definitionen, frischer Spieler überwiegend Stufe 0', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/achievements', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.achievements.length, getGameConfig().achievements.definitions.length);
  const th = res.body.achievements.find((a: any) => a.id === 'trophy_hunter');
  assert.equal(th.value, 0);
  assert.equal(th.reached_tier, 0);
  assert.equal(th.claimable, false);
  assert.equal(th.next_threshold, def('trophy_hunter').tiers[0]!.threshold);
});

test('Claim ohne Fortschritt → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/achievements/trophy_hunter/claim', { token: p.token });
  assert.equal(res.status, 400);
});

test('master_builder: Rathaus 5 → 2 Stufen abholbar → Gems gutgeschrieben', async () => {
  const p = await registerPlayer();
  await sql(`UPDATE players SET village_level = 5 WHERE id = $1`, [p.id]);
  const mb = def('master_builder');
  const expectGems = mb.tiers[0]!.gems + mb.tiers[1]!.gems;

  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const status = await api('GET', '/api/achievements', { token: p.token });
  const view = status.body.achievements.find((a: any) => a.id === 'master_builder');
  assert.equal(view.reached_tier, 2);
  assert.equal(view.claimable, true);

  const claim = await api('POST', '/api/achievements/master_builder/claim', { token: p.token });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.claimed_gems, expectGems);
  assert.equal(claim.body.claimed_gold_bars, 0);
  assert.equal(claim.body.player.gems, before.gems + expectGems);
  assert.equal(claim.body.achievement.claimed_tier, 2);
  assert.equal(claim.body.achievement.claimable, false);
});

test('Doppel-Claim ohne neue Stufe → 400', async () => {
  const p = await registerPlayer();
  await sql(`UPDATE players SET village_level = 5 WHERE id = $1`, [p.id]);
  await api('POST', '/api/achievements/master_builder/claim', { token: p.token });
  const again = await api('POST', '/api/achievements/master_builder/claim', { token: p.token });
  assert.equal(again.status, 400);
});

test('Weitere Stufen später: Rathaus 5→10 holt nur die neuen Stufen (Goldbarren)', async () => {
  const p = await registerPlayer();
  await sql(`UPDATE players SET village_level = 5 WHERE id = $1`, [p.id]);
  await api('POST', '/api/achievements/master_builder/claim', { token: p.token }); // Stufen 1+2

  await sql(`UPDATE players SET village_level = 10 WHERE id = $1`, [p.id]);
  const mb = def('master_builder');
  const expectBars = mb.tiers[2]!.gold_bars + mb.tiers[3]!.gold_bars;
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const claim = await api('POST', '/api/achievements/master_builder/claim', { token: p.token });
  assert.equal(claim.body.claimed_gold_bars, expectBars);
  assert.equal(claim.body.player.gold_bars, before.gold_bars + expectBars);
  assert.equal(claim.body.achievement.claimed_tier, 4);
});

test('trophy_hunter: 600 Trophäen → 2 Stufen → Gems', async () => {
  const p = await registerPlayer();
  await sql(`UPDATE players SET trophies = 600 WHERE id = $1`, [p.id]);
  const th = def('trophy_hunter');
  const claim = await api('POST', '/api/achievements/trophy_hunter/claim', { token: p.token });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.claimed_gems, th.tiers[0]!.gems + th.tiers[1]!.gems);
});

test('Unbekanntes Achievement → 404', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/achievements/gibtsnicht/claim', { token: p.token });
  assert.equal(res.status, 404);
});

test('Auth: ohne Token → 401', async () => {
  const res = await api('GET', '/api/achievements');
  assert.equal(res.status, 401);
});
