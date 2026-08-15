/** Request-/Response-DTOs für die REST-API. */

import type {
  Player,
  Village,
  Building,
  InventoryItem,
  Unit,
  UnitTrainingItem,
  Battle,
  Clan,
  ClanMember,
  ClanCastleDefender,
  ClanWar,
  LeaderboardSoloEntry,
  LeaderboardClanEntry,
  DungeonRun,
  ShopSkin,
} from './models';
import type {
  IapPackage,
  AchievementTier,
  AchievementMetric,
  SeasonPassReward,
  OnboardingMetric,
  OnboardingReward,
  EventMetric,
  EventReward,
} from './gameConfig';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  player: Player;
  tokens: AuthTokens;
}

/** Bei OAuth-Erstanmeldung ohne username/faction: Profil-Vervollständigung nötig. */
export interface OAuthNeedsProfileResponse {
  needsProfile: true;
  provider: 'apple' | 'google';
  email: string | null;
}

export interface VillageResponse {
  village: Village;
  buildings: Building[];
}

/** Inhalt des Gebäude-Inventars eines Spielers. */
export interface InventoryResponse {
  inventory: InventoryItem[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Lagerkapazitäten je Basis-Ressource. */
export interface ResourceCapacities {
  wood: number;
  stone: number;
  gold: number;
}

/** Antwort auf Upgrade-Start/-Skip: aktualisiertes Gebäude + Spieler. */
export interface UpgradeResponse {
  building: Building;
  player: Player;
}

/** Spieler inkl. abgeleiteter Kapazitäten (für die Ressourcenanzeige). */
export interface PlayerStateResponse {
  player: Player;
  capacities: ResourceCapacities;
}

/** Armee-Übersicht: fertige Einheiten + laufende Trainings-Aufträge. */
export interface ArmyResponse {
  units: Unit[];
  training: UnitTrainingItem[];
}

/** Antwort auf Einheiten-Training: aktualisierte Armee + Spieler. */
export interface TrainResponse {
  units: Unit[];
  training: UnitTrainingItem[];
  player: Player;
}

/** Kampf-Historie. */
export interface BattleHistoryResponse {
  battles: Battle[];
}

// --- Clans & Ranglisten (Phase 4) ---

/** Kurzform eines Clans für Listen/Suche. */
export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  banner: Clan['banner'];
  member_count: number;
  season_points: number;
  total_wins: number;
}

export interface ClanListResponse {
  clans: ClanSummary[];
}

/** Vollansicht eines Clans: Stammdaten + Mitglieder + ggf. laufender Krieg. */
export interface ClanDetailResponse {
  clan: Clan;
  members: ClanMember[];
  war: ClanWar | null;
}

/** Antwort auf clan-verändernde Aktionen (Erstellen/Beitreten/Verlassen). */
export interface ClanMembershipResponse {
  clan: Clan | null;
  player: Player;
}

/** Inhalt der eigenen Clan-Burg inkl. Housing-Auslastung. */
export interface CastleResponse {
  castle_level: number;
  housing_used: number;
  housing_capacity: number;
  defenders: ClanCastleDefender[];
}

/** Aktueller Clan-Krieg eines Spielers (oder null) + Beitrag pro Mitglied. */
export interface ClanWarResponse {
  war: ClanWar | null;
  my_clan_id: string | null;
}

// --- Clan-Chat (Roadmap P9) --------------------------------------------------

/** Eine Clan-Chat-Nachricht (username = Snapshot zum Sendezeitpunkt). */
export interface ClanChatMessage {
  id: string;
  clan_id: string;
  /** Absender-Spieler-ID; null, wenn der Absender das Konto verlassen/gelöscht hat. */
  player_id: string | null;
  username: string;
  body: string;
  created_at: string;
}

/** Chat-Verlauf (neueste zuerst). has_more = ältere Nachrichten vorhanden. */
export interface ClanChatResponse {
  messages: ClanChatMessage[];
  has_more: boolean;
}

/** Antwort auf das Senden einer Chat-Nachricht. */
export interface ClanChatSendResponse {
  message: ClanChatMessage;
}

// --- Clan-Spenden-Anfragen (Roadmap P9) --------------------------------------

/** Eine offene/erfüllte Truppen-Spenden-Anfrage eines Clan-Mitglieds. */
export interface ClanDonationRequest {
  id: string;
  clan_id: string;
  player_id: string;
  /** Anzeigename des Anfragenden (Snapshot aus players). */
  username: string;
  /** Gewünschter Einheitstyp (optional). */
  requested_unit_type: string | null;
  /** Burg-Housing-Kapazität des Anfragenden zum Anfragezeitpunkt. */
  capacity: number;
  /** Bereits über diese Anfrage gespendetes Housing. */
  received: number;
  status: 'open' | 'fulfilled';
  created_at: string;
}

export interface ClanDonationListResponse {
  requests: ClanDonationRequest[];
  /** Eigene offene Anfrage (oder null). */
  my_request: ClanDonationRequest | null;
}

export interface LeaderboardSoloResponse {
  entries: LeaderboardSoloEntry[];
  page: number;
  page_size: number;
  total: number;
  me: LeaderboardSoloEntry | null;
}

export interface LeaderboardClanResponse {
  entries: LeaderboardClanEntry[];
  page: number;
  page_size: number;
  total: number;
  season_number: number;
  me: LeaderboardClanEntry | null;
}

// --- Dungeon (Phase 5) ---

/** Eine Welle in der Vorschau — die Gegner sind VERBORGEN (nur Nummer/Boss-Flag). */
export interface DungeonWavePreview {
  wave: number;
  is_boss: boolean;
}

/** Eine einzelne Einheit in einem Replay-Frame (kompakt). */
export interface DungeonReplayUnit {
  id: string;
  unit_type: string;
  side: 'player' | 'enemy';
  x: number;
  y: number;
  /** HP-Anteil 0..1 (auf 2 Nachkommastellen gerundet). */
  hp: number;
}

/** Ein Zeit-Schnappschuss des Kampfes (für die animierte Wiedergabe). */
export interface DungeonReplayFrame {
  t: number;
  units: DungeonReplayUnit[];
}

/** Deterministische Aufzeichnung eines Wellen-Kampfes für die Client-Animation. */
export interface DungeonReplay {
  duration_seconds: number;
  cleared: boolean;
  frames: DungeonReplayFrame[];
}

/** Ist der Dungeon gerade offen? + Zeitfenster + aktueller Lauf. */
export interface DungeonStatusResponse {
  open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  total_waves: number;
  has_boss: boolean;
  run: DungeonRun | null;
  /** true, wenn dieser Spieler diese Woche bereits beendet hat (one_run_per_week). */
  completed_this_week: boolean;
}

/** Antwort auf Dungeon-Start: der Lauf + Wellen-Übersicht (verborgen) + eingesetzte Armee. */
export interface DungeonStartResponse {
  run: DungeonRun;
  waves: DungeonWavePreview[];
  army: Record<string, number>;
}

/** Ergebnis einer Welle: Replay + Ausgang + verbleibende Armee + (bei Run-Ende) Belohnung. */
export interface DungeonWaveResponse {
  run: DungeonRun;
  cleared: boolean;
  wave: number;
  is_boss: boolean;
  /** Erst NACH dem Kampf enthüllt: was in der Welle wartete (unit_type -> Anzahl). */
  enemies_faced: Record<string, number>;
  army_remaining: Record<string, number>;
  enemies_remaining: Record<string, number>;
  /** Animierte Kampf-Aufzeichnung (Frames). */
  replay: DungeonReplay;
  finished: boolean;
  rewards: { gold: number; gems: number; tier_label: string | null } | null;
  player: Player;
}

export interface DungeonHistoryResponse {
  runs: DungeonRun[];
}

// --- Shop & Skins (Phase 5) ---

export interface ShopSkinsResponse {
  skins: ShopSkin[];
  gold_bars: number;
}

/** Antwort auf Skin-Kauf/Anwenden: aktualisierte Skin-Liste + Goldbarren. */
export interface ShopActionResponse {
  skins: ShopSkin[];
  gold_bars: number;
  player: Player;
}

/** Verfügbare Goldbarren-Pakete (IAP). */
export interface IapPackagesResponse {
  packages: IapPackage[];
}

/** Antwort auf eine IAP-Goldbarren-Gutschrift. */
export interface IapPurchaseResponse {
  player: Player;
  bars_credited: number;
  product_id: string;
  already_processed: boolean;
}

// --- Daily Rewards (Roadmap P1) ---

/** Eine bereits skalierte/aufbereitete Belohnungs-Stufe für die Anzeige. */
export interface DailyRewardView {
  day: number;
  wood: number;
  stone: number;
  gold: number;
  gems: number;
  gold_bars: number;
  label?: string;
}

/** Status der täglichen Belohnung (für das Daily-Reward-Popup). */
export interface DailyRewardStatusResponse {
  /** Kann heute abgeholt werden? */
  can_claim: boolean;
  /** Aktueller Streak (abgeholte Tage in Folge); 0 wenn noch nie / zurückgesetzt. */
  streak: number;
  /** Längster je erreichter Streak. */
  longest_streak: number;
  /** Streak-Tag, den ein Claim JETZT belegen würde (1-basiert). */
  next_streak_day: number;
  /** true, wenn der Streak vor diesem Claim zurückgesetzt wurde (Tag verpasst). */
  streak_reset: boolean;
  /** Vollständige Leiter (skaliert), zur Anzeige des Fortschritts. */
  ladder: DailyRewardView[];
  /** Belohnung, die ein Claim JETZT gäbe (= ladder[(next_streak_day-1) % len]). */
  todays_reward: DailyRewardView;
}

/** Antwort auf einen erfolgreichen Claim. */
export interface DailyRewardClaimResponse {
  player: Player;
  reward: DailyRewardView;
  streak: number;
  longest_streak: number;
  /** Anteile, die durch den Lager-Cap verfielen (zur ehrlichen Anzeige), optional. */
  capped?: { wood: number; stone: number; gold: number };
}

// --- Achievements (Roadmap P2) ---

/** Ein Achievement mit Live-Fortschritt + Anspruch (für den Achievements-Screen). */
export interface AchievementView {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  metric: AchievementMetric;
  /** Aktueller Metrik-Wert des Spielers. */
  value: number;
  tiers: AchievementTier[];
  /** Anzahl erreichter Stufen (0..tiers.length). */
  reached_tier: number;
  /** Anzahl bereits abgeholter Stufen. */
  claimed_tier: number;
  /** true, wenn erreichte > abgeholte Stufen (jetzt abholbar). */
  claimable: boolean;
  /** Nächste noch nicht erreichte Schwelle (für die Fortschrittsanzeige), oder null = max. */
  next_threshold: number | null;
}

export interface AchievementsResponse {
  achievements: AchievementView[];
}

export interface AchievementClaimResponse {
  player: Player;
  achievement: AchievementView;
  claimed_gems: number;
  claimed_gold_bars: number;
}

// --- Truppen-Level-Forschung (Roadmap P3) ------------------------------------

export interface ResearchQueueEntry {
  id: string;
  unit_type: string;
  target_level: number;
  started_at: string;
  finishes_at: string;
}

export interface ResearchStatusResponse {
  /** Aktuell erforschte Level je Einheitstyp (fehlt → Level 1). */
  unit_levels: Record<string, number>;
  /** Laufende Forschung (null = keine). */
  active: ResearchQueueEntry | null;
}

/** Helden-Status eines Spielers (Roadmap P6). */
export interface HeroStatusResponse {
  /** Helden-ID (z.B. 'king_arthur') oder null wenn kein Hero Hall gebaut. */
  hero_id: string | null;
  display_name: string | null;
  level: number;
  /** Laufendes Level-Up endet um diesen ISO-Zeitstempel (null = kein Upgrade läuft). */
  leveling_until: string | null;
  /** Held regeneriert sich bis zu diesem ISO-Zeitstempel (null = bereit für Einsatz). */
  regenerates_until: string | null;
  /** true wenn keine Hero Hall gebaut. */
  no_hall: boolean;
  /** Aktuelle Basis-HP (Level-skaliert). */
  base_hp: number;
  /** Aktuelle Basis-DPS (Level-skaliert). */
  base_dps: number;
}

/** Eine einzelne Quest mit aktuellem Fortschritt (Roadmap P4). */
export interface DailyQuestProgress {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: string;
  target: number;
  progress: number;
  claimed: boolean;
  reward_gold: number;
  reward_gems: number;
}

export interface DailyQuestsResponse {
  quests: DailyQuestProgress[];
  /** UTC-Datum des aktuellen Quest-Tags (ISO YYYY-MM-DD). */
  quest_date: string;
}

// --- Onboarding / Tutorial (Roadmap P8) --------------------------------------

/** Ein Onboarding-Schritt mit Live-Fortschritt + Status (für den Tutorial-Screen). */
export interface OnboardingStepView {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  metric: OnboardingMetric;
  target: number;
  /** Aktueller Live-Metrik-Wert des Spielers. */
  value: number;
  /** true, wenn value >= target (Bedingung erfüllt). */
  complete: boolean;
  /** true, wenn dieser Schritt bereits abgeholt wurde. */
  claimed: boolean;
  /** true, wenn dieser Schritt der aktuell offene (nächste abzuholende) Schritt ist. */
  active: boolean;
  reward: OnboardingReward;
}

export interface OnboardingResponse {
  steps: OnboardingStepView[];
  /** Anzahl bereits abgeholter Schritte. */
  claimed_steps: number;
  /** true, wenn alle Schritte abgeholt sind. */
  all_complete: boolean;
  /** ID des aktuell offenen Schritts (null = alles abgeschlossen). */
  active_step_id: string | null;
}

export interface OnboardingClaimResponse {
  player: Player;
  step: OnboardingStepView;
  claimed_wood: number;
  claimed_stone: number;
  claimed_gold: number;
  claimed_gems: number;
  claimed_gold_bars: number;
  all_complete: boolean;
}

// --- Limited-Time-Events (Roadmap P7-Folge) ----------------------------------

/** Eine Event-Aufgabe mit Live-Fortschritt (seit Event-Start) + Anspruch. */
export interface EventChallengeView {
  id: string;
  name: string;
  description?: string;
  metric: EventMetric;
  target: number;
  /** Live-Wert seit Event-Start. */
  value: number;
  complete: boolean;
  claimed: boolean;
  reward: EventReward;
}

/** Aktuelles Limited-Time-Event mit Aufgaben (null = derzeit kein Event aktiv). */
export interface EventStatusResponse {
  event: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    challenges: EventChallengeView[];
  } | null;
}

