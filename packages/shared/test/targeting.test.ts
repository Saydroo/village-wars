import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initBattleState, deployUnit, stepBattle } from '../src/game/combat';
import type { GameConfig } from '../src/types/gameConfig';
import type { BattleBuilding, BattleState } from '../src/types/combat';

/**
 * Ziel-Prioritäten der Einheiten (Roadmap P5). Prüft, dass Einheiten mit
 * target_priority=defense/resource/wall das bevorzugte Gebäude anfliegen,
 * und auf 'nearest' fallen-back wenn keine bevorzugten mehr leben.
 */

/** Minimale GameConfig für Tests (nur nötige Felder). */
function makeCfg(overrideUnitPriorities: Record<string, string> = {}): GameConfig {
  return {
    _meta: { version: '0', description: '', currency_legend: {}, balance_principle: '' },
    factions: {
      humans: { display_name: '', theme: '', modifiers: {} },
    },
    unit_target_priorities: {
      building_categories: {
        defense: ['cannon'],
        resource: ['gold_mine'],
        wall: ['wall'],
      },
      unit_priorities: {
        knight: 'defense',
        berserker: 'resource',
        battering_ram: 'wall',
        ...overrideUnitPriorities,
      },
    },
    combat: {
      tick_rate_per_second: 10,
      unit_speed_tiles_per_second: { medium: 2, slow: 1, very_slow: 0.5, fast: 3, very_fast: 4 },
      melee_range_tiles: 1,
      splash_radius_tiles: 1.5,
      healer_range_tiles: 3,
      building_hp: { default: 100, cannon: 200, wall: 50 },
      building_hp_growth_per_level_percent: 10,
      defense_dps_growth_per_level_percent: 10,
      defender_aggro_radius_tiles: 3,
    },
    pvp: {
      match_duration_seconds: 300,
      win_destruction_threshold_pct: 50,
      loot_on_victory: { wood_percentage: 20, stone_percentage: 20, gold_percentage: 0, gems_percentage: 0 },
      loot_note: '',
      trophy_change: { win_base: 28, loss_base: -22, win_min: 18, win_max: 35, loss_min_magnitude: 14, loss_max_magnitude: 30, diff_scale_trophies: 400, note: '' },
      matchmaking: { online_only: false, base_tolerance_trophies: 100, expansions: [], bot_after_seconds: 30, tick_seconds: 5 },
      modes: [],
    },
    units_common: {
      description: '',
      militia: { display_name: 'Miliz', unlock_town_hall_level: 1, role: 'melee', housing_space: 1, hp: 60, damage_per_second: 8, speed: 'medium', cost: { wood: 30 }, train_time_seconds: 20 },
      knight: { display_name: 'Ritter', unlock_town_hall_level: 4, role: 'melee_tank', housing_space: 3, hp: 180, damage_per_second: 16, speed: 'slow', cost: { wood: 120 }, train_time_seconds: 90 },
    },
    factions_exclusive_content: {
      humans: {
        exclusive_buildings: [],
        exclusive_units: [
          { id: 'berserker', display_name: 'Berserker', unlock_town_hall_level: 6, role: 'melee', housing_space: 4, hp: 140, damage_per_second: 32, speed: 'fast', cost: { wood: 200 }, train_time_seconds: 140 },
          { id: 'battering_ram', display_name: 'Rammbock', unlock_town_hall_level: 5, role: 'siege_melee', housing_space: 5, hp: 250, damage_per_second: 30, speed: 'very_slow', cost: { wood: 250 }, train_time_seconds: 180 },
        ],
      },
    },
    buildings_common: {
      description: '',
      cannon: { display_name: 'Kanone', unlock_town_hall_level: 3, base_hp: 200, base_damage_per_second: 20, range_tiles: 8, wood_cost: 2500, stone_cost: 1500, build_time_minutes: 180 },
      gold_mine: { display_name: 'Goldmine', unlock_town_hall_level: 1, base_hp: 300, type: 'resource', wood_cost: 200, stone_cost: 100, build_time_minutes: 10 },
      wall: { display_name: 'Mauer', unlock_town_hall_level: 1, base_hp: 50, wood_cost: 0, stone_cost: 0, build_time_minutes: 0 },
      town_hall: { display_name: 'Rathaus', unlock_town_hall_level: 1, base_hp: 1500, wood_cost: 0, stone_cost: 0, build_time_minutes: 0 },
    },
    // Felder, die von der Engine nicht gebraucht werden (minimal):
    town_hall_levels: { description: '', max_level: 10, upgrade_requirements: [] },
    build_time_skip: { description: '', cost_per_minute_remaining: {}, minimum_cost_bars: 1, notes: '' },
    faction_change: { description: '', cost_bars: 500 },
    resources: {},
    economy: { resource_cap_multiplier: 3 },
    daily_rewards: { ladder: [] },
    achievements: { definitions: [] },
    unit_research: { max_level: 10, hp_bonus_per_level_percent: 8, dps_bonus_per_level_percent: 7, requires_building: 'research_lab', level_costs: [] },
    daily_quests: { definitions: [] },
    dungeon: { schedule: { opens: '', closes: '', timezone: '', open_weekday: 6, open_hour: 5, close_weekday: 0, close_hour: 0, duration_hours: 19, frequency: 'weekly' }, structure: { waves: 5, final_boss: true }, dev_always_open: true, one_run_per_week: false, npc_faction: 'undead', max_wave_seconds: 120, default_difficulty: 'normal', difficulties: [], wave_generation: { enemy_pool: [], base_budget: 10, budget_growth_per_wave: 5, wave_stat_growth_per_wave_percent: 10, min_enemies_per_wave: 2, max_enemy_units: 20 }, boss: { unit_type: 'skeleton_soldier', count: 1, hp_multiplier: 5, damage_multiplier: 3 }, replay_capture_interval_ticks: 2, replay_max_frames: 240, reward_tiers: [] },
    clan: { unlock_town_hall_level: 3, max_members: 50, tag_length_min: 3, tag_length_max: 8, name_length_min: 3, name_length_max: 30, season_reset_weeks: 4, profanity_extra_words: [], leaderboard_rewards_bars: {}, clan_castle: { description: '', levels: [] }, banner_options: { shapes: [], symbols: [], colors: [] }, war: { min_members_per_clan: 5, duration_minutes: 1440, queue_tolerance_members: 3, queue_bot_after_seconds: 300, attacks_per_member: 2, win_season_points: 3, draw_season_points: 1 } },
    leaderboard: { default_page_size: 20, max_page_size: 100 },
    skins: { catalog: [] },
    iap: { packages: [] },
    effects: { particle_cap: 200, particle_cap_reduced: 80, fps_target: 60, reduce_effects_default: false, screen_transition_ms: 240, screenshake: { unit_hits_wall: 3, tower_fires: 2, heavy_unit_lands: 4, building_destroyed: 6, town_hall_destroyed: 10, decay_per_frame: 0.85, min_intensity: 0.05 }, floating_text: { rise_px_per_frame: 1.2, life_decay_per_frame: 0.015, shadow: true, colors: { damage: '#ff4444', resource: '#44ff44', trophy_gain: '#ffcc00', trophy_loss: '#ff8800', crit: '#ff00ff' } }, squash: { button_press_scale: 0.92, upgrade_peak_scale: 1.08, spawn_start_scale: 0.6, spawn_overshoot_scale: 1.1, destroy_collapse_seconds: 0.3 }, idle: { breathing_amplitude: 0.015, breathing_period_seconds: 3, flag_sway_amplitude_deg: 8, flag_sway_period_seconds: 2 }, presets: {} },
  } as unknown as GameConfig;
}

