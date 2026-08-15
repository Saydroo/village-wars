/**
 * Kampf-Typen (Phase 3). Beschreiben den Echtzeit-Kampfzustand, die Socket.io-
 * Nachrichten (Abschnitt 8) und die Trainings-/Battle-DTOs. Enthalten KEINE
 * Zahlenwerte — die stammen aus game-config.json (Sektionen pvp, combat, units_*).
 */

import type { FactionId, BuildingCategory, TargetPriority } from './gameConfig';

export type BattleMode = 'solo' | 'clan_war' | 'friendly';
export type BattleResult = 'attacker_win' | 'defender_win' | 'draw';

export type BattleSide = 'attacker' | 'defender';

/**
 * Anim-Zustand einer Einheit für die Sprite-Wahl im Client (rein visuell, aus dem
 * Kampf-State abgeleitet — siehe deriveUnitVisual). idle=steht, walk=läuft auf ein
 * Ziel/eine Bresche zu, attack=schlägt ein Ziel in Reichweite.
 */
export type UnitVisualState = 'idle' | 'walk' | 'attack';

/**
 * Quantisierte Blickrichtung auf die 4 vorhandenen Sprite-Facings. Bezug ist die
 * Iso-Projektion (render.ts/gridToScreen) und die Master-Render-Konvention:
 *   az315 = Grid +x (unten-rechts), az225 = Grid -x (oben-links),
 *   az45  = Grid +y (unten-links),  az135 = Grid -y (oben-rechts).
 */
export type UnitFacing = 'az45' | 'az135' | 'az225' | 'az315';

/**
 * Eine Einheit im Kampf, serverseitig simuliert. side='attacker' = deploybare
 * Angreifer-Armee; side='defender' = aus der Clan-Burg stationierte Verteidiger,
 * die das Dorf beschützen.
 */
export interface BattleUnit {
  id: string;
  unit_type: string;
  /** 'attacker' (Armee) oder 'defender' (Clan-Burg-Verteidiger). */
  side: BattleSide;
  /** Aktuelle Position in (Float-)Grid-Koordinaten. */
  x: number;
  y: number;
  hp: number;
  max_hp: number;
  /** Schaden pro Sekunde (inkl. Fraktions-Modifikatoren). */
  dps: number;
  /** Heilung pro Sekunde (nur Support-Einheiten), sonst 0. */
  hps: number;
  /** Angriffs-/Heilreichweite in Tiles. */
  range: number;
  /** Bewegungsgeschwindigkeit in Tiles/Sekunde (inkl. Fraktions-Modifikator). */
  speed: number;
  /** Flächenschaden (Katapult/Felswerfer). */
  splash: boolean;
  /** ID des aktuell anvisierten Gebäudes/Gegners (oder null). */
  target_id: string | null;
  alive: boolean;
  /** Ziel-Priorität dieser Einheit (Roadmap P5). Default 'nearest'. */
  target_priority: TargetPriority;
  /**
   * Committete Durchbruchsstelle (Mauersegment-id) für das Bresche-Ansteuern
   * (Option A). Wird stabil gehalten, bis das Segment fällt bzw. die Lücke
   * passiert ist — verhindert Zwischenziel-Zappeln. Nur Angreifer; fehlt/null =
   * keine aktive Bresche.
   */
  breach_id?: string | null;
}

/**
 * Kampf-Stats des Helden (Roadmap P6). Werden im battleService aus der Helden-
 * Config + aktuellem Level abgeleitet (`heroCombatStats`) und der Engine beim
 * Init übergeben. Der Held ist eine deploybare Angreifer-Einheit mit eigenen
 * Werten (NICHT aus der units-Config) und wird nach dem Kampf nicht verbraucht.
 */
export interface BattleHeroStats {
  /** Stabiler Reserve-/Deploy-Schlüssel (HERO_UNIT_TYPE). */
  unit_type: string;
  display_name: string;
  hp: number;
  dps: number;
  hps: number;
  range: number;
  speed: number;
  splash: boolean;
}

