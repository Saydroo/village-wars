import { create } from 'zustand';
import type {
  ArmyResponse,
  BattleEndedPayload,
  BattleSetupPayload,
  BattleStateUpdate,
  Building,
  CastleResponse,
  ClanBanner,
  ClanDetailResponse,
  ClanSummary,
  ClanWarResponse,
  ClanChatMessage,
  ClanDonationRequest,
  DailyRewardStatusResponse,
  DailyRewardView,
  AchievementView,
  ResearchStatusResponse,
  DailyQuestsResponse,
  HeroStatusResponse,
  SeasonPassResponse,
  SeasonPassTrack,
  OnboardingResponse,
  EventStatusResponse,
  DungeonStatusResponse,
  DungeonWavePreview,
  DungeonWaveResponse,
  GameConfig,
  IapPackage,
  InventoryItem,
  LeaderboardClanResponse,
  LeaderboardSoloResponse,
  Player,
  ResourceCapacities,
  ShopSkin,
  Village,
} from '@village-wars/shared';
import { loadGameConfig } from '../config/game-config';
import * as apiClient from '../api/client';
import { setTokens, clearTokens, setOnAuthFailure } from '../api/client';
import { setSoundEnabled as applySoundEnabled } from '../rendering/effects';
import { deriveActiveSkins, EMPTY_ACTIVE_SKINS, type ActiveSkins } from '../rendering/skins';
import {
  bindBattleHandlers,
  connectPresence,
  disconnectSocket,
  emitBattleStart,
  emitClanWarJoin,
  emitFriendlyChallenge,
  emitDeployUnit,
  emitMatchmakingCancel,
  emitMatchmakingJoin,
  emitSurrender,
} from '../api/socket';

export type BattlePhase = 'idle' | 'searching' | 'setup' | 'fighting' | 'ended';
export type ActiveScreen = 'village' | 'clan' | 'leaderboard' | 'dungeon' | 'shop' | 'achievements' | 'research' | 'quests' | 'hero' | 'season_pass' | 'onboarding' | 'event';

/** Cleanup-Funktion der aktuell gebundenen Socket-Handler (modul-lokal, nicht im State). */
let unbindBattle: (() => void) | null = null;

type SetState = (partial: Partial<AppState>) => void;
type GetState = () => AppState;

/** Battle-Socket-Handler (geteilt von Solo-Matchmaking und Clan-Krieg). */
function makeBattleHandlers(set: SetState, get: GetState) {
  return {
    onSearching: () => set({ battlePhase: 'searching' }),
    onMatched: (p: { mode?: 'solo' | 'clan_war' | 'friendly' }) =>
      set({ battleMode: p.mode === 'clan_war' ? 'clan_war' : p.mode === 'friendly' ? 'friendly' : 'solo' }),
    onSetup: (setup: BattleSetupPayload) =>
      set({
        battlePhase: 'setup',
        battleSetup: setup,
        battleUpdate: null,
        battleEnded: null,
        deployReserve: { ...setup.army },
        selectedDeployType: Object.keys(setup.army)[0] ?? null,
        battleError: null,
      }),
    onStateUpdate: (update: BattleStateUpdate) => {
      const phase = get().battlePhase;
      set({ battleUpdate: update, battlePhase: phase === 'ended' ? 'ended' : 'fighting' });
    },
    onEnded: (ended: BattleEndedPayload) =>
      set({
        battlePhase: 'ended',
        battleEnded: ended,
        battleMode:
          ended.mode === 'clan_war' || ended.mode === 'friendly' ? ended.mode : get().battleMode,
      }),
    onError: (p: { message: string }) => set({ battleError: p.message }),
    onCancelled: () => set({ battlePhase: 'idle' }),
  };
}

/**
 * Globaler App-State (Zustand) für Phase 2: Config, Auth, Dorf, Ressourcen.
 * Mutationen rufen das Backend und laden danach Dorf + Spieler neu, damit die
 * Anzeige (Ressourcen, Upgrade-Timer) konsistent bleibt.
 */
interface AppState {
  config: GameConfig | null;
  configLoading: boolean;
  configError: string | null;

  token: string | null;
  /** true, solange der Auto-Login beim Start läuft (verhindert AuthScreen-Flackern). */
  authBootstrapping: boolean;
  player: Player | null;
  capacities: ResourceCapacities | null;

  village: Village | null;
  buildings: Building[];
  inventory: InventoryItem[];
  loading: boolean;
  error: string | null;

  placementType: string | null;
  selectedBuildingId: string | null;
  /** Aktives Gebäude im Verschieben-Modus (nächster Feld-Tap = Ziel). */
  moveBuildingId: string | null;
  /** Aktives Inventar-Gebäude beim Platzieren (nächster Feld-Tap = Ziel). */
  inventoryPlaceId: string | null;

