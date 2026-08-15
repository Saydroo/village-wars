import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type {
  ArmyResponse,
  AuthResponse,
  AuthTokens,
  BattleHistoryResponse,
  Building,
  CastleResponse,
  ClanBanner,
  ClanDetailResponse,
  ClanListResponse,
  ClanMembershipResponse,
  ClanWarResponse,
  ClanChatResponse,
  ClanChatSendResponse,
  ClanChatMessage,
  ClanDonationListResponse,
  ClanDonationRequest,
  DailyRewardStatusResponse,
  DailyRewardClaimResponse,
  AchievementsResponse,
  AchievementClaimResponse,
  ResearchStatusResponse,
  DailyQuestsResponse,
  HeroStatusResponse,
  SeasonPassResponse,
  SeasonPassActionResponse,
  SeasonPassTrack,
  OnboardingResponse,
  OnboardingClaimResponse,
  EventStatusResponse,
  EventClaimResponse,
  DungeonHistoryResponse,
  DungeonStartResponse,
  DungeonStatusResponse,
  DungeonWaveResponse,
  GameConfig,
  IapPackagesResponse,
  IapPurchaseResponse,
  InventoryItem,
  LeaderboardClanResponse,
  LeaderboardSoloResponse,
  PlayerStateResponse,
  ShopActionResponse,
  ShopSkinsResponse,
  TrainResponse,
  UpgradeResponse,
  VillageResponse,
} from '@village-wars/shared';

/** Basis-URL: EXPO_PUBLIC_API_URL hat Vorrang, sonst app.json -> extra.apiUrl. */
export function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
  return extra.apiUrl ?? 'http://localhost:4000';
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
/** Wird aufgerufen, wenn das Refresh endgültig scheitert (→ Store loggt aus). */
let onAuthFailure: (() => void) | null = null;

// --- Token-Persistenz (expo-secure-store, Android-Keystore) ---
// Überlebt App-Neustart/force-stop; nur bei explizitem Logout oder endgültig
// gescheitertem Refresh (401) gelöscht. So springt der Kaltstart direkt ins
// Dorf statt auf den Anmelden-Screen (siehe store.tryAutoLogin + App-Bootstrap).
const TOKEN_ACCESS_KEY = 'vw_access_token';
const TOKEN_REFRESH_KEY = 'vw_refresh_token';

/** Persistiert das Token-Paar im sicheren Gerätespeicher (fire-and-forget). */
async function persistTokens(access: string | null, refresh: string | null): Promise<void> {
  try {
    if (access) await SecureStore.setItemAsync(TOKEN_ACCESS_KEY, access);
    else await SecureStore.deleteItemAsync(TOKEN_ACCESS_KEY);
    if (refresh) await SecureStore.setItemAsync(TOKEN_REFRESH_KEY, refresh);
    else await SecureStore.deleteItemAsync(TOKEN_REFRESH_KEY);
  } catch {
    // SecureStore nicht verfügbar → still ignorieren, In-Memory-Tokens bleiben gültig.
  }
}

/** Lädt gespeicherte Tokens beim App-Start in den Speicher (für Auto-Login). */
export async function loadStoredTokens(): Promise<{ access: string | null; refresh: string | null }> {
  try {
    const access = await SecureStore.getItemAsync(TOKEN_ACCESS_KEY);
    const refresh = await SecureStore.getItemAsync(TOKEN_REFRESH_KEY);
    accessToken = access;
    refreshToken = refresh;
    return { access, refresh };
  } catch {
    return { access: null, refresh: null };
  }
}

/** Aktuelles Access-Token (auch für die Socket.io-Handshake-Auth). */
export function getAccessToken(): string | null {
  return accessToken;
}
/** Setzt beide Tokens (Login/Registrierung/Refresh) und persistiert sie sicher. */
export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  refreshToken = refresh;
  void persistTokens(access, refresh);
}
/** Nur das Access-Token setzen (Abwärtskompatibilität); persistiert das Paar mit. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  void persistTokens(token, refreshToken);
}
export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  void persistTokens(null, null);
}
export function setOnAuthFailure(cb: (() => void) | null): void {
  onAuthFailure = cb;
}

export const api: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 10_000,
});

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// --- Auto-Refresh des Access-Tokens (Phase 1: 15-min-Ablauf) ---
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };
let refreshPromise: Promise<string> | null = null;

/** Holt mit dem Refresh-Token ein neues Token-Paar; teilt parallele Aufrufe. */
async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error('Kein Refresh-Token');
  if (!refreshPromise) {
    // Bare-axios (ohne unsere Interceptoren) gegen Rekursion.
    refreshPromise = axios
      .post<{ tokens: AuthTokens }>(`${resolveBaseUrl()}/api/auth/refresh`, { refreshToken })
      .then((res) => {
        accessToken = res.data.tokens.accessToken;
        refreshToken = res.data.tokens.refreshToken;
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isRefreshCall = typeof original?.url === 'string' && original.url.includes('/api/auth/refresh');
    if (status === 401 && original && !original._retry && refreshToken && !isRefreshCall) {
      original._retry = true;
      try {
        const fresh = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original); // Original-Request mit frischem Token wiederholen
      } catch {
        clearTokens();
        onAuthFailure?.(); // Refresh-Token ebenfalls abgelaufen → ausloggen
      }
    }
    return Promise.reject(error);
  },
);

