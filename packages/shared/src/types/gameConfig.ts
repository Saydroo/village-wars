/**
 * Typen für die Struktur von `server/config/game-config.json`.
 *
 * Die JSON-Datei ist die EINZIGE Quelle aller Zahlenwerte. Diese Typen
 * beschreiben ihre Form, damit Front- und Backend sie typsicher konsumieren
 * können. Sie enthalten selbst KEINE Zahlenwerte.
 */

export type FactionId =
  | 'humans'
  | 'fishfolk'
  | 'giants'
  | 'dwarves'
  | 'elves'
  | 'undead'
  | 'orcs'
  | 'dragonfolk';

export const FACTION_IDS: readonly FactionId[] = [
  'humans',
  'fishfolk',
  'giants',
  'dwarves',
  'elves',
  'undead',
  'orcs',
  'dragonfolk',
];

/** Fraktions-Modifikatoren. Alle Felder optional, da pro Fraktion nur die
 *  abweichenden Multiplikatoren gesetzt sein müssen (Baseline = Menschen = 1.0). */
export interface FactionModifiers {
  build_time_multiplier?: number;
  build_cost_multiplier?: number;
  resource_production_multiplier?: number;
  resource_production_multiplier_water_adjacent?: number;
  resource_production_multiplier_stone?: number;
  resource_production_multiplier_gold?: number;
  wall_hp_multiplier?: number;
  building_hp_multiplier?: number;
  unit_hp_multiplier?: number;
  unit_damage_multiplier?: number;
  melee_unit_damage_multiplier?: number;
  ranged_unit_damage_multiplier?: number;
  unit_speed_multiplier?: number;
  attack_speed_multiplier?: number;
  unit_cost_multiplier?: number;
  defense_building_cost_multiplier?: number;
  upgrade_cost_multiplier?: number;
  [key: string]: number | undefined;
}

export interface FactionConfig {
  display_name: string;
  theme: string;
  bonus?: string | null;
  malus?: string | null;
  bonus_description?: string;
  malus_description?: string;
  modifiers: FactionModifiers;
}

export interface ResourceCost {
  wood?: number;
  stone?: number;
  gold?: number;
  gems?: number;
}

export interface TownHallLevelRequirement {
  level: number;
  wood: number;
  stone: number;
  gold?: number;
  gems?: number;
  build_time_minutes: number;
}

export interface BuildingLevelEntry {
  level: number;
  wood_cost: number;
  stone_cost: number;
  build_time_minutes: number;
}

export interface CommonBuildingConfig {
  display_name: string;
  unlock_town_hall_level: number;
  max_level?: number;
  function?: string;
  type?: string;
  base_production_per_hour?: number;
  production_growth_per_level_percent?: number;
  base_capacity?: number;
  capacity_growth_per_level_percent?: number;
  base_hp?: number;
  hp_growth_per_level_percent?: number;
  base_damage_per_second?: number;
  range_tiles?: number;
  cost_per_segment_level_1?: ResourceCost;
  levels?: BuildingLevelEntry[] | string;
  see?: string;
  /** Pauschale Baukosten zum Platzieren (Stufe 1), wenn keine `levels`-Tabelle existiert
   *  (z.B. Lager, Kaserne, Wachturm, Kanone). Holzfäller/Steinbruch nutzen `levels[0]`. */
  wood_cost?: number;
  stone_cost?: number;
  gold_cost?: number;
  build_time_minutes?: number;
}

export interface CommonUnitConfig {
  display_name: string;
  unlock_town_hall_level: number;
  role: string;
  housing_space: number;
  hp: number;
  damage_per_second?: number;
  heal_per_second?: number;
  range_tiles?: number;
  splash_damage?: boolean;
  speed: string;
  cost: ResourceCost;
  train_time_seconds: number;
}

export interface ExclusiveBuildingConfig {
  id: string;
  display_name: string;
  unlock_town_hall_level: number;
  function?: string;
  type?: string;
  base_hp?: number;
  wood_cost?: number;
  stone_cost?: number;
  gold_cost?: number;
  build_time_minutes?: number;
}

