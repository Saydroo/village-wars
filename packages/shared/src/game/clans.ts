import type { ClanBanner, FactionId, GameConfig } from '../index';
import { findUnitDefinition } from './units';

/**
 * Reine Clan-Berechnungen (Phase 4): Housing-Space-Logik der Clan-Burg und
 * Banner-Validierung. Alle Zahlen/Optionen stammen aus der GameConfig
 * (clan.clan_castle, clan.banner_options). Front- und Backend teilen sich diese
 * Helfer, damit die Stellplatz-Mathematik nirgends doppelt (und divergent) lebt.
 */

/** Housing Space (Stellplätze) einer Clan-Burg auf gegebener Stufe (0 ohne Burg). */
export function clanCastleHousing(config: GameConfig, castleLevel: number): number {
  if (castleLevel <= 0) return 0;
  const levels = config.clan.clan_castle.levels;
  // Höchste definierte Stufe <= castleLevel verwenden.
  let cap = 0;
  for (const l of levels) {
    if (l.level <= castleLevel) cap = l.housing_space;
  }
  return cap;
}

/**
 * Housing Space EINER Einheit (faction-unabhängig — Stellplätze werden nicht von
 * Fraktions-Modifikatoren verändert). Sucht die Einheit gemeinsam ODER in den
 * exklusiven Einheiten irgendeiner Fraktion (der Wert ist überall identisch).
 */
export function unitHousing(config: GameConfig, unitType: string): number {
  const common = config.units_common[unitType];
  if (common && typeof common === 'object' && 'housing_space' in common) {
    return (common as { housing_space: number }).housing_space;
  }
  for (const faction of Object.keys(config.factions_exclusive_content) as FactionId[]) {
    const def = findUnitDefinition(config, unitType, faction);
    if (def) return def.housing_space;
  }
  return 0;
}

/** Summe der Stellplätze einer Menge stationierter Einheiten. */
export function defendersHousingUsed(
  config: GameConfig,
  defenders: Array<{ unit_type: string; quantity: number }>,
): number {
  let sum = 0;
  for (const d of defenders) sum += unitHousing(config, d.unit_type) * d.quantity;
  return sum;
}

/**
 * Prüft ein Banner gegen die erlaubten Baukasten-Optionen (clan.banner_options).
 * Liefert null bei gültig, sonst eine Fehlermeldung.
 */
export function validateBanner(config: GameConfig, banner: ClanBanner): string | null {
  const opt = config.clan.banner_options;
  if (!opt.shapes.includes(banner.shape)) return `Unbekannte Banner-Form: ${banner.shape}`;
  if (!opt.symbols.includes(banner.symbol)) return `Unbekanntes Banner-Symbol: ${banner.symbol}`;
  const colors = [banner.primary_color, banner.secondary_color, banner.symbol_color];
  for (const c of colors) {
    if (!opt.colors.includes(c)) return `Unerlaubte Banner-Farbe: ${c}`;
  }
  return null;
}
