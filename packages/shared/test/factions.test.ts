import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod, factionModifiers, faction, FACTION_IDS } from '../src/index';
import { cfg } from './helpers';

test('mod: liest vorhandenen Modifikator', () => {
  const m = factionModifiers(cfg, 'dragonfolk');
  assert.equal(mod(m, 'ranged_unit_damage_multiplier'), 1.2);
});

test('mod: fehlender Schlüssel → Baseline 1 (bzw. Fallback)', () => {
  const m = factionModifiers(cfg, 'humans');
  // Menschen haben keinen melee_unit_damage_multiplier-Eintrag → Fallback.
  assert.equal(mod(m, 'melee_unit_damage_multiplier'), 1);
  assert.equal(mod(m, 'voellig_unbekannt'), 1);
  assert.equal(mod(m, 'voellig_unbekannt', 0.5), 0.5);
});

test('Menschen sind die Baseline (alle vorhandenen Modifikatoren = 1)', () => {
  const m = factionModifiers(cfg, 'humans');
  for (const [, v] of Object.entries(m)) {
    if (typeof v === 'number') assert.equal(v, 1);
  }
});

test('faction(): liefert die Config-Sektion mit Modifikatoren', () => {
  for (const id of FACTION_IDS) {
    const f = faction(cfg, id);
    assert.ok(f, `Fraktion ${id} fehlt`);
    assert.equal(typeof f.modifiers, 'object');
  }
});

test('alle FACTION_IDS existieren in der Config (und umgekehrt)', () => {
  const configIds = Object.keys(cfg.factions).sort();
  assert.deepEqual([...FACTION_IDS].sort(), configIds);
});
