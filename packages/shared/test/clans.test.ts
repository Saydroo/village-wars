import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clanCastleHousing,
  unitHousing,
  defendersHousingUsed,
  validateBanner,
  type ClanBanner,
} from '../src/index';
import { cfg } from './helpers';

const castleLevels = cfg.clan.clan_castle.levels;
const maxCastleLevel = castleLevels[castleLevels.length - 1]!.level;

test('clanCastleHousing: ohne Burg = 0', () => {
  assert.equal(clanCastleHousing(cfg, 0), 0);
  assert.equal(clanCastleHousing(cfg, -1), 0);
});

test('clanCastleHousing: exakte Stufenwerte aus der Config', () => {
  for (const lvl of castleLevels) {
    assert.equal(clanCastleHousing(cfg, lvl.level), lvl.housing_space);
  }
});

test('clanCastleHousing: höhere Stufe als definiert → höchster definierter Wert', () => {
  const top = castleLevels.find((l) => l.level === maxCastleLevel)!.housing_space;
  assert.equal(clanCastleHousing(cfg, maxCastleLevel + 5), top);
});

test('unitHousing: gemeinsame + exklusive Einheiten, unbekannt = 0', () => {
  const militia = cfg.units_common.militia as { housing_space: number };
  const knight = cfg.units_common.knight as { housing_space: number };
  assert.equal(unitHousing(cfg, 'militia'), militia.housing_space);
  assert.equal(unitHousing(cfg, 'knight'), knight.housing_space);

  const dragonWhelp = cfg.factions_exclusive_content.dragonfolk.exclusive_units.find(
    (u) => u.id === 'dragon_whelp',
  )!;
  assert.equal(unitHousing(cfg, 'dragon_whelp'), dragonWhelp.housing_space);

  assert.equal(unitHousing(cfg, 'nichtexistent'), 0);
});

test('defendersHousingUsed: Summe über gemischte Einheiten', () => {
  const militiaH = unitHousing(cfg, 'militia');
  const knightH = unitHousing(cfg, 'knight');
  const used = defendersHousingUsed(cfg, [
    { unit_type: 'militia', quantity: 5 },
    { unit_type: 'knight', quantity: 2 },
  ]);
  assert.equal(used, militiaH * 5 + knightH * 2);
  assert.equal(defendersHousingUsed(cfg, []), 0);
});

function validBanner(): ClanBanner {
  const o = cfg.clan.banner_options;
  return {
    shape: o.shapes[0]!,
    symbol: o.symbols[0]!,
    primary_color: o.colors[0]!,
    secondary_color: o.colors[1]!,
    symbol_color: o.colors[2]!,
  };
}

test('validateBanner: gültiges Banner → null', () => {
  assert.equal(validateBanner(cfg, validBanner()), null);
});

test('validateBanner: unbekannte Form/Symbol/Farbe → Fehlermeldung', () => {
  assert.match(validateBanner(cfg, { ...validBanner(), shape: 'octagon' })!, /Form/);
  assert.match(validateBanner(cfg, { ...validBanner(), symbol: 'banana' })!, /Symbol/);
  assert.match(validateBanner(cfg, { ...validBanner(), primary_color: '#123456' })!, /Farbe/);
  assert.match(validateBanner(cfg, { ...validBanner(), symbol_color: '#abcdef' })!, /Farbe/);
});
