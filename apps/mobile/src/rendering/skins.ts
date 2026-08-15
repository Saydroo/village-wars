import type { ShopSkin } from '@village-wars/shared';

/**
 * Skins sichtbar machen (Politur nach Phase 6): der Backend-Teil (Kauf/Besitz/
 * Anwenden über `player_skins.is_active`) ist vollständig — hier werden die
 * AKTIVEN Skins aus dem Shop-Katalog in eine renderfreundliche Farb-Tabelle
 * destilliert, die die Renderer (buildingSprite, BattleCanvas, DungeonBattleView,
 * Terrain) anwenden. Rein kosmetisch, keine Balance.
 */

/** Farben eines Skins (aus `preview_data`). */
export interface SkinColors {
  /** Hauptfarbe (Gebäude-Wand / Einheiten-Körper). */
  primary?: string;
  /** Akzent-/Trim-Farbe. */
  accent?: string;
  /** Boden-Tönung (nur village_theme). */
  ground?: string;
}

/** Aktuell angewandte Skins, nach Ziel gruppiert. */
export interface ActiveSkins {
  /** Gebäude-Skins je `building_type`. */
  buildings: Record<string, SkinColors>;
  /** Einheiten-Skins je `unit_type`. */
  units: Record<string, SkinColors>;
  /** Dorf-Theme (target_id 'all'), falls eines aktiv ist. */
  villageTheme: SkinColors | null;
}

export const EMPTY_ACTIVE_SKINS: ActiveSkins = { buildings: {}, units: {}, villageTheme: null };

function colorsOf(pd: Record<string, unknown> | null): SkinColors {
  const pick = (k: string): string | undefined => (typeof pd?.[k] === 'string' ? (pd[k] as string) : undefined);
  return { primary: pick('primary'), accent: pick('accent'), ground: pick('ground') };
}

/** Baut die `ActiveSkins`-Tabelle aus der Shop-Liste (nur `applied`-Einträge). */
export function deriveActiveSkins(skins: ShopSkin[]): ActiveSkins {
  const out: ActiveSkins = { buildings: {}, units: {}, villageTheme: null };
  for (const s of skins) {
    if (!s.applied) continue;
    const colors = colorsOf(s.preview_data);
    if (s.target_type === 'building') out.buildings[s.target_id] = colors;
    else if (s.target_type === 'unit') out.units[s.target_id] = colors;
    else if (s.target_type === 'village_theme') out.villageTheme = colors;
  }
  return out;
}
