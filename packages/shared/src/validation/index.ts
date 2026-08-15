import { z } from 'zod';
import { FACTION_IDS } from '../types/gameConfig';

/** Wiederverwendbares Fraktions-Enum aus der zentralen Fraktionsliste. */
export const factionSchema = z.enum(
  FACTION_IDS as unknown as [string, ...string[]],
);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Benutzername muss mindestens 3 Zeichen haben')
  .max(32, 'Benutzername darf höchstens 32 Zeichen haben')
  .regex(/^[a-zA-Z0-9_.\- ]+$/, 'Ungültige Zeichen im Benutzernamen');

export const passwordSchema = z
  .string()
  .min(8, 'Passwort muss mindestens 8 Zeichen haben')
  .max(200);

// --- Auth ---
export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email().max(255),
  password: passwordSchema,
  faction: factionSchema,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'E-Mail oder Benutzername erforderlich'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

export const oauthSchema = z.object({
  idToken: z.string().min(1, 'idToken erforderlich'),
  // Nur beim ersten Login (Account-Erstellung) nötig:
  username: usernameSchema.optional(),
  faction: factionSchema.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Player ---
export const changeFactionSchema = z.object({
  faction: factionSchema,
});

// --- Village ---
export const placeBuildingSchema = z.object({
  building_type: z.string().min(1).max(50),
  grid_x: z.number().int().min(0),
  grid_y: z.number().int().min(0),
});

export const moveBuildingSchema = z.object({
  grid_x: z.number().int().min(0),
  grid_y: z.number().int().min(0),
});

// --- Units (Phase 3) ---
export const trainUnitsSchema = z.object({
  unit_type: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(50),
});

export const disbandUnitsSchema = z.object({
  quantity: z.number().int().min(1).max(1000).optional(),
});

// --- Battle / Matchmaking (Phase 3) ---
export const deployUnitSchema = z.object({
  unit_type: z.string().min(1).max(50),
  x: z.number().min(0),
  y: z.number().min(0),
});

// --- Clans (Phase 4) ---
/** Hex-Farbe (#rgb oder #rrggbb). Gültige Optionen prüft der Service gegen die Config. */
const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Ungültige Farbe (Hex erwartet)');

export const clanBannerSchema = z.object({
  shape: z.string().min(1).max(20),
  primary_color: hexColorSchema,
  secondary_color: hexColorSchema,
  symbol: z.string().min(1).max(20),
  symbol_color: hexColorSchema,
});

export const clanNameSchema = z
  .string()
  .trim()
  .min(3, 'Clan-Name muss mindestens 3 Zeichen haben')
  .max(50, 'Clan-Name darf höchstens 50 Zeichen haben');

export const clanTagSchema = z
  .string()
  .trim()
  .min(3, 'Tag muss 3–5 Zeichen haben')
  .max(5, 'Tag muss 3–5 Zeichen haben')
  .regex(/^[A-Za-z0-9]+$/, 'Tag darf nur Buchstaben und Ziffern enthalten');

export const createClanSchema = z.object({
  name: clanNameSchema,
  tag: clanTagSchema,
  banner: clanBannerSchema,
});

/** Einheiten in der Clan-Burg stationieren (Housing Space). */
export const donateUnitsSchema = z.object({
  unit_type: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(100),
  target_player_id: z.string().uuid().optional(),
});

// --- Dungeon (Phase 5) ---
/** Dungeon-Lauf starten mit optionaler Schwierigkeitswahl. */
export const startDungeonSchema = z.object({
  difficulty: z.string().min(1).max(20).optional(),
});

// --- Shop / IAP (Phase 5) ---
/** Goldbarren-Kauf via In-App-Purchase (Apple/Google) inkl. Beleg. */
export const iapPurchaseSchema = z.object({
  platform: z.enum(['apple', 'google']),
  product_id: z.string().min(1).max(100),
  receipt: z.string().min(1).max(20000),
  transaction_id: z.string().min(1).max(255).optional(),
});

// --- Clan-Chat (Roadmap P9) ---
/** Sendet eine Chat-Nachricht im eigenen Clan. */
export const sendClanMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

// --- Clan-Spenden-Anfragen (Roadmap P9) ---
/** Öffnet eine Truppen-Spenden-Anfrage (optionaler Wunsch-Einheitstyp). */
export const createDonationRequestSchema = z.object({
  requested_unit_type: z.string().min(1).max(50).optional(),
});

// --- Limited-Time-Events (Roadmap P7-Folge) ---
/** Holt die Belohnung einer erfüllten Event-Aufgabe ab. */
export const claimEventChallengeSchema = z.object({
  challenge_id: z.string().min(1).max(50),
});

// --- Onboarding (Roadmap P8) ---
/** Holt den aktuell offenen Tutorial-Schritt ab (step_id muss der aktive sein). */
export const claimOnboardingSchema = z.object({
  step_id: z.string().min(1).max(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OAuthInput = z.infer<typeof oauthSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangeFactionInput = z.infer<typeof changeFactionSchema>;
export type PlaceBuildingInput = z.infer<typeof placeBuildingSchema>;
export type MoveBuildingInput = z.infer<typeof moveBuildingSchema>;
export type TrainUnitsInput = z.infer<typeof trainUnitsSchema>;
export type DisbandUnitsInput = z.infer<typeof disbandUnitsSchema>;
export type DeployUnitInput = z.infer<typeof deployUnitSchema>;
export type ClanBannerInput = z.infer<typeof clanBannerSchema>;
export type CreateClanInput = z.infer<typeof createClanSchema>;
export type DonateUnitsInput = z.infer<typeof donateUnitsSchema>;
export type StartDungeonInput = z.infer<typeof startDungeonSchema>;
export type IapPurchaseInput = z.infer<typeof iapPurchaseSchema>;
export type ClaimOnboardingInput = z.infer<typeof claimOnboardingSchema>;
export type SendClanMessageInput = z.infer<typeof sendClanMessageSchema>;
export type CreateDonationRequestInput = z.infer<typeof createDonationRequestSchema>;
export type ClaimEventChallengeInput = z.infer<typeof claimEventChallengeSchema>;
