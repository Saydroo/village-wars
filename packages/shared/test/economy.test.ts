import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  productionPerHour,
  buildingProductionPerHour,
  storageCapacity,
  resourceCap,
  getUpgradeCost,
  getPlacementCost,
  getBuildingMaxLevel,
  skipCostBars,
  type OwnedBuilding,
} from '../src/index';
import { cfg, approx } from './helpers';

test('productionPerHour: Level 1 = Basis, danach kompoundes Wachstum', () => {
  assert.equal(productionPerHour(200, 18, 1), 200);
  assert.ok(approx(productionPerHour(200, 18, 2), 200 * 1.18));
  assert.ok(approx(productionPerHour(200, 18, 3), 200 * 1.18 * 1.18));
});

test('buildingProductionPerHour: richtige Ressource je Gebäudetyp (Menschen-Baseline)', () => {
  const lumber = cfg.buildings_common.lumber_camp as { base_production_per_hour: number };
  const w = buildingProductionPerHour(cfg, 'lumber_camp', 1, 'humans');
  assert.ok(approx(w.wood, lumber.base_production_per_hour));
  assert.equal(w.stone, 0);
  assert.equal(w.gold, 0);

  const s = buildingProductionPerHour(cfg, 'quarry', 1, 'humans');
  assert.ok(s.stone > 0 && s.wood === 0 && s.gold === 0);

  const g = buildingProductionPerHour(cfg, 'gold_mine', 1, 'humans');
  assert.ok(g.gold > 0 && g.wood === 0 && g.stone === 0);
});

test('buildingProductionPerHour: Stufe 0 (im Bau) produziert nichts', () => {
  const w = buildingProductionPerHour(cfg, 'lumber_camp', 0, 'humans');
  assert.deepEqual(w, { wood: 0, stone: 0, gold: 0 });
});

test('buildingProductionPerHour: Fraktions-Modifikatoren greifen', () => {
  // Untote: resource_production_multiplier = 0.85 (allgemein, trifft Holz).
  const human = buildingProductionPerHour(cfg, 'lumber_camp', 3, 'humans').wood;
  const undeadMul = cfg.factions.undead.modifiers.resource_production_multiplier as number;
  const undead = buildingProductionPerHour(cfg, 'lumber_camp', 3, 'undead').wood;
  assert.ok(approx(undead, human * undeadMul));

  // Zwerge: resource_production_multiplier_stone = 1.15 (zusätzlich zum allgemeinen 1).
  const humanStone = buildingProductionPerHour(cfg, 'quarry', 2, 'humans').stone;
  const dwarfStoneMul = cfg.factions.dwarves.modifiers.resource_production_multiplier_stone as number;
  const dwarfStone = buildingProductionPerHour(cfg, 'quarry', 2, 'dwarves').stone;
  assert.ok(approx(dwarfStone, humanStone * dwarfStoneMul));
});

test('storageCapacity: Grundkapazität aus dem Rathaus + gebaute Lager', () => {
  const sw = cfg.buildings_common.storage_wood as { base_capacity: number };
  const base = sw.base_capacity;
  // Ohne Lager: nur die Rathaus-Grundkapazität.
  assert.equal(storageCapacity(cfg, [], 'wood'), Math.floor(base));
  // Mit einem Lager auf Stufe 1: Grundkapazität + base (Wachstumsfaktor^0).
  const withOne: OwnedBuilding[] = [{ building_type: 'storage_wood', level: 1 }];
  assert.equal(storageCapacity(cfg, withOne, 'wood'), Math.floor(base + base));
  // Baustelle (Stufe 0) zählt nicht.
  const building: OwnedBuilding[] = [{ building_type: 'storage_wood', level: 0 }];
  assert.equal(storageCapacity(cfg, building, 'wood'), Math.floor(base));
});

test('resourceCap = Kapazität × resource_cap_multiplier (3×)', () => {
  const mult = cfg.economy.resource_cap_multiplier;
  const cap = storageCapacity(cfg, [], 'wood');
  assert.equal(resourceCap(cfg, [], 'wood'), Math.floor(cap * mult));
});

test('getUpgradeCost: Rathaus-Stufe aus der Config (Menschen ohne Aufschlag)', () => {
  const e = cfg.town_hall_levels.upgrade_requirements.find((r) => r.level === 2)!;
  const cost = getUpgradeCost(cfg, 'town_hall', 2, 'humans');
  assert.deepEqual(cost, {
    wood: e.wood,
    stone: e.stone,
    gold: e.gold ?? 0,
    build_time_minutes: e.build_time_minutes,
  });
});

test('getUpgradeCost: Steinbruch nutzt die Tabelle des Holzfällerlagers', () => {
  const lumber = cfg.buildings_common.lumber_camp as { levels: Array<{ level: number; wood_cost: number; stone_cost: number; build_time_minutes: number }> };
  const e = lumber.levels.find((l) => l.level === 2)!;
  const cost = getUpgradeCost(cfg, 'quarry', 2, 'humans');
  assert.deepEqual(cost, {
    wood: e.wood_cost,
    stone: e.stone_cost,
    gold: 0,
    build_time_minutes: e.build_time_minutes,
  });
});