export interface HealthResponse {
  status: string;
  version: string;
  services: { database: string; redis: string };
  time: string;
}

// --- System ---
export async function fetchHealth(): Promise<HealthResponse> {
  return (await api.get<HealthResponse>('/api/health')).data;
}
export async function fetchGameConfig(): Promise<GameConfig> {
  return (await api.get<GameConfig>('/api/config')).data;
}

// --- Auth ---
export async function register(input: {
  username: string;
  email: string;
  password: string;
  faction: string;
}): Promise<AuthResponse> {
  return (await api.post<AuthResponse>('/api/auth/register', input)).data;
}
export async function login(identifier: string, password: string): Promise<AuthResponse> {
  return (await api.post<AuthResponse>('/api/auth/login', { identifier, password })).data;
}

// --- Player ---
export async function fetchMe(): Promise<PlayerStateResponse> {
  return (await api.get<PlayerStateResponse>('/api/player/me')).data;
}

// --- Village ---
export async function fetchVillage(playerId: string): Promise<VillageResponse> {
  return (await api.get<VillageResponse>(`/api/village/${playerId}`)).data;
}
export async function placeBuilding(input: {
  building_type: string;
  grid_x: number;
  grid_y: number;
}): Promise<{ building: Building }> {
  return (await api.post<{ building: Building }>('/api/village/buildings', input)).data;
}
export async function moveBuilding(
  id: string,
  input: { grid_x: number; grid_y: number },
): Promise<{ building: Building }> {
  return (await api.patch<{ building: Building }>(`/api/village/buildings/${id}/move`, input)).data;
}
export async function deleteBuilding(id: string): Promise<void> {
  await api.delete(`/api/village/buildings/${id}`);
}

// --- Inventar ---
export async function fetchInventory(): Promise<InventoryItem[]> {
  return (await api.get<{ inventory: InventoryItem[] }>('/api/village/inventory/list')).data.inventory;
}
export async function storeBuilding(id: string): Promise<{ inventory: InventoryItem[] }> {
  return (await api.post<{ inventory: InventoryItem[] }>(`/api/village/buildings/${id}/store`, {})).data;
}
export async function placeFromInventory(
  invId: string,
  input: { grid_x: number; grid_y: number },
): Promise<{ building: Building }> {
  return (await api.post<{ building: Building }>(`/api/village/inventory/${invId}/place`, input)).data;
}

// --- Upgrades (Phase 2) ---
export async function startUpgrade(id: string): Promise<UpgradeResponse> {
  return (await api.post<UpgradeResponse>(`/api/village/buildings/${id}/upgrade/start`, {})).data;
}
export async function skipUpgrade(id: string): Promise<UpgradeResponse> {
  return (await api.post<UpgradeResponse>(`/api/village/buildings/${id}/upgrade/skip`, {})).data;
}

// --- Einheiten (Phase 3) ---
export async function fetchArmy(): Promise<ArmyResponse> {
  return (await api.get<ArmyResponse>('/api/units/me')).data;
}
export async function trainUnits(unit_type: string, quantity: number): Promise<TrainResponse> {
  return (await api.post<TrainResponse>('/api/units/train', { unit_type, quantity })).data;
}
export async function disbandUnits(id: string, quantity?: number): Promise<ArmyResponse> {
  return (await api.delete<ArmyResponse>(`/api/units/${id}`, { data: quantity ? { quantity } : {} })).data;
}

// --- Kampf (Phase 3) ---
export async function fetchBattleHistory(): Promise<BattleHistoryResponse> {
  return (await api.get<BattleHistoryResponse>('/api/battle/history')).data;
}