export interface ExclusiveUnitConfig {
  id: string;
  display_name: string;
  unlock_town_hall_level: number;
  role: string;
  housing_space: number;
  hp: number;
  damage_per_second?: number;
  range_tiles?: number;
  splash_damage?: boolean;
  speed: string;
  special_ability?: string;
  special_trait?: string;
  cost: ResourceCost;
  train_time_seconds: number;
}

export interface FactionExclusiveContent {
  exclusive_buildings: ExclusiveBuildingConfig[];
  exclusive_units: ExclusiveUnitConfig[];
}

/** Ein Fraktions-Held (Roadmap P6). */
export interface FactionHeroDef {
  id: string;
  display_name: string;
  housing_space: number;
  base_hp: number;
  base_dps: number;
  range_tiles?: number;
  splash_damage?: boolean;
  speed: string;
  ability?: string;
}

/** Level-Kosten für einen Helden (analog zu ResearchLevelCost). */
export interface HeroLevelCost {
  to_level: number;
  gold: number;
  minutes: number;
}

/** Helden-System-Konfiguration (Roadmap P6). */
export interface HeroesConfig {
  description?: string;
  max_level: number;
  hp_bonus_per_level_percent: number;
  dps_bonus_per_level_percent: number;
  regen_minutes_per_level: number;
  requires_building: string;
  level_costs: HeroLevelCost[];
  faction_heroes: Partial<Record<FactionId, FactionHeroDef>>;
}

/** Gebäude-Kategorie für Ziel-Priorisierung (Roadmap P5). */
export type BuildingCategory = 'defense' | 'resource' | 'wall' | 'other';

/** Ziel-Priorität einer Einheit. 'nearest' = Standard (nächstes lebendes Gebäude). */
export type TargetPriority = 'nearest' | 'defense' | 'resource' | 'wall';

/** Konfiguration der Ziel-Prioritäten (Roadmap P5). */
export interface UnitTargetPrioritiesConfig {
  description?: string;
  building_categories: {
    defense: string[];
    resource: string[];
    wall: string[];
  };
  unit_priorities: Record<string, TargetPriority | string>;
}

/** Quest-Typ (welche Spieler-Aktion wird gezählt). */
export type QuestType = 'attacks' | 'upgrades' | 'troops_trained' | 'researches';

/** Eine tägliche Quest-Definition aus der Config. */
export interface DailyQuestDef {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: QuestType;
  target: number;
  reward_gold: number;
  reward_gems: number;
}

export interface DailyQuestsConfig {
  description?: string;
  definitions: DailyQuestDef[];
}

/** Eine Belohnung (Ressourcen werden gekappt, Währungen nicht). Alle Felder optional. */
export interface SeasonPassReward {
  wood?: number;
  stone?: number;
  gold?: number;
  gems?: number;
  gold_bars?: number;
}

/** Eine Stufe des Season-Pass mit Gratis- und Premium-Belohnung (Roadmap P7). */
export interface SeasonPassTier {
  tier: number;
  /** Kumulative XP, ab der diese Stufe erreicht ist. */
  xp_required: number;
  free: SeasonPassReward;
  premium: SeasonPassReward;
}

/** Pass-XP je Spieler-Aktion. */
export interface SeasonPassXpSources {
  battle_win: number;
  dungeon_clear: number;
  quest_claim: number;
}

/** Welche XP-Quelle löste den Zuwachs aus (für addSeasonPassXp). */
export type SeasonPassXpAction = keyof SeasonPassXpSources;

/** Konfiguration des Season-/Battle-Pass (Roadmap P7). */
export interface SeasonPassConfig {
  description?: string;
  premium_cost_gems: number;
  xp_per_action: SeasonPassXpSources;
  tiers: SeasonPassTier[];
}

/** Kosten für das Erforschen eines bestimmten Truppen-Levels. */
export interface ResearchLevelCost {
  to_level: number;
  gold: number;
  minutes: number;
}

/** Konfiguration des Forschungslabors (Roadmap P3). */
export interface UnitResearchConfig {
  description?: string;
  max_level: number;
  hp_bonus_per_level_percent: number;
  dps_bonus_per_level_percent: number;
  requires_building: string;
  level_costs: ResearchLevelCost[];
}

