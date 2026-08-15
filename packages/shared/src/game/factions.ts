import type { FactionConfig, FactionId, FactionModifiers, GameConfig } from '../types/gameConfig';

/**
 * Liest einen Fraktions-Modifikator. Fehlt der Schlüssel, gilt die Baseline
 * (Standard 1.0 = Menschen). So bleiben die Werte ausschließlich in der Config
 * und werden bei JEDER Berechnung zentral angewandt.
 */
export function mod(
  modifiers: FactionModifiers,
  key: string,
  fallback = 1,
): number {
  const v = modifiers[key];
  return typeof v === 'number' ? v : fallback;
}

export function factionModifiers(config: GameConfig, factionId: FactionId): FactionModifiers {
  return config.factions[factionId].modifiers;
}

export function faction(config: GameConfig, factionId: FactionId): FactionConfig {
  return config.factions[factionId];
}