// --- Clans (Phase 4) ---
export async function fetchClans(search?: string): Promise<ClanListResponse> {
  return (await api.get<ClanListResponse>('/api/clan', { params: search ? { search } : {} })).data;
}
export async function fetchClanDetail(clanId: string): Promise<ClanDetailResponse> {
  return (await api.get<ClanDetailResponse>(`/api/clan/${clanId}`)).data;
}
export async function createClan(input: {
  name: string;
  tag: string;
  banner: ClanBanner;
}): Promise<ClanMembershipResponse> {
  return (await api.post<ClanMembershipResponse>('/api/clan/create', input)).data;
}
export async function joinClan(clanId: string): Promise<ClanMembershipResponse> {
  return (await api.post<ClanMembershipResponse>(`/api/clan/join/${clanId}`, {})).data;
}
export async function leaveClan(): Promise<ClanMembershipResponse> {
  return (await api.delete<ClanMembershipResponse>('/api/clan/leave')).data;
}
export async function changeMemberRole(
  playerId: string,
  action: 'promote' | 'demote',
): Promise<ClanDetailResponse> {
  return (await api.post<ClanDetailResponse>(`/api/clan/members/${playerId}/${action}`, {})).data;
}
export async function fetchCastle(): Promise<CastleResponse> {
  return (await api.get<CastleResponse>('/api/clan/castle')).data;
}
export async function donateToCastle(input: {
  unit_type: string;
  quantity: number;
  target_player_id?: string;
}): Promise<CastleResponse> {
  return (await api.post<CastleResponse>('/api/clan/castle/donate', input)).data;
}
export async function fetchCurrentWar(): Promise<ClanWarResponse> {
  return (await api.get<ClanWarResponse>('/api/clan/wars/current')).data;
}
export async function startClanWar(): Promise<{ queued: boolean }> {
  return (await api.post<{ queued: boolean }>('/api/clan/wars/start', {})).data;
}
export async function fetchClanChat(before?: string, limit = 30): Promise<ClanChatResponse> {
  return (
    await api.get<ClanChatResponse>('/api/clan/chat', {
      params: { ...(before ? { before } : {}), limit },
    })
  ).data;
}
export async function sendClanMessage(body: string): Promise<ClanChatMessage> {
  return (await api.post<ClanChatSendResponse>('/api/clan/chat', { body })).data.message;
}
export async function fetchDonationRequests(): Promise<ClanDonationListResponse> {
  return (await api.get<ClanDonationListResponse>('/api/clan/donations')).data;
}
export async function createDonationRequest(requestedUnitType?: string): Promise<ClanDonationRequest> {
  return (
    await api.post<ClanDonationRequest>('/api/clan/donations', {
      ...(requestedUnitType ? { requested_unit_type: requestedUnitType } : {}),
    })
  ).data;
}
export async function cancelDonationRequest(): Promise<void> {
  await api.delete('/api/clan/donations');
}
export async function donateToRequest(
  requestId: string,
  unitType: string,
  quantity: number,
): Promise<ClanDonationRequest> {
  return (
    await api.post<{ request: ClanDonationRequest }>(`/api/clan/donations/${requestId}/donate`, {
      unit_type: unitType,
      quantity,
    })
  ).data.request;
}

// --- Ranglisten (Phase 4) ---
export async function fetchSoloLeaderboard(page = 1, limit = 50): Promise<LeaderboardSoloResponse> {
  return (await api.get<LeaderboardSoloResponse>('/api/leaderboard/solo', { params: { page, limit } })).data;
}
export async function fetchClanLeaderboard(page = 1, limit = 50): Promise<LeaderboardClanResponse> {
  return (
    await api.get<LeaderboardClanResponse>('/api/leaderboard/clan', { params: { season: 'current', page, limit } })
  ).data;
}

// --- Dungeon (Phase 5) ---
export async function fetchDungeonStatus(): Promise<DungeonStatusResponse> {
  return (await api.get<DungeonStatusResponse>('/api/dungeon/status')).data;
}
export async function startDungeon(difficulty?: string): Promise<DungeonStartResponse> {
  return (await api.post<DungeonStartResponse>('/api/dungeon/start', difficulty ? { difficulty } : {})).data;
}
export async function completeDungeonWave(): Promise<DungeonWaveResponse> {
  return (await api.post<DungeonWaveResponse>('/api/dungeon/wave/complete', {})).data;
}
export async function fetchDungeonHistory(): Promise<DungeonHistoryResponse> {
  return (await api.get<DungeonHistoryResponse>('/api/dungeon/history')).data;
}

