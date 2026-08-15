/**
 * Reine Render-Helfer (isometrische Geometrie + visuelle Level-Progression).
 * Plattformunabhängig — die App nutzt sie für das Skia-Rendering, ohne Zahlen
 * zu duplizieren. Quelle: Abschnitt 13 & 15 des Briefings.
 */

// --- Isometrisches Grid (Abschnitt 15) ---
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const DEFAULT_GRID_SIZE = 30;

export interface ScreenPoint {
  x: number;
  y: number;
}
export interface GridPoint {
  gx: number;
  gy: number;
}

export function gridToScreen(
  gx: number,
  gy: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
): ScreenPoint {
  return { x: (gx - gy) * (tileW / 2), y: (gx + gy) * (tileH / 2) };
}

/** Inverse Iso-Projektion (Float). */
export function screenToGridFloat(
  x: number,
  y: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
): { gx: number; gy: number } {
  const a = x / (tileW / 2);
  const b = y / (tileH / 2);
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/** Inverse Iso-Projektion, auf die nächste Tile gerundet. */
export function screenToGrid(
  x: number,
  y: number,
  tileW: number = TILE_WIDTH,
  tileH: number = TILE_HEIGHT,
): GridPoint {
  const f = screenToGridFloat(x, y, tileW, tileH);
  return { gx: Math.round(f.gx), gy: Math.round(f.gy) };
}

// --- Visuelle Level-Tiers (Abschnitt 13) ---
export type TierName = 'wood' | 'stone' | 'metal' | 'magic' | 'legendary';

export function getTier(level: number): TierName {
  if (level <= 2) return 'wood';
  if (level <= 4) return 'stone';
  if (level <= 6) return 'metal';
  if (level <= 8) return 'magic';
  return 'legendary';
}

export const MATERIAL_COLORS = {
  wood_light: '#c8a87a',
  wood_dark: '#8b7355',
  stone_light: '#9e9e9e',
  stone_dark: '#616161',
  metal_light: '#78909c',
  metal_dark: '#263238',
  gold_accent: '#f0c040',
  magic_purple: '#aa44ff',
  magic_cyan: '#00ccff',
  legendary: '#ff44ff',
  legendary_glow: '#7700bb',
} as const;

/** Haupt-Materialfarbe (hell) pro Tier — für Wand-/Körperflächen. */
export const TIER_WALL_COLOR: Record<TierName, string> = {
  wood: MATERIAL_COLORS.wood_light,
  stone: MATERIAL_COLORS.stone_light,
  metal: MATERIAL_COLORS.metal_light,
  magic: MATERIAL_COLORS.magic_purple,
  legendary: MATERIAL_COLORS.legendary,
};

const ROOF_THRESHOLDS: Array<{ minLevel: number; color: string }> = [
  { minLevel: 1, color: '#c0392b' },
  { minLevel: 3, color: '#8B1A1A' },
  { minLevel: 5, color: '#0d47a1' },
  { minLevel: 7, color: '#4a0080' },
  { minLevel: 9, color: '#000020' },
];

export function roofColorForLevel(level: number): string {
  let color = ROOF_THRESHOLDS[0]!.color;
  for (const t of ROOF_THRESHOLDS) {
    if (level >= t.minLevel) color = t.color;
  }
  return color;
}

/** Himmel-Gradient [oben, unten] pro Tier (Hintergrund-Progression). */
export const SKY_GRADIENT_BY_TIER: Record<TierName, [string, string]> = {
  wood: ['#7ec8ff', '#cdeaff'],
  stone: ['#5a78a8', '#e8a06a'],
  metal: ['#10193a', '#2a3a66'],
  magic: ['#0a0420', '#2a0a4a'],
  legendary: ['#05010f', '#1a0633'],
};

/** Fortschritt 0..1 über die Levelspanne (für Farb-Interpolation). */
export function tierProgress(level: number, maxLevel: number): number {
  if (maxLevel <= 1) return 0;
  return Math.min(1, Math.max(0, (level - 1) / (maxLevel - 1)));
}

export function hasGoldAccents(level: number): boolean {
  return level >= 5;
}
export function hasMagicAura(level: number): boolean {
  return level >= 7;
}
export function hasLegendaryAura(level: number): boolean {
  return level >= 9;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Lineare Farb-Interpolation zwischen zwei Hex-Farben (t = 0..1). */
export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  return toHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}