export interface GameConfig {
  _meta: {
    version: string;
    description: string;
    currency_legend: Record<string, string>;
    balance_principle: string;
  };
  factions: Record<FactionId, FactionConfig>;
  town_hall_levels: {
    description: string;
    max_level: number;
    upgrade_requirements: TownHallLevelRequirement[];
  };
  build_time_skip: {
    description: string;
    cost_per_minute_remaining: Record<
      string,
      { max_minutes: number; bars_per_minute: number }
    >;
    minimum_cost_bars: number;
    notes: string;
  };
  faction_change: {
    description: string;
    cost_bars: number;
  };
  resources: Record<string, unknown>;
  economy: {
    description?: string;
    resource_cap_multiplier: number;
    storage_baseline_from_town_hall?: boolean;
    storage_baseline_note?: string;
  };
  daily_rewards: DailyRewardsConfig;
  achievements: AchievementsConfig;
  unit_research: UnitResearchConfig;
  unit_target_priorities: UnitTargetPrioritiesConfig;
  heroes: HeroesConfig;
  daily_quests: DailyQuestsConfig;
  onboarding: OnboardingConfig;
  events: EventsConfig;
  season_pass: SeasonPassConfig;
  pvp: {
    match_duration_seconds: number;
    win_destruction_threshold_pct: number;
    win_destruction_note?: string;
    loot_on_victory: {
      wood_percentage: number;
      stone_percentage: number;
      gold_percentage: number;
      gems_percentage: number;
    };
    loot_note: string;
    trophy_change: {
      win_base: number;
      loss_base: number;
      win_min: number;
      win_max: number;
      loss_min_magnitude: number;
      loss_max_magnitude: number;
      diff_scale_trophies: number;
      note: string;
    };
    matchmaking: {
      online_only: boolean;
      base_tolerance_trophies: number;
      expansions: Array<{ after_seconds: number; tolerance_trophies: number }>;
      bot_after_seconds: number;
      tick_seconds: number;
      note?: string;
    };
    modes: string[];
  };
  combat: {
    description?: string;
    tick_rate_per_second: number;
    unit_speed_tiles_per_second: Record<string, number>;
    melee_range_tiles: number;
    splash_radius_tiles: number;
    healer_range_tiles: number;
    building_hp: Record<string, number | string>;
    building_hp_growth_per_level_percent: number;
    defense_dps_growth_per_level_percent: number;
    /** Reichweite, ab der Angreifer einen Clan-Burg-Verteidiger angreifen (Phase 4). */
    defender_aggro_radius_tiles: number;
    defender_aggro_note?: string;
    deploy_note?: string;
    destruction_note?: string;
    deferred_unit_specials_note?: string;
  };
  dungeon: DungeonConfig;
  clan: {
    unlock_town_hall_level: number;
    max_members: number;
    tag_length_min: number;
    tag_length_max: number;
    name_length_min: number;
    name_length_max: number;
    season_reset_weeks: number;
    profanity_extra_words: string[];
    leaderboard_rewards_bars: Record<string, number>;
    clan_castle: {
      description: string;
      levels: Array<{
        level: number;
        housing_space: number;
        wood: number;
        stone: number;
        gold?: number;
        build_time_minutes: number;
      }>;
    };
    banner_options: {
      description?: string;
      shapes: string[];
      symbols: string[];
      colors: string[];
    };
    war: {
      description?: string;
      min_members_per_clan: number;
      duration_minutes: number;
      queue_tolerance_members: number;
      queue_bot_after_seconds: number;
      attacks_per_member: number;
      win_season_points: number;
      draw_season_points: number;
    };
  };
  leaderboard: {
    description?: string;
    default_page_size: number;
    max_page_size: number;
  };
  buildings_common: Record<string, CommonBuildingConfig> & { description: string };
  units_common: Record<string, CommonUnitConfig> & { description: string };
  factions_exclusive_content: Record<FactionId, FactionExclusiveContent>;
  skins: SkinsConfig;
  iap: IapConfig;
  effects: EffectsConfig;
}

// --- Phase 5: Dungeon, Skins, IAP -------------------------------------------

