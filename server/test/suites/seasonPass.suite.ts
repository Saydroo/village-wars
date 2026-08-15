import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, grant, cfg } from '../harness';

/**
 * Season-/Battle-Pass (Roadmap P7). Testet Status, Premium-Freischaltung (Gems),
 * Stufen-Claim (free/premium), Validierung (nicht erreicht, nicht freigeschaltet,
 * Doppel-Claim) und Auth.
 */

/** Setzt die Pass-XP eines Spielers direkt für die aktive Saison (Test-Helfer). */
async function setPassXp(playerId: string, xp: number): Promise<void> {
  const [s] = await sql<{ season_number: number }>(
    `SELECT season_number FROM seasons WHERE is_active = TRUE ORDER BY season_number DESC LIMIT 1`,
  );
  const season = Number(s!.season_number);
  await sql(
    `INSERT INTO season_pass_progress (player_id, season_number, xp) VALUES ($1, $2, $3)
     ON CONFLICT (player_id, season_number) DO UPDATE SET xp = $3`,
    [playerId, season, xp],
  );
}

const tiers = [...cfg.season_pass.tiers].sort((a, b) => a.tier - b.tier);
const tier1 = tiers[0]!;
const lastTier = tiers[tiers.length - 1]!;
const premiumCost = cfg.season_pass.premium_cost_gems;

test('GET /api/season-pass — frischer Spieler: xp 0, Stufe 1, Premium gesperrt', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/season-pass', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.xp, 0);
  assert.equal(res.body.current_tier, tier1.tier); // erste Stufe bei 0 XP
  assert.equal(res.body.premium_unlocked, false);
  assert.equal(res.body.premium_cost_gems, premiumCost);
  assert.equal(res.body.tiers.length, tiers.length);
  assert.ok(res.body.season_number >= 1);
});

test('POST /claim free — erreichte Stufe 1 → free_claimed, Gold gutgeschrieben', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: tier1.tier, track: 'free' },
  });
  assert.equal(res.status, 200);
  const view = res.body.status.tiers.find((t: { tier: number }) => t.tier === tier1.tier);
  assert.equal(view.free_claimed, true);
  // Stufe-1-Gratis ist Gold in der Config → Spieler hat danach mindestens so viel.
  assert.ok(res.body.player.gold >= (tier1.free.gold ?? 0));
});

test('POST /claim free — Doppel-Claim → 400', async () => {
  const p = await registerPlayer();
  const first = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: tier1.tier, track: 'free' },
  });
  assert.equal(first.status, 200);
  const second = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: tier1.tier, track: 'free' },
  });
  assert.equal(second.status, 400);
});

test('POST /claim free — nicht erreichte Stufe → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: lastTier.tier, track: 'free' }, // 0 XP → letzte Stufe unerreicht
  });
  assert.equal(res.status, 400);
});

test('POST /claim premium — ohne Freischaltung → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: tier1.tier, track: 'premium' },
  });
  assert.equal(res.status, 400);
});

test('POST /unlock — ohne genug Gems → 400', async () => {
  const p = await registerPlayer();
  await sql(`UPDATE players SET gems = 0 WHERE id = $1`, [p.id]);
  const res = await api('POST', '/api/season-pass/unlock', { token: p.token });
  assert.equal(res.status, 400);
});

test('POST /unlock — mit Gems → premium_unlocked, Gems abgezogen', async () => {
  const p = await registerPlayer();
  await grant(p.id, { gems: premiumCost + 10 });
  const res = await api('POST', '/api/season-pass/unlock', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.status.premium_unlocked, true);
  assert.equal(res.body.player.gems, 10); // Rest nach Abzug der Kosten
});

test('POST /unlock — doppelt → 400 (bereits freigeschaltet)', async () => {
  const p = await registerPlayer();
  await grant(p.id, { gems: premiumCost * 2 });
  const first = await api('POST', '/api/season-pass/unlock', { token: p.token });
  assert.equal(first.status, 200);
  const second = await api('POST', '/api/season-pass/unlock', { token: p.token });
  assert.equal(second.status, 400);
});

test('POST /claim premium — nach Freischaltung + erreicht → Belohnung gutgeschrieben', async () => {
  const p = await registerPlayer();
  await grant(p.id, { gems: premiumCost }); // exakt die Kosten
  const unlock = await api('POST', '/api/season-pass/unlock', { token: p.token });
  assert.equal(unlock.status, 200);
  assert.equal(unlock.body.player.gems, 0);

  const res = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: tier1.tier, track: 'premium' },
  });
  assert.equal(res.status, 200);
  const view = res.body.status.tiers.find((t: { tier: number }) => t.tier === tier1.tier);
  assert.equal(view.premium_claimed, true);
  // Stufe-1-Premium ist Gems in der Config → exakt diese Menge ist jetzt vorhanden.
  assert.equal(res.body.player.gems, tier1.premium.gems ?? 0);
});

test('XP-Fortschritt hebt die erreichte Stufe (Settle via GET)', async () => {
  const p = await registerPlayer();
  const target = tiers[2]!; // dritte Stufe
  await setPassXp(p.id, target.xp_required);
  const res = await api('GET', '/api/season-pass', { token: p.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.current_tier >= target.tier);
  const view = res.body.tiers.find((t: { tier: number }) => t.tier === target.tier);
  assert.equal(view.reached, true);

  // Und diese Stufe ist jetzt einsammelbar.
  const claim = await api('POST', '/api/season-pass/claim', {
    token: p.token,
    body: { tier: target.tier, track: 'free' },
  });
  assert.equal(claim.status, 200);
});

test('GET /api/season-pass — ohne Token → 401', async () => {
  const res = await api('GET', '/api/season-pass', {});
  assert.equal(res.status, 401);
});

test('POST /api/season-pass/claim — ohne Token → 401', async () => {
  const res = await api('POST', '/api/season-pass/claim', { body: { tier: 1, track: 'free' } });
  assert.equal(res.status, 401);
});
