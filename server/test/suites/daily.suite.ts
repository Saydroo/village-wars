import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, getGameConfig } from '../harness';

/**
 * Tägliche Login-Belohnung + Streak (Roadmap P1). Der „Tag" ist ein Berlin-
 * Kalendertag — Streak-Fortsetzung/Reset werden getestet, indem das letzte
 * Claim-Datum per SQL auf gestern bzw. mehrere Tage zurück gesetzt wird.
 */

const ladder = getGameConfig().daily_rewards.ladder;

/** Setzt die Daily-Zeile eines Spielers (für Streak-Szenarien). offsetDays: -1 = gestern. */
async function seedDaily(playerId: string, streak: number, offsetDays: number): Promise<void> {
  await sql(
    `INSERT INTO player_daily_rewards (player_id, streak, longest_streak, last_claim_date)
     VALUES ($1, $2, $2, ((now() AT TIME ZONE 'Europe/Berlin')::date + ($3 || ' days')::interval)::date)
     ON CONFLICT (player_id) DO UPDATE SET streak = EXCLUDED.streak,
       longest_streak = EXCLUDED.longest_streak, last_claim_date = EXCLUDED.last_claim_date`,
    [playerId, streak, offsetDays],
  );
}

test('Status frisch: abholbar, Streak 0, nächster Tag 1, Leiter geliefert', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/daily/status', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.can_claim, true);
  assert.equal(res.body.streak, 0);
  assert.equal(res.body.next_streak_day, 1);
  assert.equal(res.body.ladder.length, ladder.length);
  assert.equal(res.body.todays_reward.day, ladder[0]!.day);
});

test('Claim Tag 1: schreibt Ressourcen gut, Streak 1', async () => {
  const p = await registerPlayer();
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const claim = await api('POST', '/api/daily/claim', { token: p.token });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.streak, 1);
  assert.equal(claim.body.longest_streak, 1);
  // village_level 1 → Skalierungsfaktor 1 → Tag-1-Holz unverändert (unter Cap).
  assert.equal(claim.body.player.wood, before.wood + ladder[0]!.wood);
  assert.equal(claim.body.player.stone, before.stone + ladder[0]!.stone);
});

test('Doppel-Claim am selben Tag → 400', async () => {
  const p = await registerPlayer();
  await api('POST', '/api/daily/claim', { token: p.token });
  const again = await api('POST', '/api/daily/claim', { token: p.token });
  assert.equal(again.status, 400);
  const status = await api('GET', '/api/daily/status', { token: p.token });
  assert.equal(status.body.can_claim, false);
  assert.equal(status.body.streak, 1);
});

test('Streak-Fortsetzung: gestern abgeholt (Streak 3) → Claim macht Streak 4 + Gems', async () => {
  const p = await registerPlayer();
  await seedDaily(p.id, 3, -1); // gestern, Streak 3
  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player;
  const claim = await api('POST', '/api/daily/claim', { token: p.token });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.streak, 4);
  const tier4 = ladder[(4 - 1) % ladder.length]!; // Tag-4-Stufe
  assert.equal(claim.body.reward.day, tier4.day);
  assert.equal(claim.body.player.gems, before.gems + tier4.gems);
});

test('Streak-Reset: Tag verpasst (Streak 5, vor 3 Tagen) → Claim startet bei 1', async () => {
  const p = await registerPlayer();
  await seedDaily(p.id, 5, -3); // Lücke
  const status = await api('GET', '/api/daily/status', { token: p.token });
  assert.equal(status.body.can_claim, true);
  assert.equal(status.body.next_streak_day, 1);
  assert.equal(status.body.streak_reset, true);
  const claim = await api('POST', '/api/daily/claim', { token: p.token });
  assert.equal(claim.body.streak, 1);
  assert.equal(claim.body.reward.day, ladder[0]!.day);
});

test('Auth: Status ohne Token → 401', async () => {
  const res = await api('GET', '/api/daily/status');
  assert.equal(res.status, 401);
});