  // --- Armee & Kampf (Phase 3) ---
  army: ArmyResponse | null;
  battlePhase: BattlePhase;
  battleSetup: BattleSetupPayload | null;
  battleUpdate: BattleStateUpdate | null;
  battleEnded: BattleEndedPayload | null;
  /** Lokale Restmenge je Einheitentyp für den Deploy (aus dem Setup initialisiert). */
  deployReserve: Record<string, number>;
  selectedDeployType: string | null;
  battleError: string | null;
  /** 'clan_war' während eines Krieg-Duells, sonst 'solo'. */
  battleMode: 'solo' | 'clan_war' | 'friendly';

  // --- Navigation & Clans/Ranglisten (Phase 4) ---
  activeScreen: ActiveScreen;
  clanDetail: ClanDetailResponse | null;
  clanList: ClanSummary[];
  castle: CastleResponse | null;
  war: ClanWarResponse | null;
  soloLeaderboard: LeaderboardSoloResponse | null;
  clanLeaderboard: LeaderboardClanResponse | null;
  clanLoading: boolean;
  clanError: string | null;

  // --- Clan-Chat (Roadmap P9) ---
  /** Nachrichten, neueste zuerst (für invertierte Liste). */
  clanChat: ClanChatMessage[];
  clanChatHasMore: boolean;
  clanChatLoading: boolean;
  loadClanChat: () => Promise<void>;
  loadMoreClanChat: () => Promise<void>;
  sendClanMessageAction: (body: string) => Promise<void>;
  /** Live-Push vom Socket einsortieren (dedupliziert per id). */
  appendClanChatMessage: (m: ClanChatMessage) => void;

  // --- Clan-Spenden-Anfragen (Roadmap P9) ---
  donationRequests: ClanDonationRequest[];
  myDonationRequest: ClanDonationRequest | null;
  loadDonations: () => Promise<void>;
  createDonationAction: (requestedUnitType?: string) => Promise<void>;
  cancelDonationAction: () => Promise<void>;
  donateToRequestAction: (requestId: string, unitType: string, quantity: number) => Promise<void>;

  // --- Dungeon & Shop (Phase 5) ---
  dungeonStatus: DungeonStatusResponse | null;
  dungeonWaves: DungeonWavePreview[];
  dungeonArmy: Record<string, number>;
  dungeonLastWave: DungeonWaveResponse | null;
  /** Gewählte Schwierigkeit für den nächsten Lauf. */
  dungeonDifficulty: string;
  /** true, während die Kampf-Animation einer Welle abgespielt wird. */
  dungeonBattlePlaying: boolean;
  shopSkins: ShopSkin[];
  /** Angewandte Skins als renderfreundliche Farb-Tabelle (Gebäude/Einheiten/Theme). */
  activeSkins: ActiveSkins;
  barPackages: IapPackage[];
  p5Loading: boolean;
  p5Error: string | null;

  // --- Daily Rewards (Roadmap P1, Retention) ---
  dailyStatus: DailyRewardStatusResponse | null;
  /** Popup sichtbar (true nach Login, solange heute abholbar). */
  showDailyReward: boolean;
  /** Zuletzt abgeholte Belohnung (für die "abgeholt!"-Anzeige). */
  dailyClaimed: DailyRewardView | null;
  loadDaily: () => Promise<void>;
  claimDaily: () => Promise<void>;
  dismissDailyReward: () => void;

  // --- Achievements (Roadmap P2) ---
  achievements: AchievementView[];
  loadAchievements: () => Promise<void>;
  claimAchievementAction: (id: string) => Promise<void>;

  // --- Forschung (Roadmap P3) ---
  research: ResearchStatusResponse | null;
  loadResearch: () => Promise<void>;
  startResearchAction: (unitType: string) => Promise<void>;
  cancelResearchAction: () => Promise<void>;

  // --- Quests (Roadmap P4) ---
  quests: DailyQuestsResponse | null;
  loadQuests: () => Promise<void>;
  claimQuestAction: (questId: string) => Promise<void>;

  // --- Helden (Roadmap P6) ---
  hero: HeroStatusResponse | null;
  loadHero: () => Promise<void>;
  startHeroLevelUpAction: () => Promise<void>;
  cancelHeroLevelUpAction: () => Promise<void>;

  // --- Season-/Battle-Pass (Roadmap P7) ---
  seasonPass: SeasonPassResponse | null;
  loadSeasonPass: () => Promise<void>;
  unlockSeasonPassAction: () => Promise<void>;
  claimSeasonPassAction: (tier: number, track: SeasonPassTrack) => Promise<void>;

