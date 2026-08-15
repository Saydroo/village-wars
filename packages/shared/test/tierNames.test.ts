import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierName, TIER_NAMES } from '../src/index';

test('tierName: Index 0 = Level 1', () => {
  assert.equal(tierName('town_hall', 1), TIER_NAMES.town_hall![0]);
  assert.equal(tierName('town_hall', 10), TIER_NAMES.town_hall![9]);
});

test('tierName: unbekannter Typ → null', () => {
  assert.equal(tierName('does_not_exist', 1), null);
});

test('tierName: Level außerhalb der Liste → null (Standardname-Fallback der UI)', () => {
  const names = TIER_NAMES.knight!;
  assert.equal(tierName('knight', names.length + 1), null);
  assert.equal(tierName('knight', 0), null); // Level 0 = Index -1
});

test('tierName: jeder definierte Eintrag ist auflösbar', () => {
  for (const [type, names] of Object.entries(TIER_NAMES)) {
    for (let i = 0; i < names.length; i++) {
      assert.equal(tierName(type, i + 1), names[i]);
    }
  }
});