/** Der Dungeon-Endboss (einzelne, stark verstärkte Einheit). */
export interface DungeonBoss {
  display_name?: string;
  unit_type: string;
  count: number;
  hp_multiplier: number;
  damage_multiplier: number;
  boss_note?: string;
}

/** Eine wählbare Schwierigkeitsstufe (skaliert Gegnerstärke, Menge und Belohnung). */
export interface DungeonDifficulty {
  id: string;
  display_name: string;
  enemy_strength_multiplier: number;
  wave_budget_multiplier: number;
  reward_multiplier: number;
}

/** Parameter für die zufällige (geseedete) Wellen-Generierung. */
export interface DungeonWaveGeneration {
  enemy_pool: Array<{ unit_type: string; cost: number }>;
  base_budget: number;
  budget_growth_per_wave: number;
  wave_stat_growth_per_wave_percent: number;
  min_enemies_per_wave: number;
  max_enemy_units: number;
  notes?: string;
}

/** Eine Belohnungs-Stufe (Abschnitt 9). Es greift das höchste erreichte Tier. */
export interface DungeonRewardTier {
  label?: string;
  min_waves_completed: number;
  requires_boss: boolean;
  gold_min: number;
  gold_max: number;
  gems_min: number;
  gems_max: number;
}

/** Eine Stufe der täglichen Login-Belohnungs-Leiter (Roadmap P1). */
export interface DailyRewardTier {
  day: number;
  wood: number;
  stone: number;
  gold: number;
  gems: number;
  gold_bars: number;
  label?: string;
}

export interface DailyRewardsConfig {
  description?: string;
  /** Ressourcen-Beträge mit dem Rathaus-Level skalieren (Gems/Goldbarren nicht). */
  scale_resources_with_town_hall?: boolean;
  scale_note?: string;
  /** Belohnungsleiter; Länge = Zyklus. Streak-Tag → Stufe ((streak-1) mod ladder.length). */
  ladder: DailyRewardTier[];
}

/** Metriken, gegen die Achievements geprüft werden (live aus dem Spielstand). */
export type AchievementMetric =
  | 'trophies'
  | 'town_hall_level'
  | 'battles_won'
  | 'longest_daily_streak'
  | 'dungeons_cleared'
  | 'clan_member'
  | 'buildings_count';

export interface AchievementTier {
  threshold: number;
  gems: number;
  gold_bars: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  metric: AchievementMetric;
  /** Aufsteigend nach threshold sortierte Stufen. */
  tiers: AchievementTier[];
}

export interface AchievementsConfig {
  description?: string;
  definitions: AchievementDef[];
}

/** Live-Metriken für Onboarding-Schritte (Roadmap P8). 'none' = sofort erfüllt. */
export type OnboardingMetric =
  | 'none'
  | 'buildings_count'
  | 'army_size'
  | 'battles_won'
  | 'clan_member';

/** Einmalige Starthilfe-Belohnung eines Onboarding-Schritts (alle Felder optional). */
export interface OnboardingReward {
  wood?: number;
  stone?: number;
  gold?: number;
  gems?: number;
  gold_bars?: number;
}

export interface OnboardingStepDef {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  metric: OnboardingMetric;
  /** Schwelle des Live-Werts; 0 (mit metric 'none') = sofort erfüllt. */
  target: number;
  reward: OnboardingReward;
}

export interface OnboardingConfig {
  description?: string;
  /** Geordnete Schrittfolge; wird strikt der Reihe nach abgeholt. */
  steps: OnboardingStepDef[];
}

/** Live-Metriken für Event-Aufgaben (Roadmap P7-Folge) — gezählt SEIT Event-Start. */
export type EventMetric = 'battles_won' | 'dungeons_cleared';

/** Einmalige Belohnung einer Event-Aufgabe (alle Felder optional). */
export interface EventReward {
  wood?: number;
  stone?: number;
  gold?: number;
  gems?: number;
  gold_bars?: number;
}

export interface EventChallengeDef {
  id: string;
  name: string;
  description?: string;
  metric: EventMetric;
  target: number;
  reward: EventReward;
}

export interface EventDef {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  /** Aktiv-Fenster (ISO-UTC). */
  starts_at: string;
  ends_at: string;
  challenges: EventChallengeDef[];
}