  // --- Onboarding / Tutorial (Roadmap P8) ---
  onboarding: OnboardingResponse | null;
  loadOnboarding: () => Promise<void>;
  claimOnboardingStepAction: (stepId: string) => Promise<void>;

  // --- Limited-Time-Events (Roadmap P7-Folge) ---
  event: EventStatusResponse | null;
  loadEvents: () => Promise<void>;
  claimEventAction: (challengeId: string) => Promise<void>;

  // --- Grafik & Effekte (Phase 6) ---
  /** „Effekte reduzieren": deaktiviert Screenshake, halbiert Partikel, entfernt Idle-Atmung. */
  reduceEffects: boolean;
  /** Sound-Cues an/aus (getrennt von Musik). */
  soundEnabled: boolean;
  setReduceEffects: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;

  initConfig: () => Promise<void>;
  authLogin: (identifier: string, password: string) => Promise<void>;
  authRegister: (input: {
    username: string;
    email: string;
    password: string;
    faction: string;
  }) => Promise<void>;
  logout: () => void;
  /** Beim App-Start: gespeicherten Token laden und ohne Eingabe einloggen. */
  tryAutoLogin: () => Promise<void>;

  refreshAll: () => Promise<void>;
  setPlacementType: (type: string | null) => void;
  selectBuilding: (id: string | null) => void;
  cancelModes: () => void;

  placeAt: (gridX: number, gridY: number) => Promise<void>;
  removeBuilding: (id: string) => Promise<void>;
  startUpgrade: (id: string) => Promise<void>;
  skipUpgrade: (id: string) => Promise<void>;

  // Verschieben
  beginMove: (id: string) => void;
  commitMoveAt: (gridX: number, gridY: number) => Promise<void>;

  // Inventar
  storeToInventory: (id: string) => Promise<void>;
  beginInventoryPlace: (inventoryId: string) => void;
  commitInventoryPlaceAt: (gridX: number, gridY: number) => Promise<void>;

  // Armee & Kampf (Phase 3)
  refreshArmy: () => Promise<void>;
  trainUnit: (unitType: string, quantity: number) => Promise<void>;
  disbandUnit: (id: string) => Promise<void>;
  startMatchmaking: () => void;
  startClanWarBattle: () => void;
  startFriendlyBattle: (targetPlayerId: string) => void;
  cancelMatchmaking: () => void;
  startBattle: () => void;
  setDeployType: (unitType: string | null) => void;
  deployAt: (gridX: number, gridY: number) => void;
  surrenderBattle: () => void;
  leaveBattle: () => void;

  // --- Navigation & Clans/Ranglisten (Phase 4) ---
  setScreen: (screen: ActiveScreen) => void;
  loadClanHome: () => Promise<void>;
  searchClans: (search?: string) => Promise<void>;
  createClanAction: (input: { name: string; tag: string; banner: ClanBanner }) => Promise<boolean>;
  joinClanAction: (clanId: string) => Promise<boolean>;
  leaveClanAction: () => Promise<void>;
  changeMemberRole: (playerId: string, action: 'promote' | 'demote') => Promise<void>;
  loadCastle: () => Promise<void>;
  donateAction: (unitType: string, quantity: number) => Promise<void>;
  startWarAction: () => Promise<void>;
  loadSoloLeaderboard: (page?: number) => Promise<void>;
  loadClanLeaderboard: (page?: number) => Promise<void>;

  // --- Dungeon & Shop (Phase 5) ---
  loadDungeon: () => Promise<void>;
  setDungeonDifficulty: (id: string) => void;
  startDungeonRun: () => Promise<void>;
  doDungeonWave: () => Promise<void>;
  finishDungeonBattle: () => void;
  resetDungeonResult: () => void;
  loadShop: () => Promise<void>;
  buySkinAction: (skinId: string) => Promise<void>;
  applySkinAction: (skinId: string, apply: boolean) => Promise<void>;
  buyBarsAction: (productId: string) => Promise<void>;
}

