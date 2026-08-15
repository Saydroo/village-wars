import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDifficulty,
  generateDungeonWave,
  generateDungeonBoss,
  simulateDungeonWave,
  computeDungeonReward,
  makeRunSeed,
} from '../src/index';
import type { FactionId } from '../src/index';
import { cfg, approx } from './helpers';

const npcFaction = (cfg.dungeon.npc_faction ?? 'humans') as FactionId;

test('resolveDifficulty: per id, sonst Standard', () => {
  assert.equal(resolveDifficulty(cfg, 'hard').id, 'hard');
  assert.equal(resolveDifficulty(cfg, null).id, cfg.dungeon.default_difficulty);
  assert.equal(resolveDifficulty(cfg, undefined).id, cfg.dungeon.default_difficulty);
  assert.equal(resolveDifficulty(cfg, 'gibtsnicht').id, cfg.dungeon.default_difficulty);
});

test('generateDungeonWave: deterministisch (gleicher Seed + Welle + Schwierigkeit)', () => {
  const diff = resolveDifficulty(cfg, 'normal');
  const a = generateDungeonWave(cfg, 12345, 3, diff);
  const b = generateDungeonWave(cfg, 12345, 3, diff);
  assert.deepEqual(a, b);
});

test('generateDungeonWave: unterschiedliche Seeds erzeugen i. d. R. andere Wellen', () => {
  const diff = resolveDifficulty(cfg, 'normal');
  let anyDifferent = false;
  for (let s = 1; s <= 20 && !anyDifferent; s++) {
    const a = JSON.stringify(generateDungeonWave(cfg, s, 2, diff));
    const b = JSON.stringify(generateDungeonWave(cfg, s + 1000, 2, diff));
    if (a !== b) anyDifferent = true;
  }
  assert.ok(anyDifferent, 'Seeds sollten variieren');
});

test('generateDungeonWave: Gegner-Menge in [min, max], Typen aus dem enemy_pool', () => {
  const gen = cfg.dungeon.wave_generation;
  const poolTypes = new Set(gen.enemy_pool.map((p) => p.unit_type));
  for (const diffId of cfg.dungeon.difficulties.map((d) => d.id)) {
    const diff = resolveDifficulty(cfg, diffId);
    for (let wave = 1; wave <= 5; wave++) {
      const groups = generateDungeonWave(cfg, 999 + wave, wave, diff);
      const total = groups.reduce((s, g) => s + g.count, 0);
      assert.ok(total >= gen.min_enemies_per_wave, `Welle ${wave}/${diffId}: total ${total} >= min`);
      assert.ok(total <= gen.max_enemy_units, `Welle ${wave}/${diffId}: total ${total} <= max`);
      for (const g of groups) assert.ok(poolTypes.has(g.unit_type), `Typ ${g.unit_type} im Pool`);
    }
  }
});

test('generateDungeonWave: Stat-Skalierung = (1 + growth×(welle-1)/100) × strength', () => {
  const gen = cfg.dungeon.wave_generation;
  const diff = resolveDifficulty(cfg, 'hard');
  const wave = 4;
  const expected =
    (1 + (gen.wave_stat_growth_per_wave_percent / 100) * (wave - 1)) * diff.enemy_strength_multiplier;
  const groups = generateDungeonWave(cfg, 77, wave, diff);
  assert.ok(groups.length > 0);
  for (const g of groups) {
    assert.ok(approx(g.hp_multiplier ?? 0, expected));
    assert.ok(approx(g.damage_multiplier ?? 0, expected));
  }
});

test('generateDungeonBoss: ein Boss, mit Schwierigkeit skaliert', () => {
  const boss = cfg.dungeon.boss;
  const diff = resolveDifficulty(cfg, 'nightmare');
  const groups = generateDungeonBoss(cfg, diff);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.unit_type, boss.unit_type);
  assert.equal(groups[0]!.count, boss.count);
  assert.ok(approx(groups[0]!.hp_multiplier ?? 0, boss.hp_multiplier * diff.enemy_strength_multiplier));
  assert.ok(approx(groups[0]!.damage_multiplier ?? 0, boss.damage_multiplier * diff.enemy_strength_multiplier));
});

test('simulateDungeonWave: übermächtige Armee räumt die Welle (cleared)', () => {
  const res = simulateDungeonWave(cfg, {
    playerArmy: { knight: 20 },
    playerFaction: 'humans',
    enemyGroups: [{ unit_type: 'militia', count: 1 }],
    enemyFaction: npcFaction,
  });
  assert.equal(res.cleared, true);
  assert.ok(Object.values(res.survivors).some((n) => n > 0));
  assert.ok(Object.values(res.enemiesRemaining).every((n) => n <= 0));
});

