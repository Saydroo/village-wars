/** Domänen-/DB-Modelle (gespiegelt aus dem Schema in Abschnitt 3 des Briefings). */

import type { FactionId } from './gameConfig';

export type AuthProvider = 'apple' | 'google' | 'email';

export interface Player {
  id: string;
  username: string;
  email: string | null;
  auth_provider: AuthProvider;
  auth_provider_id: string | null;
  faction: FactionId;
  village_level: number;
  trophies: number;
  gold_bars: number;
  wood: number;
  stone: number;
  gold: number;
  gems: number;
  clan_id: string | null;
  last_active: string;
  created_at: string;
}

/** Spieler-Sicht ohne sicherheitsrelevante Felder (password_hash etc.). */
export type PublicPlayer = Omit<Player, never>;

export interface Village {
  id: string;
  player_id: string;
  grid_width: number;
  grid_height: number;
  layout: BuildingPlacement[];
  updated_at: string;
}

export interface BuildingPlacement {
  building_id: string;
  grid_x: number;
  grid_y: number;
}

export interface Building {
  id: string;
  player_id: string;
  building_type: string;
  level: number;
  grid_x: number;
  grid_y: number;
  upgrade_started_at: string | null;
  upgrade_finish_at: string | null;
  is_upgrading: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  player_id: string;
  unit_type: string;
  level: number;
  quantity: number;
  training_finish_at: string | null;
}

/** Ein laufender Trainings-Auftrag in der Warteschlange. */
export interface UnitTrainingItem {
  id: string;
  player_id: string;
  unit_type: string;
  quantity: number;
  started_at: string;
  finish_at: string;
}

/** Ein abgeschlossener PvP-Kampf (battles-Tabelle). */
export interface Battle {
  id: string;
  attacker_id: string;
  defender_id: string | null;
  mode: 'solo' | 'clan_war';
  result: 'attacker_win' | 'defender_win' | 'draw' | null;
  attacker_destruction_pct: number;
  defender_destruction_pct: number;
  loot_wood: number;
  loot_stone: number;
  trophies_change: number;
  duration_seconds: number | null;
  started_at: string;
  finished_at: string | null;
}

/** Ein eingelagertes Gebäude (im Inventar, nicht auf dem Grid). Behält seine Stufe. */
export interface InventoryItem {
  id: string;
  player_id: string;
  building_type: string;
  level: number;
  stored_at: string;
}

// --- Clans & Ranglisten (Phase 4) ---

export type ClanRole = 'leader' | 'co_leader' | 'member';

/** Banner-Baukasten (Form + Farben + Symbol, kein Bild-Upload). */
export interface ClanBanner {
  shape: string;
  primary_color: string;
  secondary_color: string;
  symbol: string;
  symbol_color: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  banner: ClanBanner;
  leader_id: string | null;
  season_points: number;
  total_wins: number;
  member_count: number;
  created_at: string;
}

/** Ein Clan-Mitglied inkl. angereicherter Spielerdaten (für die Mitgliederliste). */
export interface ClanMember {
  player_id: string;
  username: string;
  faction: FactionId;
  trophies: number;
  village_level: number;
  role: ClanRole;
  joined_at: string;
}

/** In der Clan-Burg eines Spielers stationierte Einheiten (Housing Space). */
export interface ClanCastleDefender {
  id: string;
  player_id: string;
  unit_type: string;
  quantity: number;
  donated_by: string | null;
}

export type ClanWarStatus = 'in_progress' | 'ended';

export interface ClanWar {
  id: string;
  clan_a_id: string;
  clan_b_id: string;
  clan_a_points: number;
  clan_b_points: number;
  winner_clan_id: string | null;
  status: ClanWarStatus;
  season_number: number | null;
  started_at: string;
  ends_at: string | null;
  finished_at: string | null;
}

/** Ein Eintrag der Solo-Rangliste (mit berechnetem Rang). */
export interface LeaderboardSoloEntry {
  rank: number;
  player_id: string;
  username: string;
  faction: FactionId;
  trophies: number;
}

/** Ein Eintrag der Clan-Rangliste (saisonbasiert, mit berechnetem Rang). */
export interface LeaderboardClanEntry {
  rank: number;
  clan_id: string;
  name: string;
  tag: string;
  banner: ClanBanner;
  season_points: number;
  member_count: number;
}

export interface Season {
  id: number;
  season_number: number;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

// --- Dungeon, Shop & Skins (Phase 5) ---

export type DungeonRunStatus = 'in_progress' | 'won' | 'lost';

/** Ein Dungeon-Lauf (PvE) eines Spielers für ein Wochenend-Fenster. */
export interface DungeonRun {
  id: string;
  player_id: string;
  season_week: string;
  difficulty: string;
  waves_completed: number;
  boss_defeated: boolean;
  gold_earned: number;
  gems_earned: number;
  status: DungeonRunStatus;
  started_at: string;
  finished_at: string | null;
}

/** Ein Skin (Katalog-Eintrag in der skins-Tabelle). Rein kosmetisch. */
export interface Skin {
  id: string;
  name: string;
  target_type: 'unit' | 'building' | 'village_theme';
  target_id: string;
  rarity: 'common' | 'rare';
  price_bars: number;
  preview_data: Record<string, unknown> | null;
}

/** Ein Skin im Shop inkl. Besitz-/Anwendungs-Status für den Spieler. */
export interface ShopSkin extends Skin {
  owned: boolean;
  applied: boolean;
}
