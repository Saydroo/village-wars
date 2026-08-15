import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfg } from './helpers';
import { initBattleState, deployUnit, stepBattle } from '../src/game/combat';
import {
  heroCombatStats,
  heroCurrentHp,
  heroCurrentDps,
  HERO_UNIT_TYPE,
} from '../src/game/heroes';
import type { DefenderBuildingInput } from '../src/game/combat';

/**
 * Helden-im-Kampf-Integration (Roadmap P6). Prüft, dass der Held als deploybare
 * Einheit mit eigenen Level-Stats in die Engine kommt, sich nur einmal einsetzen
 * lässt und im Kampf tatsächlich Schaden anrichtet.
 */

const HUMAN_TH: DefenderBuildingInput = {
  id: 'th1',
  building_type: 'town_hall',
  level: 1,
  grid_x: 10,
  grid_y: 10,
};

function initWithHero(level: number, army: Record<string, number> = {}) {
  const hero = heroCombatStats(cfg, 'humans', level);
  const state = initBattleState(cfg, {
    battleId: 'b1',
    attackerId: 'a1',
    attackerFaction: 'humans',
    defenderId: 'd1',
    defenderFaction: 'humans',
    isBot: false,
    defenderBuildings: [HUMAN_TH],
    army,
    hero,
  });
  return { hero, state };
}

test('heroCombatStats: HERO_UNIT_TYPE ist "hero"', () => {
  assert.equal(HERO_UNIT_TYPE, 'hero');
});

test('heroCombatStats: Menschen-Held (Nahkampf) löst Stats korrekt auf', () => {
  const s = heroCombatStats(cfg, 'humans', 1);
  assert.ok(s);
  assert.equal(s.unit_type, HERO_UNIT_TYPE);
  assert.equal(s.hp, heroCurrentHp(cfg, 'humans', 1));
  assert.equal(s.dps, heroCurrentDps(cfg, 'humans', 1));
  assert.equal(s.hps, 0);
  // Menschen-Held hat keine range_tiles → Nahkampf-Fallback.
  assert.equal(s.range, cfg.combat.melee_range_tiles);
  assert.equal(s.speed, cfg.combat.unit_speed_tiles_per_second['medium']);
  assert.equal(s.splash, false);
});

test('heroCombatStats: Level-Skalierung greift (Level 5 > Level 1)', () => {
  const l1 = heroCombatStats(cfg, 'humans', 1)!;
  const l5 = heroCombatStats(cfg, 'humans', 5)!;
  assert.ok(l5.hp > l1.hp, 'HP muss mit Level steigen');
  assert.ok(l5.dps > l1.dps, 'DPS muss mit Level steigen');
  assert.equal(l5.hp, heroCurrentHp(cfg, 'humans', 5));
});

test('heroCombatStats: Fernkampf-Held (Elfen) nutzt range_tiles', () => {
  const s = heroCombatStats(cfg, 'elves', 1)!;
  const def = cfg.heroes.faction_heroes['elves'];
  assert.ok(def, 'Elfen-Held muss definiert sein');
  assert.ok(typeof def!.range_tiles === 'number' && def!.range_tiles > 0);
  assert.equal(s.range, def!.range_tiles);
});

test('heroCombatStats: Splash-Held (Untote) hat splash=true', () => {
  const s = heroCombatStats(cfg, 'undead', 1)!;
  assert.equal(s.splash, true);
});

test('initBattleState: Held landet als 1 in der Reserve, state.hero gesetzt', () => {
  const { hero, state } = initWithHero(1, { militia: 10 });
  assert.ok(hero);
  assert.equal(state.hero?.unit_type, HERO_UNIT_TYPE);
  assert.equal(state.reserve[HERO_UNIT_TYPE], 1);
  assert.equal(state.reserve['militia'], 10);
});

test('initBattleState: ohne Held → state.hero null, Reserve unverändert', () => {
  const state = initBattleState(cfg, {
    battleId: 'b2',
    attackerId: 'a1',
    attackerFaction: 'humans',
    defenderId: 'd1',
    defenderFaction: 'humans',
    isBot: false,
    defenderBuildings: [HUMAN_TH],
    army: { militia: 5 },
    hero: null,
  });
  assert.equal(state.hero, null);
  assert.equal(state.reserve[HERO_UNIT_TYPE], undefined);
  assert.equal(state.reserve['militia'], 5);
});

test('deployUnit: Held wird mit Helden-Stats eingesetzt, Reserve → 0', () => {
  const { hero, state } = initWithHero(3);
  const res = deployUnit(cfg, state, { unit_type: HERO_UNIT_TYPE, x: 10.5, y: 10.5 });
  assert.ok(res.ok);
  assert.ok(res.unit);
  assert.equal(res.unit.unit_type, HERO_UNIT_TYPE);
  assert.equal(res.unit.max_hp, Math.round(hero!.hp));
  assert.equal(res.unit.dps, hero!.dps);
  assert.equal(state.reserve[HERO_UNIT_TYPE], 0);
  assert.equal(state.units.length, 1);
});

test('deployUnit: Held nur einmal einsetzbar (Reserve-Cap)', () => {
  const { state } = initWithHero(1);
  const first = deployUnit(cfg, state, { unit_type: HERO_UNIT_TYPE, x: 10.5, y: 10.5 });
  assert.ok(first.ok);
  const second = deployUnit(cfg, state, { unit_type: HERO_UNIT_TYPE, x: 10.5, y: 10.5 });
  assert.equal(second.ok, false);
});

test('stepBattle: eingesetzter Held richtet Schaden am Gebäude an', () => {
  const { state } = initWithHero(1);
  deployUnit(cfg, state, { unit_type: HERO_UNIT_TYPE, x: 10.5, y: 10.5 });
  const before = state.buildings[0]!.hp;
  // ein paar Ticks simulieren (Held steht direkt am Rathaus → greift sofort an)
  for (let i = 0; i < 5; i++) stepBattle(cfg, state, 0.1);
  const after = state.buildings[0]!.hp;
  assert.ok(after < before, `Rathaus-HP muss sinken (${before} → ${after})`);
});

test('stepBattle: ohne Helden-Einsatz bleibt das Gebäude unbeschädigt', () => {
  const { state } = initWithHero(1); // Held in Reserve, NICHT deployt, keine Armee
  const before = state.buildings[0]!.hp;
  for (let i = 0; i < 5; i++) stepBattle(cfg, state, 0.1);
  assert.equal(state.buildings[0]!.hp, before);
});
