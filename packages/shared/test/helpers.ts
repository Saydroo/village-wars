import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameConfig } from '../src/index';

/**
 * Gemeinsame Test-Hilfen. Lädt die EINE Quelle der Wahrheit
 * (`server/config/game-config.json`) genau wie der Server (readFileSync + cast),
 * damit die Tests gegen die echten, konfigurierten Zahlen laufen — niemals gegen
 * im Test hartcodierte Werte. Erwartungen werden aus `cfg` abgeleitet, sodass die
 * Tests beim Anpassen der Config robust bleiben und trotzdem das Verhalten der
 * reinen Logik festschreiben.
 */

const CONFIG_PATH = resolve(__dirname, '../../../server/config/game-config.json');

export const cfg: GameConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as GameConfig;

/** Gleitkomma-Vergleich mit Toleranz (für skalierte Kampf-/Produktionswerte). */
export function approx(actual: number, expected: number, eps = 1e-6): boolean {
  return Math.abs(actual - expected) <= eps;
}