export interface EventClaimResponse {
  player: Player;
  challenge: EventChallengeView;
  claimed_wood: number;
  claimed_stone: number;
  claimed_gold: number;
  claimed_gems: number;
  claimed_gold_bars: number;
}

// --- Season-/Battle-Pass (Roadmap P7) ----------------------------------------

export type SeasonPassTrack = 'free' | 'premium';

/** Eine Pass-Stufe mit Belohnungen und Abhol-/Erreicht-Status für den Spieler. */
export interface SeasonPassTierView {
  tier: number;
  xp_required: number;
  free: SeasonPassReward;
  premium: SeasonPassReward;
  /** Stufe erreicht (xp >= xp_required). */
  reached: boolean;
  free_claimed: boolean;
  premium_claimed: boolean;
}

export interface SeasonPassResponse {
  season_number: number;
  xp: number;
  /** Aktuell erreichte Stufe (0 = noch keine). */
  current_tier: number;
  max_tier: number;
  premium_unlocked: boolean;
  premium_cost_gems: number;
  /** XP-Schwelle der nächsten noch nicht erreichten Stufe (null = Maximum erreicht). */
  next_tier_xp: number | null;
  tiers: SeasonPassTierView[];
}

/** Antwort auf Premium-Freischaltung bzw. Stufen-Claim (aktualisierter Spieler + Pass). */
export interface SeasonPassActionResponse {
  player: Player;
  status: SeasonPassResponse;
}