test('getUpgradeCost: Fraktions-Multiplikatoren (Riesen: Kosten ×1.15 aufgerundet, Zeit ×1.2)', () => {
  const base = cfg.town_hall_levels.upgrade_requirements.find((r) => r.level === 2)!;
  const costMul = cfg.factions.giants.modifiers.upgrade_cost_multiplier as number;
  const timeMul = cfg.factions.giants.modifiers.build_time_multiplier as number;
  const cost = getUpgradeCost(cfg, 'town_hall', 2, 'giants')!;
  assert.equal(cost.wood, Math.ceil(base.wood * costMul));
  assert.equal(cost.stone, Math.ceil(base.stone * costMul));
  assert.equal(cost.build_time_minutes, Math.ceil(base.build_time_minutes * timeMul));
});

test('getUpgradeCost: keine Tabelle → null (keine erfundenen Werte)', () => {
  for (const t of ['wall', 'watchtower', 'cannon', 'storage_wood', 'barracks']) {
    assert.equal(getUpgradeCost(cfg, t, 2, 'humans'), null, `${t} sollte null liefern`);
  }
});

test('getPlacementCost: Holzfäller/Steinbruch sind gratis (Stufe-1-Kosten 0)', () => {
  assert.deepEqual(getPlacementCost(cfg, 'lumber_camp', 'humans'), {
    wood: 0,
    stone: 0,
    gold: 0,
    build_time_minutes: 0,
  });
  assert.deepEqual(getPlacementCost(cfg, 'quarry', 'humans'), {
    wood: 0,
    stone: 0,
    gold: 0,
    build_time_minutes: 0,
  });
});

test('getPlacementCost: Rathaus wird nie platziert → null', () => {
  assert.equal(getPlacementCost(cfg, 'town_hall', 'humans'), null);
});

test('getPlacementCost: Clan-Burg = Stufe-1-Eintrag der Burg-Tabelle', () => {
  const lvl1 = cfg.clan.clan_castle.levels.find((l) => l.level === 1)!;
  const cost = getPlacementCost(cfg, 'clan_castle', 'humans')!;
  assert.equal(cost.wood, lvl1.wood);
  assert.equal(cost.stone, lvl1.stone);
  assert.equal(cost.build_time_minutes, lvl1.build_time_minutes);
});

test('getPlacementCost: Mauer aus cost_per_segment_level_1', () => {
  const seg = (cfg.buildings_common.wall as { cost_per_segment_level_1: { stone?: number; wood?: number } }).cost_per_segment_level_1;
  const cost = getPlacementCost(cfg, 'wall', 'humans')!;
  assert.equal(cost.stone, seg.stone ?? 0);
  assert.equal(cost.wood, seg.wood ?? 0);
});

test('getPlacementCost: fraktionsexklusives Gebäude (Drachenhorst der Drachenmenschen)', () => {
  const ex = cfg.factions_exclusive_content.dragonfolk.exclusive_buildings.find((b) => b.id === 'dragon_roost')!;
  const costMul = (cfg.factions.dragonfolk.modifiers.build_cost_multiplier as number) ?? 1;
  const cost = getPlacementCost(cfg, 'dragon_roost', 'dragonfolk')!;
  assert.equal(cost.wood, Math.ceil((ex.wood_cost ?? 0) * costMul));
  assert.equal(cost.stone, Math.ceil((ex.stone_cost ?? 0) * costMul));
});

test('getBuildingMaxLevel', () => {
  assert.equal(getBuildingMaxLevel(cfg, 'town_hall'), cfg.town_hall_levels.max_level);
  assert.equal(getBuildingMaxLevel(cfg, 'clan_castle'), cfg.clan.clan_castle.levels.length);
  assert.equal(
    getBuildingMaxLevel(cfg, 'lumber_camp'),
    (cfg.buildings_common.lumber_camp as { max_level: number }).max_level,
  );
  // Steinbruch erbt die Maximalstufe des Holzfällerlagers.
  assert.equal(getBuildingMaxLevel(cfg, 'quarry'), getBuildingMaxLevel(cfg, 'lumber_camp'));
  assert.equal(getBuildingMaxLevel(cfg, 'unbekannt'), null);
});

test('skipCostBars: Mindestkosten + degressive Staffelung', () => {
  const min = cfg.build_time_skip.minimum_cost_bars;
  const tiers = cfg.build_time_skip.cost_per_minute_remaining;
  const tierShort = tiers.tier_short!;
  const tierMedium = tiers.tier_medium!;
  const tierLong = tiers.tier_long!;
  // Restzeit <= 0 → Minimum.
  assert.equal(skipCostBars(cfg, 0), min);
  assert.equal(skipCostBars(cfg, -5), min);
  // Sehr kurze Restzeit → unter Minimum gerechnet, aber auf Minimum angehoben.
  assert.equal(skipCostBars(cfg, 1), Math.max(Math.ceil(1 * tierShort.bars_per_minute), min));
  // Innerhalb tier_short.
  const short = 40;
  assert.ok(short <= tierShort.max_minutes);
  assert.equal(skipCostBars(cfg, short), Math.max(Math.ceil(short * tierShort.bars_per_minute), min));
  // tier_medium.
  const medium = tierShort.max_minutes + 100;
  assert.ok(medium <= tierMedium.max_minutes);
  assert.equal(skipCostBars(cfg, medium), Math.max(Math.ceil(medium * tierMedium.bars_per_minute), min));
  // tier_long (degressiv: günstiger pro Minute).
  const long = tierMedium.max_minutes + 1000;
  assert.equal(skipCostBars(cfg, long), Math.max(Math.ceil(long * tierLong.bars_per_minute), min));
});

test('skipCostBars: pro Minute monoton fallender Tarif (degressiv)', () => {
  const tiers = cfg.build_time_skip.cost_per_minute_remaining;
  assert.ok(tiers.tier_short!.bars_per_minute > tiers.tier_long!.bars_per_minute);
});
