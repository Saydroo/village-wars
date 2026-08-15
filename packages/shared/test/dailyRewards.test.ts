import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleTier,
  dailyLadderView,
  rewardForStreakDay,
  previousDate,
  decideStreak,
} from '../src/index';
import { cfg } from './helpers';

test('previousDate: Vortag inkl. Monats-/Jahresgrenze', () => {
  assert.equal(previousDate('2026-06-23'), '2026-06-22');
  assert.equal(previousDate('2026-07-01'), '2026-06-30');
  assert.equal(previousDate('2026-01-01'), '2025-12-31');
  assert.equal(previousDate('2024-03-01'), '2024-02-29'); // Schaltjahr
});

test('scaleTier: skaliert NUR Ressourcen mit dem Rathaus-Level (nicht Gems/Goldbarren)', () => {
  const tier = { day: 1, wood: 100, stone: 50, gold: 10, gems: 2, gold_bars: 3, label: 'x' };
  const s = scaleTier(tier, 5, true);
  assert.equal(s.wood, 500);
  assert.equal(s.stone, 250);
  assert.equal(s.gold, 50);
  assert.equal(s.gems, 2); // unskaliert
  assert.equal(s.gold_bars, 3); // unskaliert
  // Ohne Skalierung unverändert; THLevel<1 wirkt wie 1.
  assert.deepEqual(scaleTier(tier, 9, false), { ...tier });
  assert.equal(scaleTier(tier, 0, true).wood, 100);
});

test('dailyLadderView: Länge = Config-Leiter, skaliert mit THLevel', () => {
  const ladder = dailyLadderView(cfg, 1);
  assert.equal(ladder.length, cfg.daily_rewards.ladder.length);
  const scaled = dailyLadderView(cfg, 3);
  if (cfg.daily_rewards.scale_resources_with_town_hall) {
    assert.equal(scaled[0]!.wood, cfg.daily_rewards.ladder[0]!.wood * 3);
  }
});

test('rewardForStreakDay: Leiter wiederholt sich zyklisch', () => {
  const len = cfg.daily_rewards.ladder.length;
  const day1 = rewardForStreakDay(cfg, 1, 1);
  const dayLenPlus1 = rewardForStreakDay(cfg, len + 1, 1); // ein Zyklus weiter
  assert.equal(day1.day, dayLenPlus1.day); // gleiche Leiter-Stufe
  // Tag „len" ist die letzte (höchste) Stufe.
  const last = rewardForStreakDay(cfg, len, 1);
  assert.equal(last.day, cfg.daily_rewards.ladder[len - 1]!.day);
});

test('decideStreak: bereits heute abgeholt → kein erneuter Claim', () => {
  const d = decideStreak('2026-06-23', 3, '2026-06-23');
  assert.equal(d.canClaim, false);
  assert.equal(d.nextStreak, 3);
  assert.equal(d.reset, false);
});

test('decideStreak: gestern abgeholt → Streak +1 (Fortsetzung)', () => {
  const d = decideStreak('2026-06-22', 3, '2026-06-23');
  assert.equal(d.canClaim, true);
  assert.equal(d.nextStreak, 4);
  assert.equal(d.reset, false);
});

test('decideStreak: Lücke (Tag verpasst) → Reset auf 1', () => {
  const d = decideStreak('2026-06-20', 5, '2026-06-23');
  assert.equal(d.canClaim, true);
  assert.equal(d.nextStreak, 1);
  assert.equal(d.reset, true);
});

test('decideStreak: noch nie abgeholt → Start bei 1, kein Reset', () => {
  const d = decideStreak(null, 0, '2026-06-23');
  assert.equal(d.canClaim, true);
  assert.equal(d.nextStreak, 1);
  assert.equal(d.reset, false);
});