/** Erstellt einen minimalen BattleState mit vordefinierten Gebäuden. */
function makeState(
  cfg: GameConfig,
  buildings: Array<{ type: string; x: number; y: number }>,
  army: Record<string, number> = {},
): BattleState {
  const defBuildings = buildings.map((b, i) => ({
    id: `b${i}`,
    building_type: b.type,
    level: 1,
    grid_x: b.x,
    grid_y: b.y,
  }));
  return initBattleState(cfg, {
    battleId: 'test',
    attackerId: 'a1',
    attackerFaction: 'humans',
    defenderId: 'd1',
    defenderFaction: 'humans',
    isBot: false,
    defenderBuildings: defBuildings,
    army,
    defenderUnits: {},
    attackerUnitLevels: {},
  });
}

test('getBuildingCategory: cannon → defense', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'cannon', x: 5, y: 5 }]);
  const cannon = state.buildings.find((b) => b.building_type === 'cannon');
  assert.equal(cannon?.category, 'defense');
});

test('getBuildingCategory: gold_mine → resource', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'gold_mine', x: 3, y: 3 }]);
  const mine = state.buildings.find((b) => b.building_type === 'gold_mine');
  assert.equal(mine?.category, 'resource');
});

test('getBuildingCategory: wall → wall', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'wall', x: 2, y: 2 }]);
  const wall = state.buildings.find((b) => b.building_type === 'wall');
  assert.equal(wall?.category, 'wall');
});

test('getBuildingCategory: town_hall → other', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'town_hall', x: 0, y: 0 }]);
  const th = state.buildings.find((b) => b.building_type === 'town_hall');
  assert.equal(th?.category, 'other');
});

