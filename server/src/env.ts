import dotenv from 'dotenv';

dotenv.config();

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Umgebungsvariable ${name} ist keine Zahl: ${v}`);
  return n;
}

function list(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const NODE_ENV = str('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';

export const env = {
  NODE_ENV,
  isProd,
  PORT: int('PORT', 4000),
  CORS_ORIGIN: str('CORS_ORIGIN', '*'),

  // Rate-Limit (konfigurierbar, damit z.B. E2E-Tests/Lasttests die Grenzen hochsetzen
  // können; Produktions-Defaults bleiben unverändert).
  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX: int('RATE_LIMIT_MAX', 120),
  AUTH_RATE_LIMIT_MAX: int('AUTH_RATE_LIMIT_MAX', 15),

  DATABASE_URL: process.env.DATABASE_URL ?? '',

  REDIS_URL: str('REDIS_URL', 'redis://localhost:6379'),

  // In Produktion MUSS ein echtes Secret gesetzt sein.
  JWT_ACCESS_SECRET: str('JWT_ACCESS_SECRET', isProd ? undefined : 'dev-access-secret'),
  JWT_REFRESH_SECRET: str('JWT_REFRESH_SECRET', isProd ? undefined : 'dev-refresh-secret'),
  JWT_ACCESS_EXPIRES: str('JWT_ACCESS_EXPIRES', '15m'),
  JWT_REFRESH_EXPIRES: str('JWT_REFRESH_EXPIRES', '30d'),

  GOOGLE_CLIENT_IDS: list('GOOGLE_CLIENT_ID'),
  APPLE_CLIENT_IDS: list('APPLE_CLIENT_ID'),

  // In-App-Purchases (Phase 5). Ohne echte Store-Credentials läuft lokal der
  // Sandbox-Modus (Belege der Form "sandbox:<product_id>:<transaction_id>").
  IAP_ALLOW_SANDBOX: bool('IAP_ALLOW_SANDBOX', !isProd),
  APPLE_IAP_SHARED_SECRET: process.env.APPLE_IAP_SHARED_SECRET ?? '',
  GOOGLE_PLAY_PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? '',
} as const;
