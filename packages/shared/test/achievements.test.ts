import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reachedTierCount,
  nextThreshold,
  claimableReward,
  buildAchievementView,
} from '../src/index';
import { cfg } from './helpers';

const tiers = [
  { threshold: 100, gems: 2, gold_bars: 0 },
  { threshold: 500, gems: 5, gold_bars: 0 },
  { threshold: 1000, gems: 0, gold_bars: 10 },
];

test('reachedTierCount: zählt erreichte Stufen', () => {
  assert.equal(reachedTierCount(0, tiers), 0);
  assert.equal(reachedTierCount(99, tiers), 0);
  assert.equal(reachedTierCount(100, tiers), 1);
  assert.equal(reachedTierCount(600, tiers), 2);
  assert.equal(reachedTierCount(5000, tiers), 3);
});

test('nextThreshold: nächste unerreichte Schwelle bzw. null', () => {
  assert.equal(nextThreshold(0, tiers), 100);
  assert.equal(nextThreshold(100, tiers), 500);
  assert.equal(nextThreshold(600, tiers), 1000);
  assert.equal(nextThreshold(1000, tiers), null);
});

test('claimableReward: summiert Belohnung im Stufen-Bereich [claimed, reached)', () => {
  assert.deepEqual(claimableReward(tiers, 0, 2), { gems: 7, gold_bars: 0 }); // Stufe 1+2
  assert.deepEqual(claimableReward(tiers, 2, 3), { gems: 0, gold_bars: 10 }); // Stufe 3
  assert.deepEqual(claimableReward(tiers, 3, 3), { gems: 0, gold_bars: 0 }); // nichts offen
  assert.deepEqual(claimableReward(tiers, 0, 0), { gems: 0, gold_bars: 0 });
});

test('buildAchievementView: setzt reached/claimed/claimable/next_threshold', () => {
  const def = { id: 'x', name: 'X', metric: 'trophies' as const, tiers };
  const v = buildAchievementView(def, 600, 1);
  assert.equal(v.value, 600);
  assert.equal(v.reached_tier, 2);
  assert.equal(v.claimed_tier, 1);
  assert.equal(v.claimable, true);
  assert.equal(v.next_threshold, 1000);

  // Alles abgeholt → nicht claimable.
  const done = buildAchievementView(def, 600, 2);
  assert.equal(done.claimable, false);
  // claimed_tier wird auf [0, tiers.length] geklemmt.
  assert.equal(buildAchievementView(def, 600, 99).claimed_tier, tiers.length);
});

test('Config-Achievements sind valide (aufsteigende Schwellen, Belohnung vorhanden)', () => {
  assert.ok(cfg.achievements.definitions.length > 0);
  for (const def of cfg.achievements.definitions) {
    assert.ok(def.tiers.length > 0, `${def.id} ohne Stufen`);
    for (let i = 1; i < def.tiers.length; i++) {
      assert.ok(def.tiers[i]!.threshold > def.tiers[i - 1]!.threshold, `${def.id} Schwellen nicht aufsteigend`);
    }
    for (const t of def.tiers) assert.ok(t.gems > 0 || t.gold_bars > 0, `${def.id} Stufe ohne Belohnung`);
  }
});