test('deployUnit: militia bekommt target_priority nearest', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'town_hall', x: 5, y: 5 }], { militia: 1 });
  const result = deployUnit(cfg, state, { unit_type: 'militia', x: 0, y: 0 });
  assert.ok(result.ok);
  assert.equal(result.unit?.target_priority, 'nearest');
});

test('deployUnit: knight bekommt target_priority defense', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'town_hall', x: 5, y: 5 }], { knight: 1 });
  const result = deployUnit(cfg, state, { unit_type: 'knight', x: 0, y: 0 });
  assert.ok(result.ok);
  assert.equal(result.unit?.target_priority, 'defense');
});

test('deployUnit: berserker bekommt target_priority resource', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'town_hall', x: 5, y: 5 }], { berserker: 1 });
  const result = deployUnit(cfg, state, { unit_type: 'berserker', x: 0, y: 0 });
  assert.ok(result.ok);
  assert.equal(result.unit?.target_priority, 'resource');
});

test('deployUnit: battering_ram bekommt target_priority wall', () => {
  const cfg = makeCfg();
  const state = makeState(cfg, [{ type: 'town_hall', x: 5, y: 5 }], { battering_ram: 1 });
  const result = deployUnit(cfg, state, { unit_type: 'battering_ram', x: 0, y: 0 });
  assert.ok(result.ok);
  assert.equal(result.unit?.target_priority, 'wall');
});

test('Targeting: knight mit defense-Prio greift Kanone an, ignoriert nähere Goldmine', () => {
  const cfg = makeCfg();
  // Goldmine nah (x=1), Kanone weit (x=10) — knight soll zur Kanone
  const state = makeState(
    cfg,
    [
      { type: 'gold_mine', x: 1, y: 0 },
      { type: 'cannon', x: 10, y: 0 },
    ],
    { knight: 1 },
  );
  const r = deployUnit(cfg, state, { unit_type: 'knight', x: 0, y: 0 });
  assert.ok(r.ok);

  // Einen Tick simulieren → target_id muss die Kanone sein
  stepBattle(cfg, state, 0.1);
  const knight = state.units[0]!;
  const targetBuilding = state.buildings.find((b) => b.id === knight.target_id);
  assert.equal(targetBuilding?.building_type, 'cannon', 'Knight muss die Kanone anvisieren');
});

test('Targeting: berserker mit resource-Prio greift Goldmine an, ignoriert nähere Kanone', () => {
  const cfg = makeCfg();
  // Kanone nah (x=1), Goldmine weit (x=10) — berserker soll zur Goldmine
  const state = makeState(
    cfg,
    [
      { type: 'cannon', x: 1, y: 0 },
      { type: 'gold_mine', x: 10, y: 0 },
    ],
    { berserker: 1 },
  );
  deployUnit(cfg, state, { unit_type: 'berserker', x: 0, y: 0 });
  stepBattle(cfg, state, 0.1);
  const berserker = state.units[0]!;
  const targetBuilding = state.buildings.find((b) => b.id === berserker.target_id);
  assert.equal(targetBuilding?.building_type, 'gold_mine', 'Berserker muss die Goldmine anvisieren');
});

test('Targeting: battering_ram mit wall-Prio greift Mauer an, ignoriert Rathaus', () => {
  const cfg = makeCfg();
  const state = makeState(
    cfg,
    [
      { type: 'town_hall', x: 1, y: 0 },
      { type: 'wall', x: 8, y: 0 },
    ],
    { battering_ram: 1 },
  );
  deployUnit(cfg, state, { unit_type: 'battering_ram', x: 0, y: 0 });
  stepBattle(cfg, state, 0.1);
  const ram = state.units[0]!;
  const targetBuilding = state.buildings.find((b) => b.id === ram.target_id);
  assert.equal(targetBuilding?.building_type, 'wall', 'Rammbock muss die Mauer anvisieren');
});

test('Targeting: Fallback auf nearest wenn keine Prio-Gebäude mehr alive', () => {
  const cfg = makeCfg();
  const state = makeState(
    cfg,
    [
      { type: 'town_hall', x: 2, y: 0 },
      { type: 'cannon', x: 10, y: 0 },
    ],
    { knight: 1 },
  );
  // Kanone killen → knight soll auf nearest (Rathaus) fallen-back
  state.buildings.find((b) => b.building_type === 'cannon')!.alive = false;

  deployUnit(cfg, state, { unit_type: 'knight', x: 0, y: 0 });
  stepBattle(cfg, state, 0.1);
  const knight = state.units[0]!;
  const targetBuilding = state.buildings.find((b) => b.id === knight.target_id);
  assert.equal(targetBuilding?.building_type, 'town_hall', 'Knight muss auf Rathaus fallen-back');
});