/** Ein Gebäude im Kampf (Verteidiger-Dorf), Snapshot aus dem Layout. */
export interface BattleBuilding {
  id: string;
  building_type: string;
  level: number;
  gx: number;
  gy: number;
  hp: number;
  max_hp: number;
  /** Verteidigungsgebäude feuern auf Einheiten. */
  is_defense: boolean;
  /** Gebäude-Kategorie für Einheits-Ziel-Priorisierung (Roadmap P5). */
  category: BuildingCategory;
  /** Schaden pro Sekunde (nur Verteidigungsgebäude). */
  dps: number;
  range: number;
  alive: boolean;
}

/** Vollständiger, serverseitiger Kampfzustand. */
export interface BattleState {
  battle_id: string;
  mode: BattleMode;
  attacker_id: string;
  attacker_faction: FactionId;
  /** null bei Bot-Gegner. */
  defender_id: string | null;
  defender_faction: FactionId;
  is_bot: boolean;
  units: BattleUnit[];
  /** Aus der Clan-Burg des Verteidigers stationierte Einheiten (verteidigen das Dorf). */
  defenders: BattleUnit[];
  buildings: BattleBuilding[];
  /** Verbleibende, noch deploybare Einheiten der Angreifer-Armee. */
  reserve: Record<string, number>;
  /** Erforschte Truppen-Level des Angreifers (Roadmap P3; fehlt → Level 1). */
  attacker_unit_levels: Record<string, number>;
  /** Helden-Kampfstats des Angreifers (Roadmap P6; null = kein einsatzbereiter Held). */
  hero: BattleHeroStats | null;
  total_building_hp: number;
  destroyed_building_hp: number;
  destruction_pct: number;
  elapsed_seconds: number;
  duration_seconds: number;
  finished: boolean;
  result: BattleResult | null;
}

/** Kompakte Zustandsübertragung an den Client (battle:state_update). */
export interface BattleStateUpdate {
  timer: number;
  destruction_pct: number;
  units: Array<{
    id: string;
    unit_type: string;
    side: BattleSide;
    x: number;
    y: number;
    hp: number;
    max_hp: number;
    /** Abgeleiteter Anim-Zustand (idle/walk/attack) für die Sprite-Wahl. */
    state: UnitVisualState;
    /** Quantisierte Blickrichtung (az45/az135/az225/az315) für die Sprite-Wahl. */
    facing: UnitFacing;
  }>;
  buildings: Array<{ id: string; hp: number; max_hp: number; alive: boolean }>;
}

/** Ergebnis-Payload (battle:ended). */
export interface BattleEndedPayload {
  result: BattleResult;
  destruction_pct: number;
  loot: { wood: number; stone: number };
  trophies_change: number;
  /** 'clan_war' kennzeichnet ein Krieg-Duell (keine Solo-Trophäen/Loot). */
  mode?: BattleMode;
}

// --- Socket.io Event-Namen & Payloads (Abschnitt 8) ---
export interface DeployUnitPayload {
  unit_type: string;
  x: number;
  y: number;
}

export interface MatchmakingMatchedPayload {
  battle_id: string;
  defender_username: string;
  defender_faction: FactionId;
  is_bot: boolean;
  /** 'clan_war' bei einem Clan-Krieg-Duell, sonst 'solo'. */
  mode?: BattleMode;
}

/** Snapshot des Verteidiger-Layouts für die Battle-Vorschau. */
export interface BattleSetupPayload {
  battle_id: string;
  defender_username: string;
  defender_faction: FactionId;
  is_bot: boolean;
  grid_width: number;
  grid_height: number;
  buildings: BattleBuilding[];
  /** Deploybare Armee des Angreifers (unit_type -> Anzahl), inkl. Held falls einsatzbereit. */
  army: Record<string, number>;
  /** Einsatzbereiter Held des Angreifers (Roadmap P6), sonst null. */
  hero: BattleHeroStats | null;
  duration_seconds: number;
}
