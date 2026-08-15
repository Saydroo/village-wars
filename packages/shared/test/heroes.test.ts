import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameConfig } from '../src/types/gameConfig';
import {
  getHeroDef,
  getHeroLevelCost,
  heroHpMultiplier,
  heroDpsMultiplier,
  heroCurrentHp,
  heroCurrentDps,
  heroRegenMinutes,
  isHeroReady,
  hasHeroHall,
} from '../src/game/heroes';

function cfg(): GameConfig {
  return {
    heroes: {
      max_level: 10,
      hp_bonus_per_level_percent: 6,
      dps_bonus_per_level_percent: 5,
      regen_minutes_per_level: 10,
      requires_building: 'hero_hall',
      level_costs: [
        { to_level: 2, gold: 2000, minutes: 120 },
        { to_level: 3, gold: 5000, minutes: 240 },
      ],
      faction_heroes: {
        humans: { id: 'king_arthur', display_name: 'König Artus', housing_space: 5, base_hp: 500, base_dps: 40, speed: 'medium' },
        orcs:   { id: 'warchief', display_name: 'Kriegsanführer', housing_space: 6, base_hp: 550, base_dps: 45, speed: 'medium' },
      },
    },
  } as unknown as GameConfig;
}

test('getHeroDef: Menschen → king_arthur', () => {
  const def = getHeroDef(cfg(), 'humans');
  assert.ok(def);
  assert.equal(def.id, 'king_arthur');
  assert.equal(def.base_hp, 500);
});

test('getHeroDef: unbekannte Fraktion → null', () => {
  assert.equal(getHeroDef(cfg(), 'elves'), null);
});

test('getHeroLevelCost: to_level 2 → 2000 Gold', () => {
  const cost = getHeroLevelCost(cfg(), 2);
  assert.ok(cost);
  assert.equal(cost.gold, 2000);
  assert.equal(cost.minutes, 120);
});

test('getHeroLevelCost: to_level 99 → null', () => {
  assert.equal(getHeroLevelCost(cfg(), 99), null);
});

test('heroHpMultiplier: Level 1 → 1.0 (kein Bonus)', () => {
  assert.equal(heroHpMultiplier(cfg(), 1), 1.0);
});

test('heroHpMultiplier: Level 2 → 1.06 (+6%)', () => {
  assert.ok(Math.abs(heroHpMultiplier(cfg(), 2) - 1.06) < 1e-9);
});

test('heroHpMultiplier: Level 5 → 1.24 (+24%)', () => {
  assert.ok(Math.abs(heroHpMultiplier(cfg(), 5) - 1.24) < 1e-9);
});

test('heroDpsMultiplier: Level 3 → 1.10 (+10%)', () => {
  assert.ok(Math.abs(heroDpsMultiplier(cfg(), 3) - 1.10) < 1e-9);
});

test('heroCurrentHp: Level 1 = base_hp', () => {
  assert.equal(heroCurrentHp(cfg(), 'humans', 1), 500);
});

test('heroCurrentHp: Level 2 = round(500 * 1.06) = 530', () => {
  assert.equal(heroCurrentHp(cfg(), 'humans', 2), 530);
});

test('heroCurrentDps: Level 1 = base_dps', () => {
  assert.equal(heroCurrentDps(cfg(), 'humans', 1), 40);
});

test('heroRegenMinutes: Level 3 = 30 min', () => {
  assert.equal(heroRegenMinutes(cfg(), 3), 30);
});

test('isHeroReady: null/null → true', () => {
  assert.ok(isHeroReady(null, null));
});

test('isHeroReady: levelingUntil in Zukunft → false', () => {
  const future = new Date(Date.now() + 60000).toISOString();
  assert.ok(!isHeroReady(future, null));
});

test('isHeroReady: regeneratesUntil in Zukunft → false', () => {
  const future = new Date(Date.now() + 60000).toISOString();
  assert.ok(!isHeroReady(null, future));
});

test('isHeroReady: Zeiten in der Vergangenheit → true', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  assert.ok(isHeroReady(past, past));
});

test('hasHeroHall: mit hero_hall Level 1 → true', () => {
  assert.ok(hasHeroHall([{ type: 'hero_hall', level: 1 }]));
});

test('hasHeroHall: hero_hall Level 0 (im Bau) → false', () => {
  assert.ok(!hasHeroHall([{ type: 'hero_hall', level: 0 }]));
});

test('hasHeroHall: kein hero_hall → false', () => {
  assert.ok(!hasHeroHall([{ type: 'barracks', level: 2 }]));
});

test('Level-Kosten streng monoton steigend', () => {
  const c = cfg();
  const costs = c.heroes.level_costs.map((l) => l.gold);
  for (let i = 1; i < costs.length; i++) {
    assert.ok(costs[i]! > costs[i - 1]!, `Level ${i + 2} muss teurer sein als Level ${i + 1}`);
  }
});