function errMsg(e: unknown): string {
  if (typeof e === 'object' && e && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    if (resp?.data?.error?.message) return resp.data.error.message;
  }
  return e instanceof Error ? e.message : 'Unbekannter Fehler';
}

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  configLoading: false,
  configError: null,
  token: null,
  authBootstrapping: true,
  player: null,
  capacities: null,
  village: null,
  buildings: [],
  inventory: [],
  loading: false,
  error: null,
  placementType: null,
  selectedBuildingId: null,
  moveBuildingId: null,
  inventoryPlaceId: null,

  army: null,
  battlePhase: 'idle',
  battleSetup: null,
  battleUpdate: null,
  battleEnded: null,
  deployReserve: {},
  selectedDeployType: null,
  battleError: null,
  battleMode: 'solo',

  activeScreen: 'village',
  clanDetail: null,
  clanList: [],
  clanChat: [],
  clanChatHasMore: false,
  clanChatLoading: false,
  donationRequests: [],
  myDonationRequest: null,
  castle: null,
  war: null,
  soloLeaderboard: null,
  clanLeaderboard: null,
  clanLoading: false,
  clanError: null,

  dungeonStatus: null,
  dungeonWaves: [],
  dungeonArmy: {},
  dungeonLastWave: null,
  dungeonDifficulty: 'normal',
  dungeonBattlePlaying: false,
  shopSkins: [],
  activeSkins: EMPTY_ACTIVE_SKINS,
  barPackages: [],
  p5Loading: false,
  p5Error: null,

  dailyStatus: null,
  showDailyReward: false,
  dailyClaimed: null,
  achievements: [],
  research: null,
  quests: null,
  hero: null,
  seasonPass: null,
  onboarding: null,
  event: null,

  reduceEffects: false,
  soundEnabled: true,
  setReduceEffects: (v) => set({ reduceEffects: v }),
  setSoundEnabled: (v) => {
    applySoundEnabled(v);
    set({ soundEnabled: v });
  },

  initConfig: async () => {
    // Bei endgültig fehlgeschlagenem Token-Refresh sauber ausloggen (→ AuthScreen).
    setOnAuthFailure(() => get().logout());
    set({ configLoading: true, configError: null });
    try {
      const config = await loadGameConfig();
      set({ config, configLoading: false, reduceEffects: config.effects?.reduce_effects_default ?? false });
    } catch (e) {
      set({ configLoading: false, configError: errMsg(e) });
    }
  },

  authLogin: async (identifier, password) => {
    const res = await apiClient.login(identifier, password);
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    set({ token: res.tokens.accessToken, player: res.player });
    connectPresence(); // als Verteidiger matchbar, solange eingeloggt
    await get().refreshAll();
  },

  authRegister: async (input) => {
    const res = await apiClient.register(input);
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    set({ token: res.tokens.accessToken, player: res.player });
    connectPresence();
    await get().refreshAll();
  },

  tryAutoLogin: async () => {
    try {
      await apiClient.loadStoredTokens();
      if (!apiClient.getAccessToken()) return; // kein gespeicherter Token → Anmelden-Screen
      // Player laden; ist das Access-Token abgelaufen, refresht der Interceptor
      // transparent via Refresh-Token. Erst danach gilt der Nutzer als eingeloggt.
      const me = await apiClient.fetchMe();
      set({ token: apiClient.getAccessToken(), player: me.player, capacities: me.capacities });
      connectPresence();
      await get().refreshAll();
    } catch {
      // Token ungültig/abgelaufen ohne gültiges Refresh (oder Netzfehler) → sauber ausloggen.
      get().logout();
    } finally {
      set({ authBootstrapping: false });
    }
  },

  logout: () => {
    if (unbindBattle) {
      unbindBattle();
      unbindBattle = null;
    }
    disconnectSocket();
    clearTokens();
    set({
      token: null,
      player: null,
      village: null,
      buildings: [],
      inventory: [],
      capacities: null,
      placementType: null,
      selectedBuildingId: null,
      moveBuildingId: null,
      inventoryPlaceId: null,
      army: null,
      battlePhase: 'idle',
      battleSetup: null,
      battleUpdate: null,
      battleEnded: null,
      deployReserve: {},
      selectedDeployType: null,
      battleError: null,
      battleMode: 'solo',
      activeScreen: 'village',
      clanDetail: null,
      clanList: [],
      castle: null,
      war: null,
      soloLeaderboard: null,
      clanLeaderboard: null,
      clanError: null,
      dungeonStatus: null,
      dungeonWaves: [],
      dungeonArmy: {},
      dungeonLastWave: null,
      dungeonBattlePlaying: false,
      shopSkins: [],
      activeSkins: EMPTY_ACTIVE_SKINS,
      barPackages: [],
      p5Error: null,
    });
  },

  refreshAll: async () => {
    const { player } = get();
    if (!player) return;
    connectPresence(); // Verbindung halten/wiederherstellen (Präsenz für Matchmaking)
    set({ loading: true, error: null });
    try {
      const [me, village, inventory, army, shop, daily, achievements, onboarding, event] = await Promise.all([
        apiClient.fetchMe(),
        apiClient.fetchVillage(player.id),
        apiClient.fetchInventory(),
        apiClient.fetchArmy(),
        // Angewandte Skins für die Renderer (Gebäude/Einheiten/Theme) — fehlertolerant.
        apiClient.fetchShopSkins().catch(() => null),
        // Tägliche Belohnung (Retention) — fehlertolerant.
        apiClient.fetchDailyStatus().catch(() => null),
        // Achievements (für Menü-Badge „abholbar") — fehlertolerant.
        apiClient.fetchAchievements().catch(() => null),
        // Onboarding (für Menü-Badge „Schritt abholbar") — fehlertolerant.
        apiClient.fetchOnboarding().catch(() => null),
        // Limited-Time-Event (für Menü-Badge „Aufgabe abholbar") — fehlertolerant.
        apiClient.fetchEvents().catch(() => null),
      ]);
      set({
        player: me.player,
        capacities: me.capacities,
        village: village.village,
        buildings: village.buildings,
        inventory,
        army,
        ...(shop ? { shopSkins: shop.skins, activeSkins: deriveActiveSkins(shop.skins) } : {}),
        ...(daily ? { dailyStatus: daily, showDailyReward: daily.can_claim } : {}),
        ...(achievements ? { achievements: achievements.achievements } : {}),
        ...(onboarding ? { onboarding } : {}),
        ...(event ? { event } : {}),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: errMsg(e) });
    }
  },

  // --- Daily Rewards (Roadmap P1) ---
  loadDaily: async () => {
    try {
      const daily = await apiClient.fetchDailyStatus();
      set({ dailyStatus: daily, showDailyReward: daily.can_claim });
    } catch {
      /* fehlertolerant — Retention darf den Start nie blockieren */
    }
  },
  claimDaily: async () => {
    try {
      const res = await apiClient.claimDailyReward();
      const daily = await apiClient.fetchDailyStatus().catch(() => null);
      set((s) => ({
        player: res.player,
        dailyClaimed: res.reward,
        dailyStatus: daily ?? s.dailyStatus,
        showDailyReward: true, // Popup bleibt offen für die "abgeholt!"-Anzeige
      }));
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  dismissDailyReward: () => set({ showDailyReward: false, dailyClaimed: null }),

  // --- Achievements (Roadmap P2) ---
  loadAchievements: async () => {
    try {
      const res = await apiClient.fetchAchievements();
      set({ achievements: res.achievements });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  claimAchievementAction: async (id) => {
    try {
      const res = await apiClient.claimAchievement(id);
      const list = await apiClient.fetchAchievements().catch(() => null);
      set((s) => ({
        player: res.player,
        achievements: list?.achievements ?? s.achievements,
      }));
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  // --- Forschung (Roadmap P3) ---
  loadResearch: async () => {
    try {
      const res = await apiClient.fetchResearch();
      set({ research: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  startResearchAction: async (unitType) => {
    try {
      const res = await apiClient.startResearch(unitType);
      set({ research: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  cancelResearchAction: async () => {
    try {
      const res = await apiClient.cancelResearch();
      set({ research: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  loadQuests: async () => {
    try {
      const res = await apiClient.fetchQuests();
      set({ quests: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  claimQuestAction: async (questId) => {
    try {
      const res = await apiClient.claimQuestReward(questId);
      set({ quests: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  loadHero: async () => {
    try {
      const res = await apiClient.fetchHero();
      set({ hero: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  startHeroLevelUpAction: async () => {
    try {
      const res = await apiClient.startHeroLevelUp();
      set({ hero: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  cancelHeroLevelUpAction: async () => {
    try {
      const res = await apiClient.cancelHeroLevelUp();
      set({ hero: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  loadSeasonPass: async () => {
    try {
      const res = await apiClient.fetchSeasonPass();
      set({ seasonPass: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  unlockSeasonPassAction: async () => {
    try {
      const res = await apiClient.unlockSeasonPassPremium();
      set({ seasonPass: res.status, player: res.player });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  claimSeasonPassAction: async (tier, track) => {
    try {
      const res = await apiClient.claimSeasonPassTier(tier, track);
      set({ seasonPass: res.status, player: res.player });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  // --- Onboarding / Tutorial (Roadmap P8) ---
  loadOnboarding: async () => {
    try {
      const res = await apiClient.fetchOnboarding();
      set({ onboarding: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  claimOnboardingStepAction: async (stepId) => {
    try {
      const res = await apiClient.claimOnboardingStep(stepId);
      // Frischen Status nachladen (Live-Metriken können den nächsten Schritt sofort erfüllen).
      const status = await apiClient.fetchOnboarding().catch(() => null);
      set((s) => ({ player: res.player, onboarding: status ?? s.onboarding }));
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  // --- Limited-Time-Events (Roadmap P7-Folge) ---
  loadEvents: async () => {
    try {
      const res = await apiClient.fetchEvents();
      set({ event: res });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },
  claimEventAction: async (challengeId) => {
    try {
      const res = await apiClient.claimEventChallenge(challengeId);
      const status = await apiClient.fetchEvents().catch(() => null);
      set((s) => ({ player: res.player, event: status ?? s.event }));
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  setPlacementType: (type) =>
    set({ placementType: type, selectedBuildingId: null, moveBuildingId: null, inventoryPlaceId: null }),
  selectBuilding: (id) =>
    set({ selectedBuildingId: id, placementType: null, moveBuildingId: null, inventoryPlaceId: null }),
  cancelModes: () => set({ placementType: null, moveBuildingId: null, inventoryPlaceId: null }),

  placeAt: async (gridX, gridY) => {
    const type = get().placementType;
    if (!type) return;
    try {
      await apiClient.placeBuilding({ building_type: type, grid_x: gridX, grid_y: gridY });
      set({ placementType: null });
      await get().refreshAll();
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  beginMove: (id) =>
    set({ moveBuildingId: id, selectedBuildingId: null, placementType: null, inventoryPlaceId: null }),

  commitMoveAt: async (gridX, gridY) => {
    const id = get().moveBuildingId;
    if (!id) return;
    try {
      await apiClient.moveBuilding(id, { grid_x: gridX, grid_y: gridY });
      set({ moveBuildingId: null });
      await get().refreshAll();
    } catch (e) {
      set({ moveBuildingId: null, error: errMsg(e) });
    }
  },

  storeToInventory: async (id) => {
    try {
      await apiClient.storeBuilding(id);
      set({ selectedBuildingId: null });
      await get().refreshAll();
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  beginInventoryPlace: (inventoryId) =>
    set({ inventoryPlaceId: inventoryId, selectedBuildingId: null, placementType: null, moveBuildingId: null }),

  commitInventoryPlaceAt: async (gridX, gridY) => {
    const invId = get().inventoryPlaceId;
    if (!invId) return;
    try {
      await apiClient.placeFromInventory(invId, { grid_x: gridX, grid_y: gridY });
      set({ inventoryPlaceId: null });
      await get().refreshAll();
    } catch (e) {
      set({ inventoryPlaceId: null, error: errMsg(e) });
    }
  },

  removeBuilding: async (id) => {
    try {
      await apiClient.deleteBuilding(id);
      set({ selectedBuildingId: null });
      await get().refreshAll();
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  startUpgrade: async (id) => {
    try {
      await apiClient.startUpgrade(id);
      await get().refreshAll();
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  skipUpgrade: async (id) => {
    try {
      await apiClient.skipUpgrade(id);
      await get().refreshAll();
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  // --- Armee & Kampf (Phase 3) ---
  refreshArmy: async () => {
    try {
      set({ army: await apiClient.fetchArmy() });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  trainUnit: async (unitType, quantity) => {
    try {
      const res = await apiClient.trainUnits(unitType, quantity);
      set({ army: { units: res.units, training: res.training }, player: res.player });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  disbandUnit: async (id) => {
    try {
      set({ army: await apiClient.disbandUnits(id) });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  startMatchmaking: () => {
    // Vorherige Handler lösen, dann neu binden.
    if (unbindBattle) unbindBattle();
    unbindBattle = bindBattleHandlers(makeBattleHandlers(set, get));
    set({
      battlePhase: 'searching',
      battleMode: 'solo',
      battleSetup: null,
      battleUpdate: null,
      battleEnded: null,
      battleError: null,
      activeScreen: 'village',
    });
    emitMatchmakingJoin();
  },

  startClanWarBattle: () => {
    if (unbindBattle) unbindBattle();
    unbindBattle = bindBattleHandlers(makeBattleHandlers(set, get));
    set({
      battlePhase: 'searching',
      battleMode: 'clan_war',
      battleSetup: null,
      battleUpdate: null,
      battleEnded: null,
      battleError: null,
      activeScreen: 'village',
    });
    emitClanWarJoin();
  },

  startFriendlyBattle: (targetPlayerId: string) => {
    if (unbindBattle) unbindBattle();
    unbindBattle = bindBattleHandlers(makeBattleHandlers(set, get));
    set({
      battlePhase: 'searching',
      battleMode: 'friendly',
      battleSetup: null,
      battleUpdate: null,
      battleEnded: null,
      battleError: null,
      activeScreen: 'village',
    });
    emitFriendlyChallenge(targetPlayerId);
  },

  cancelMatchmaking: () => {
    emitMatchmakingCancel();
    set({ battlePhase: 'idle' });
  },

  startBattle: () => {
    const setup = get().battleSetup;
    if (!setup) return;
    emitBattleStart(setup.battle_id);
    set({ battlePhase: 'fighting' });
  },

  setDeployType: (unitType) => set({ selectedDeployType: unitType }),

  deployAt: (gridX, gridY) => {
    const { selectedDeployType, deployReserve, battlePhase } = get();
    if (battlePhase !== 'fighting' || !selectedDeployType) return;
    const remaining = deployReserve[selectedDeployType] ?? 0;
    if (remaining <= 0) return;
    emitDeployUnit({ unit_type: selectedDeployType, x: gridX, y: gridY });
    set({ deployReserve: { ...deployReserve, [selectedDeployType]: remaining - 1 } });
  },

  surrenderBattle: () => {
    emitSurrender();
  },

  leaveBattle: () => {
    if (unbindBattle) {
      unbindBattle();
      unbindBattle = null;
    }
    set({
      battlePhase: 'idle',
      battleSetup: null,
      battleUpdate: null,
      battleEnded: null,
      deployReserve: {},
      selectedDeployType: null,
      battleError: null,
      battleMode: 'solo',
    });
    void get().refreshAll();
  },

  // --- Navigation & Clans/Ranglisten (Phase 4) ---
  setScreen: (screen) => set({ activeScreen: screen, clanError: null }),

  loadClanHome: async () => {
    set({ clanLoading: true, clanError: null });
    try {
      const { player } = get();
      if (player?.clan_id) {
        const [detail, castle] = await Promise.all([
          apiClient.fetchClanDetail(player.clan_id),
          apiClient.fetchCastle().catch(() => null),
        ]);
        const war = await apiClient.fetchCurrentWar().catch(() => null);
        set({ clanDetail: detail, castle, war, clanList: [], clanLoading: false });
      } else {
        const list = await apiClient.fetchClans();
        set({ clanDetail: null, castle: null, war: null, clanList: list.clans, clanLoading: false });
      }
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
    }
  },

  searchClans: async (search) => {
    try {
      const list = await apiClient.fetchClans(search);
      set({ clanList: list.clans });
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  createClanAction: async (input) => {
    set({ clanLoading: true, clanError: null });
    try {
      const res = await apiClient.createClan(input);
      set({ player: res.player, clanLoading: false });
      await get().loadClanHome();
      return true;
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
      return false;
    }
  },

  joinClanAction: async (clanId) => {
    set({ clanLoading: true, clanError: null });
    try {
      const res = await apiClient.joinClan(clanId);
      set({ player: res.player, clanLoading: false });
      await get().loadClanHome();
      return true;
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
      return false;
    }
  },

  leaveClanAction: async () => {
    set({ clanLoading: true, clanError: null });
    try {
      const res = await apiClient.leaveClan();
      set({ player: res.player, clanDetail: null, castle: null, war: null, clanLoading: false });
      await get().loadClanHome();
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
    }
  },

  changeMemberRole: async (playerId, action) => {
    try {
      set({ clanDetail: await apiClient.changeMemberRole(playerId, action) });
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  // --- Clan-Chat (Roadmap P9) ---
  loadClanChat: async () => {
    set({ clanChatLoading: true });
    try {
      const res = await apiClient.fetchClanChat();
      set({ clanChat: res.messages, clanChatHasMore: res.has_more, clanChatLoading: false });
    } catch (e) {
      set({ clanChatLoading: false, clanError: errMsg(e) });
    }
  },
  loadMoreClanChat: async () => {
    const { clanChat, clanChatHasMore } = get();
    if (!clanChatHasMore || clanChat.length === 0) return;
    const oldest = clanChat[clanChat.length - 1]!.created_at;
    try {
      const res = await apiClient.fetchClanChat(oldest);
      set((s) => ({ clanChat: [...s.clanChat, ...res.messages], clanChatHasMore: res.has_more }));
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },
  sendClanMessageAction: async (body) => {
    const text = body.trim();
    if (!text) return;
    try {
      const msg = await apiClient.sendClanMessage(text);
      // Optimistisch sofort anzeigen; der Socket-Push wird per id dedupliziert.
      get().appendClanChatMessage(msg);
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },
  appendClanChatMessage: (m) => {
    set((s) => {
      if (s.clanChat.some((x) => x.id === m.id)) return s;
      return { clanChat: [m, ...s.clanChat] };
    });
  },

  // --- Clan-Spenden-Anfragen (Roadmap P9) ---
  loadDonations: async () => {
    try {
      const res = await apiClient.fetchDonationRequests();
      set({ donationRequests: res.requests, myDonationRequest: res.my_request });
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },
  createDonationAction: async (requestedUnitType) => {
    try {
      await apiClient.createDonationRequest(requestedUnitType);
      await get().loadDonations();
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },
  cancelDonationAction: async () => {
    try {
      await apiClient.cancelDonationRequest();
      await get().loadDonations();
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },
  donateToRequestAction: async (requestId, unitType, quantity) => {
    try {
      await apiClient.donateToRequest(requestId, unitType, quantity);
      // Armee (Spender verliert Truppen) + Anfragen-Fortschritt aktualisieren.
      await Promise.all([get().refreshArmy(), get().loadDonations()]);
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  loadCastle: async () => {
    try {
      set({ castle: await apiClient.fetchCastle() });
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  donateAction: async (unitType, quantity) => {
    try {
      const castle = await apiClient.donateToCastle({ unit_type: unitType, quantity });
      set({ castle });
      await get().refreshArmy();
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  startWarAction: async () => {
    try {
      await apiClient.startClanWar();
      const war = await apiClient.fetchCurrentWar();
      set({ war });
    } catch (e) {
      set({ clanError: errMsg(e) });
    }
  },

  loadSoloLeaderboard: async (page = 1) => {
    set({ clanLoading: true, clanError: null });
    try {
      set({ soloLeaderboard: await apiClient.fetchSoloLeaderboard(page), clanLoading: false });
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
    }
  },

  loadClanLeaderboard: async (page = 1) => {
    set({ clanLoading: true, clanError: null });
    try {
      set({ clanLeaderboard: await apiClient.fetchClanLeaderboard(page), clanLoading: false });
    } catch (e) {
      set({ clanLoading: false, clanError: errMsg(e) });
    }
  },

  // --- Dungeon & Shop (Phase 5) ---
  loadDungeon: async () => {
    set({ p5Loading: true, p5Error: null });
    try {
      const status = await apiClient.fetchDungeonStatus();
      set({ dungeonStatus: status, p5Loading: false });
    } catch (e) {
      set({ p5Loading: false, p5Error: errMsg(e) });
    }
  },

  setDungeonDifficulty: (id) => set({ dungeonDifficulty: id }),

  startDungeonRun: async () => {
    set({ p5Loading: true, p5Error: null, dungeonLastWave: null });
    try {
      const res = await apiClient.startDungeon(get().dungeonDifficulty);
      set({ dungeonWaves: res.waves, dungeonArmy: res.army, p5Loading: false });
      await get().loadDungeon();
    } catch (e) {
      set({ p5Loading: false, p5Error: errMsg(e) });
    }
  },

  doDungeonWave: async () => {
    set({ p5Loading: true, p5Error: null });
    try {
      const res = await apiClient.completeDungeonWave();
      // Ergebnis NICHT sofort anwenden — erst die Kampf-Animation abspielen
      // (Armee/Fortschritt/Belohnung würden sonst den Ausgang vorwegnehmen).
      set({ dungeonLastWave: res, dungeonBattlePlaying: true, p5Loading: false });
    } catch (e) {
      set({ p5Loading: false, p5Error: errMsg(e) });
    }
  },

  // Nach Ende der Kampf-Animation: aufgeschobenen Zustand anwenden + Status neu laden.
  finishDungeonBattle: () => {
    const res = get().dungeonLastWave;
    if (!res) {
      set({ dungeonBattlePlaying: false });
      return;
    }
    set({
      dungeonBattlePlaying: false,
      dungeonArmy: res.army_remaining,
      player: res.finished ? res.player : get().player,
    });
    void get().loadDungeon();
  },

  resetDungeonResult: () => set({ dungeonLastWave: null }),

  loadShop: async () => {
    set({ p5Loading: true, p5Error: null });
    try {
      const [skins, packages] = await Promise.all([
        apiClient.fetchShopSkins(),
        apiClient.fetchBarPackages(),
      ]);
      set({
        shopSkins: skins.skins,
        activeSkins: deriveActiveSkins(skins.skins),
        barPackages: packages.packages,
        p5Loading: false,
      });
    } catch (e) {
      set({ p5Loading: false, p5Error: errMsg(e) });
    }
  },

  buySkinAction: async (skinId) => {
    try {
      const res = await apiClient.buySkin(skinId);
      set({ shopSkins: res.skins, activeSkins: deriveActiveSkins(res.skins), player: res.player });
    } catch (e) {
      set({ p5Error: errMsg(e) });
    }
  },

  applySkinAction: async (skinId, apply) => {
    try {
      const res = await apiClient.applySkin(skinId, apply);
      set({ shopSkins: res.skins, activeSkins: deriveActiveSkins(res.skins), player: res.player });
    } catch (e) {
      set({ p5Error: errMsg(e) });
    }
  },

  buyBarsAction: async (productId) => {
    set({ p5Loading: true, p5Error: null });
    try {
      // Lokaler Sandbox-Beleg (echte Apple/Google-Belege liefert das Store-SDK auf dem Gerät).
      const txId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const res = await apiClient.purchaseBars({
        platform: 'google',
        product_id: productId,
        receipt: `sandbox:${productId}:${txId}`,
      });
      set({ player: res.player, p5Loading: false });
    } catch (e) {
      set({ p5Loading: false, p5Error: errMsg(e) });
    }
  },
}));
