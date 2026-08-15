/**
 * MUSS als allererstes importiert werden (vor jedem Modul, das `../src/env` oder den
 * DB-Pool lädt) — setzt die Test-Umgebung, bevor `env.ts`/`pool.ts` sie einlesen.
 * Dieses Modul importiert bewusst NICHTS aus dem Server, damit die Reihenfolge stimmt.
 *
 * Wichtig: `dotenv` (in env.ts) überschreibt bereits gesetzte Variablen NICHT — die
 * Werte hier haben also Vorrang vor `server/.env` (das auf die Dev-DB zeigt).
 */

// Eigene Test-Datenbank — NIEMALS die Dev-DB `village_wars` verschmutzen.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:55432/village_wars_test';

process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'development' : (process.env.NODE_ENV ?? 'development');

// Sandbox-IAP für die Kauf-Tests aktivieren.
process.env.IAP_ALLOW_SANDBOX = 'true';

// Rate-Limits hochsetzen, damit die vielen Test-Requests nicht in 429 laufen.
process.env.RATE_LIMIT_MAX = '1000000';
process.env.AUTH_RATE_LIMIT_MAX = '1000000';

// Längeres Access-Token, damit kein Test an Ablauf scheitert.
process.env.JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? '1h';