// --- Shop & Skins (Phase 5) ---
export async function fetchShopSkins(): Promise<ShopSkinsResponse> {
  return (await api.get<ShopSkinsResponse>('/api/shop/skins')).data;
}
export async function buySkin(skinId: string): Promise<ShopActionResponse> {
  return (await api.post<ShopActionResponse>(`/api/shop/skins/${skinId}/buy`, {})).data;
}
export async function applySkin(skinId: string, apply: boolean): Promise<ShopActionResponse> {
  const action = apply ? 'apply' : 'unapply';
  return (await api.post<ShopActionResponse>(`/api/shop/skins/${skinId}/${action}`, {})).data;
}
export async function fetchBarPackages(): Promise<IapPackagesResponse> {
  return (await api.get<IapPackagesResponse>('/api/shop/bars/packages')).data;
}
export async function purchaseBars(input: {
  platform: 'apple' | 'google';
  product_id: string;
  receipt: string;
}): Promise<IapPurchaseResponse> {
  return (await api.post<IapPurchaseResponse>('/api/shop/bars/purchase', input)).data;
}

// --- Daily Rewards (Roadmap P1) ---
export async function fetchDailyStatus(): Promise<DailyRewardStatusResponse> {
  return (await api.get<DailyRewardStatusResponse>('/api/daily/status')).data;
}
export async function claimDailyReward(): Promise<DailyRewardClaimResponse> {
  return (await api.post<DailyRewardClaimResponse>('/api/daily/claim', {})).data;
}

// --- Achievements (Roadmap P2) ---
export async function fetchAchievements(): Promise<AchievementsResponse> {
  return (await api.get<AchievementsResponse>('/api/achievements')).data;
}
export async function claimAchievement(id: string): Promise<AchievementClaimResponse> {
  return (await api.post<AchievementClaimResponse>(`/api/achievements/${id}/claim`, {})).data;
}

// --- Forschung (Roadmap P3) ---
export async function fetchResearch(): Promise<ResearchStatusResponse> {
  return (await api.get<ResearchStatusResponse>('/api/research')).data;
}
export async function startResearch(unit_type: string): Promise<ResearchStatusResponse> {
  return (await api.post<ResearchStatusResponse>('/api/research/start', { unit_type })).data;
}
export async function cancelResearch(): Promise<ResearchStatusResponse> {
  return (await api.delete<ResearchStatusResponse>('/api/research/cancel')).data;
}

export async function fetchQuests(): Promise<DailyQuestsResponse> {
  return (await api.get<DailyQuestsResponse>('/api/quests')).data;
}

export async function claimQuestReward(quest_id: string): Promise<DailyQuestsResponse> {
  return (await api.post<DailyQuestsResponse>('/api/quests/claim', { quest_id })).data;
}

export async function fetchHero(): Promise<HeroStatusResponse> {
  return (await api.get<HeroStatusResponse>('/api/heroes')).data;
}

export async function startHeroLevelUp(): Promise<HeroStatusResponse> {
  return (await api.post<HeroStatusResponse>('/api/heroes/levelup')).data;
}

export async function cancelHeroLevelUp(): Promise<HeroStatusResponse> {
  return (await api.delete<HeroStatusResponse>('/api/heroes/levelup')).data;
}

export async function fetchSeasonPass(): Promise<SeasonPassResponse> {
  return (await api.get<SeasonPassResponse>('/api/season-pass')).data;
}

export async function unlockSeasonPassPremium(): Promise<SeasonPassActionResponse> {
  return (await api.post<SeasonPassActionResponse>('/api/season-pass/unlock')).data;
}

export async function claimSeasonPassTier(
  tier: number,
  track: SeasonPassTrack,
): Promise<SeasonPassActionResponse> {
  return (await api.post<SeasonPassActionResponse>('/api/season-pass/claim', { tier, track })).data;
}

export async function fetchOnboarding(): Promise<OnboardingResponse> {
  return (await api.get<OnboardingResponse>('/api/onboarding')).data;
}

export async function claimOnboardingStep(stepId: string): Promise<OnboardingClaimResponse> {
  return (await api.post<OnboardingClaimResponse>('/api/onboarding/claim', { step_id: stepId })).data;
}

export async function fetchEvents(): Promise<EventStatusResponse> {
  return (await api.get<EventStatusResponse>('/api/events')).data;
}
export async function claimEventChallenge(challengeId: string): Promise<EventClaimResponse> {
  return (await api.post<EventClaimResponse>('/api/events/claim', { challenge_id: challengeId })).data;
}
