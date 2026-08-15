import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findUnitDefinition,
  unitsForFaction,
  getTrainCost,
  getUnitCombatStats,
  mod,
} from '../src/index';
import { cfg, approx } from './helpers';

test('findUnitDefinition: gemeinsame Einheit', () => {
  const def = findUnitDefinition(cfg, 'militia', 'humans');
  assert.ok(def);
  assert.equal(def!.id, 'militia');
  assert.equal(def!.exclusive, false);
});

test('findUnitDefinition: fraktionsexklusive Einheit nur für die eigene Fraktion', () => {
  // Drachenbrut existiert für Drachenmenschen …
  const dw = findUnitDefinition(cfg, 'dragon_whelp', 'dragonfolk');
  assert.ok(dw);
  assert.equal(dw!.exclusive, true);
  // … aber nicht für Menschen.
  assert.equal(findUnitDefinition(cfg, 'dragon_whelp', 'humans'), null);
  // Unbekannte Einheit → null.
  assert.equal(findUnitDefinition(cfg, 'nichtexistent', 'humans'), null);
});

test('unitsForFaction: gemeinsame + exklusive, nach Freischalt-Level sortiert', () => {
  const commonCount = Object.keys(cfg.units_common).filter((k) => k !== 'description').length;
  for (const id of Object.keys(cfg.factions) as Array<keyof typeof cfg.factions>) {
    const exCount = cfg.factions_exclusive_content[id]?.exclusive_units.length ?? 0;
    const list = unitsForFaction(cfg, id);
    assert.equal(list.length, commonCount + exCount, `Anzahl Einheiten für ${id}`);
    // aufsteigend nach unlock_town_hall_level
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i]!.unlock_town_hall_level >= list[i - 1]!.unlock_town_hall_level);
    }
  }
});

test('unitsForFaction: Menschen-Pool = 5 common + alle exklusiven', () => {
  const commonCount = Object.keys(cfg.units_common).filter((k) => k !== 'description').length;
  const humansEx = cfg.factions_exclusive_content.humans.exclusive_units.length;
  assert.equal(unitsForFaction(cfg, 'humans').length, commonCount + humansEx);
});

test('getTrainCost: Menge skaliert linear, Zeit = train_time × Menge', () => {
  const m = findUnitDefinition(cfg, 'militia', 'humans')!;
  const cost = getTrainCost(cfg, 'militia', 5, 'humans')!;
  assert.equal(cost.wood, Math.ceil(m.cost.wood * 1 * 5));
  assert.equal(cost.train_time_seconds, m.train_time_seconds * 5);
});

test('getTrainCost: unit_cost_multiplier je Fraktion', () => {
  const base = findUnitDefinition(cfg, 'militia', 'humans')!.cost.wood;
  // Drachenmenschen: +20% Rekrutierungskosten.
  const dfMul = cfg.factions.dragonfolk.modifiers.unit_cost_multiplier as number;
  assert.equal(getTrainCost(cfg, 'militia', 3, 'dragonfolk')!.wood, Math.ceil(base * dfMul * 3));
  // Untote: −15% Einheitenkosten.
  const udMul = cfg.factions.undead.modifiers.unit_cost_multiplier as number;
  assert.equal(getTrainCost(cfg, 'militia', 3, 'undead')!.wood, Math.ceil(base * udMul * 3));
});

test('getTrainCost: unbekannte Einheit → null', () => {
  assert.equal(getTrainCost(cfg, 'nichtexistent', 1, 'humans'), null);
});

test('getUnitCombatStats: Milizionär (Nahkampf, Menschen-Baseline)', () => {
  const def = findUnitDefinition(cfg, 'militia', 'humans')!;
  const s = getUnitCombatStats(cfg, 'militia', 'humans')!;
  assert.equal(s.hp, def.hp);
  assert.equal(s.dps, def.damage_per_second);
  assert.equal(s.range, cfg.combat.melee_range_tiles); // Nahkampf nutzt die globale Nahkampf-Reichweite
  assert.equal(s.splash, false);
  assert.equal(s.hps, 0);
  assert.ok(approx(s.speed, cfg.combat.unit_speed_tiles_per_second[def.speed]!));
});

test('getUnitCombatStats: Bogenschütze ist Fernkampf (eigene Reichweite)', () => {
  const def = findUnitDefinition(cfg, 'archer', 'humans')!;
  const s = getUnitCombatStats(cfg, 'archer', 'humans')!;
  assert.equal(s.range, def.range_tiles);
  assert.ok(s.range > cfg.combat.melee_range_tiles);
});

test('getUnitCombatStats: Drachenmenschen +20% Fernkampfschaden (Bogenschütze 14→16.8)', () => {
  const base = getUnitCombatStats(cfg, 'archer', 'humans')!.dps;
  const rangedMul = cfg.factions.dragonfolk.modifiers.ranged_unit_damage_multiplier as number;
  const df = getUnitCombatStats(cfg, 'archer', 'dragonfolk')!.dps;
  assert.ok(approx(df, base * rangedMul));
  // Nahkampf-Milizionär bleibt bei Drachenmenschen unverändert (kein Melee-Bonus).
  const meleeBase = getUnitCombatStats(cfg, 'militia', 'humans')!.dps;
  assert.ok(approx(getUnitCombatStats(cfg, 'militia', 'dragonfolk')!.dps, meleeBase));
});

test('getUnitCombatStats: Orks +20% Nahkampfschaden (nur Melee)', () => {
  const m = cfg.factions.orcs.modifiers;
  const meleeMul = mod(m, 'unit_damage_multiplier') * mod(m, 'melee_unit_damage_multiplier');
  const base = getUnitCombatStats(cfg, 'militia', 'humans')!.dps;
  assert.ok(approx(getUnitCombatStats(cfg, 'militia', 'orcs')!.dps, base * meleeMul));
});

test('getUnitCombatStats: Riesen +HP, Elfen +Tempo', () => {
  const giantHpMul = cfg.factions.giants.modifiers.unit_hp_multiplier as number;
  const baseHp = getUnitCombatStats(cfg, 'militia', 'humans')!.hp;
  assert.ok(approx(getUnitCombatStats(cfg, 'militia', 'giants')!.hp, baseHp * giantHpMul));

  const elfSpeedMul = cfg.factions.elves.modifiers.unit_speed_multiplier as number;
  const baseSpeed = getUnitCombatStats(cfg, 'militia', 'humans')!.speed;
  assert.ok(approx(getUnitCombatStats(cfg, 'militia', 'elves')!.speed, baseSpeed * elfSpeedMul));
});

test('getUnitCombatStats: unbekannte Einheit → null', () => {
  assert.equal(getUnitCombatStats(cfg, 'nichtexistent', 'humans'), null);
});