export interface EventsConfig {
  description?: string;
  definitions: EventDef[];
}

export interface DungeonConfig {
  description?: string;
  schedule: {
    opens: string;
    closes: string;
    timezone: string;
    open_weekday: number;
    open_hour: number;
    close_weekday: number;
    close_hour: number;
    duration_hours: number;
    frequency: string;
  };
  structure: { waves: number; final_boss: boolean };
  dev_always_open: boolean;
  dev_always_open_note?: string;
  one_run_per_week: boolean;
  npc_faction: string;
  npc_faction_note?: string;
  max_wave_seconds: number;
  default_difficulty: string;
  difficulties: DungeonDifficulty[];
  difficulties_note?: string;
  wave_generation: DungeonWaveGeneration;
  boss: DungeonBoss;
  replay_capture_interval_ticks: number;
  replay_max_frames: number;
  replay_note?: string;
  reward_tiers: DungeonRewardTier[];
  rewards_note?: string;
}

/** Ein Skin-Katalog-Eintrag (rein kosmetisch). */
export interface SkinCatalogEntry {
  id: string;
  name: string;
  target_type: 'unit' | 'building' | 'village_theme';
  target_id: string;
  rarity: 'common' | 'rare';
  price_bars: number;
  preview_data?: Record<string, unknown>;
}

export interface SkinsConfig {
  description?: string;
  example_pricing_bars?: Record<string, number>;
  catalog: SkinCatalogEntry[];
}

/** Ein käufliches Goldbarren-Paket (Abschnitt 12). */
export interface IapPackage {
  product_id: string;
  display_name: string;
  bars: number;
  price_eur: number;
}

export interface IapConfig {
  description?: string;
  packages: IapPackage[];
  sandbox_note?: string;
}

// --- Phase 6: Grafik & Effekte (Game Juice) ---------------------------------

/** Start-Intensitäten für den Screenshake je Ereignis + Abkling-Parameter. */
export interface ScreenshakeConfig {
  unit_hits_wall: number;
  tower_fires: number;
  heavy_unit_lands: number;
  building_destroyed: number;
  town_hall_destroyed: number;
  decay_per_frame: number;
  min_intensity: number;
}

/** Verhalten der aufsteigenden Zahlen (Floating Combat Text). */
export interface FloatingTextConfig {
  rise_px_per_frame: number;
  life_decay_per_frame: number;
  shadow: boolean;
  colors: {
    damage: string;
    resource: string;
    trophy_gain: string;
    trophy_loss: string;
    crit: string;
  };
}

/** Squash-&-Stretch-Skalierungen (rein kosmetisch). */
export interface SquashConfig {
  button_press_scale: number;
  upgrade_peak_scale: number;
  spawn_start_scale: number;
  spawn_overshoot_scale: number;
  destroy_collapse_seconds: number;
}

/** Atmosphäre der Dorf-Ansicht (Idle-Atmung, wehende Fahnen). */
export interface IdleConfig {
  breathing_amplitude: number;
  breathing_period_seconds: number;
  flag_sway_amplitude_deg: number;
  flag_sway_period_seconds: number;
}

/** Ein Partikel-Preset (Anzahl + grobe Parameter; Verhalten lebt im Code). */
export interface ParticlePreset {
  count: number;
  size_min: number;
  size_max: number;
  speed: number;
  gravity: number;
  decay: number;
  colors: string[];
}

export interface EffectsConfig {
  description?: string;
  /** Globale Partikel-Obergrenze (ältester wird verdrängt). */
  particle_cap: number;
  /** Reduzierte Obergrenze bei FPS-Einbruch / „Effekte reduzieren". */
  particle_cap_reduced: number;
  fps_target: number;
  /** Standardwert der „Effekte reduzieren"-Einstellung. */
  reduce_effects_default: boolean;
  /** Dauer der Bildschirmübergänge (ms). */
  screen_transition_ms: number;
  screenshake: ScreenshakeConfig;
  floating_text: FloatingTextConfig;
  squash: SquashConfig;
  idle: IdleConfig;
  /** Partikel-Presets (Abschnitt 4 der Game-Juice-Spec). */
  presets: Record<string, ParticlePreset>;
  performance_note?: string;
}
