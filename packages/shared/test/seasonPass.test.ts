import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfg } from './helpers';
import type { SeasonPassReward } from '../src/types/gameConfig';
import {
  seasonPassTiers,
  maxSeasonPassTier,
  seasonPassTierDef,
  currentSeasonPassTier,
  isSeasonPassTierReached,
  nextSeasonPassTierXp,
} from '../src/game/seasonPass';

/**
 * Reine Season-Pass-Logik (Roadmap P7). Erwartungen werden aus der echten Config
 * abgeleitet (keine hartcodierten Spielzahlen), damit sie bei Balance-Änderungen
 * gültig bleiben.
 */

const tiers = seasonPassTiers(cfg);
const firstTier = tiers[0]!;
const secondTier = tiers[1]!;
const lastTier = tiers[tiers.length - 1]!;

test('seasonPassTiers: aufsteigend nach Stufennummer sortiert', () => {
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i]!.tier > tiers[i - 1]!.tier);
  }
});

test('seasonPassTiers: xp_required monoton steigend', () => {
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i]!.xp_required > tiers[i - 1]!.xp_required, `Stufe ${i + 1} braucht mehr XP`);
  }
});

test('erste Stufe ist bei 0 XP sofort erreichbar', () => {
  assert.equal(firstTier.xp_required, 0);
});

test('maxSeasonPassTier = höchste Stufennummer', () => {
  assert.equal(maxSeasonPassTier(cfg), lastTier.tier);
});

test('seasonPassTierDef: bekannte Stufe gefunden, unbekannte undefined', () => {
  assert.ok(seasonPassTierDef(cfg, firstTier.tier));
  assert.equal(seasonPassTierDef(cfg, 9999), undefined);
});

test('currentSeasonPassTier: 0 XP → Stufe 1 (erste Stufe bei 0)', () => {
  assert.equal(currentSeasonPassTier(cfg, 0), firstTier.tier);
});

test('currentSeasonPassTier: knapp unter zweiter Schwelle → noch erste Stufe', () => {
  assert.equal(currentSeasonPassTier(cfg, secondTier.xp_required - 1), firstTier.tier);
});

test('currentSeasonPassTier: genau auf zweiter Schwelle → zweite Stufe', () => {
  assert.equal(currentSeasonPassTier(cfg, secondTier.xp_required), secondTier.tier);
});

test('currentSeasonPassTier: sehr hohe XP → letzte Stufe', () => {
  assert.equal(currentSeasonPassTier(cfg, lastTier.xp_required + 100000), lastTier.tier);
});

test('isSeasonPassTierReached: an/unter der Schwelle', () => {
  assert.ok(isSeasonPassTierReached(cfg, secondTier.xp_required, secondTier.tier));
  assert.ok(!isSeasonPassTierReached(cfg, secondTier.xp_required - 1, secondTier.tier));
});

test('nextSeasonPassTierXp: bei 0 XP → Schwelle der zweiten Stufe', () => {
  assert.equal(nextSeasonPassTierXp(cfg, 0), secondTier.xp_required);
});

test('nextSeasonPassTierXp: über letzter Schwelle → null (Maximum)', () => {
  assert.equal(nextSeasonPassTierXp(cfg, lastTier.xp_required), null);
});

test('jede Stufe hat Gratis- und Premium-Belohnung mit mindestens einem Wert', () => {
  const hasValue = (r: SeasonPassReward) =>
    Object.values(r).some((v) => typeof v === 'number' && v > 0);
  for (const t of tiers) {
    assert.ok(hasValue(t.free), `Stufe ${t.tier} Gratis-Belohnung leer`);
    assert.ok(hasValue(t.premium), `Stufe ${t.tier} Premium-Belohnung leer`);
  }
});

test('premium_cost_gems ist positiv (verdienbar = fair)', () => {
  assert.ok(cfg.season_pass.premium_cost_gems > 0);
});