test('simulateDungeonWave: leere Armee verliert (nicht cleared, keine Überlebenden)', () => {
  const res = simulateDungeonWave(cfg, {
    playerArmy: {},
    playerFaction: 'humans',
    enemyGroups: [{ unit_type: 'knight', count: 5 }],
    enemyFaction: npcFaction,
  });
  assert.equal(res.cleared, false);
  assert.equal(Object.keys(res.survivors).length, 0);
});

test('simulateDungeonWave: deterministisch', () => {
  const input = {
    playerArmy: { militia: 10, archer: 5 },
    playerFaction: 'humans' as const,
    enemyGroups: [{ unit_type: 'knight', count: 4 }],
    enemyFaction: npcFaction,
  };
  const a = simulateDungeonWave(cfg, input);
  const b = simulateDungeonWave(cfg, input);
  assert.deepEqual(a.survivors, b.survivors);
  assert.deepEqual(a.enemiesRemaining, b.enemiesRemaining);
  assert.equal(a.cleared, b.cleared);
});

test('simulateDungeonWave: Replay-Aufzeichnung respektiert maxFrames', () => {
  const res = simulateDungeonWave(cfg, {
    playerArmy: { militia: 8 },
    playerFaction: 'humans',
    enemyGroups: [{ unit_type: 'militia', count: 8 }],
    enemyFaction: npcFaction,
    captureReplay: true,
    replayIntervalTicks: 1,
    replayMaxFrames: 5,
  });
  assert.ok(res.replay);
  assert.ok(res.replay!.frames.length <= 5);
  // Ohne captureReplay kein Replay.
  const noReplay = simulateDungeonWave(cfg, {
    playerArmy: { militia: 8 },
    playerFaction: 'humans',
    enemyGroups: [{ unit_type: 'militia', count: 8 }],
    enemyFaction: npcFaction,
  });
  assert.equal(noReplay.replay, undefined);
});

test('computeDungeonReward: keine Welle → 0/0/null', () => {
  const r = computeDungeonReward(cfg, 0, false);
  assert.deepEqual(r, { gold: 0, gems: 0, tier_label: null });
});

test('computeDungeonReward: wählt höchste erreichte Stufe', () => {
  const tiers = cfg.dungeon.reward_tiers;
  const tier1 = tiers.find((t) => !t.requires_boss && t.min_waves_completed === 1)!;
  const r1 = computeDungeonReward(cfg, 1, false, 1, () => 0);
  assert.equal(r1.tier_label, tier1.label ?? null);
  assert.equal(r1.gold, tier1.gold_min); // randFn=0 → Minimum

  // Alle 5 + Boss = höchste Stufe.
  const bossTier = tiers.find((t) => t.requires_boss)!;
  const rb = computeDungeonReward(cfg, 5, true, 1, () => 0);
  assert.equal(rb.tier_label, bossTier.label ?? null);
});

test('computeDungeonReward: requires_boss-Stufe nur mit besiegtem Boss', () => {
  const tiers = cfg.dungeon.reward_tiers;
  const nonBossTop = tiers
    .filter((t) => !t.requires_boss)
    .sort((a, b) => b.min_waves_completed - a.min_waves_completed)[0]!;
  // 5 Wellen ohne Boss → höchste Nicht-Boss-Stufe.
  const r = computeDungeonReward(cfg, 5, false, 1, () => 0);
  assert.equal(r.tier_label, nonBossTop.label ?? null);
});

test('computeDungeonReward: reward_multiplier skaliert (Albtraum > Leicht)', () => {
  const easy = resolveDifficulty(cfg, 'easy').reward_multiplier;
  const nightmare = resolveDifficulty(cfg, 'nightmare').reward_multiplier;
  const top = cfg.dungeon.reward_tiers.find((t) => t.requires_boss)!;
  // randFn knapp unter 1 → Maximum der Spanne.
  const rEasy = computeDungeonReward(cfg, 5, true, easy, () => 0.999999);
  const rNm = computeDungeonReward(cfg, 5, true, nightmare, () => 0.999999);
  assert.equal(rEasy.gold, Math.round(top.gold_max * easy));
  assert.equal(rNm.gold, Math.round(top.gold_max * nightmare));
  assert.ok(rNm.gold > rEasy.gold);
});

test('makeRunSeed: 32-bit-Ganzzahl, deterministisch über randFn', () => {
  assert.equal(makeRunSeed(() => 0), 0);
  const s = makeRunSeed(() => 0.5);
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff);
});
