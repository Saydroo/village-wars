/**
 * MAUER-AUTO-CONNECT (Clash-Stil) — REINE LOGIK, strikt optik-unabhängig.
 *
 * Jede Mauer ist ein 1×1-Feld (seit der 1×1-Umstellung). Aus der orthogonalen
 * Nachbarschaft (welche der 4 Felder ±1 in x/y ebenfalls Mauer sind) ergibt sich
 * der Verbindungstyp: gerade / Ecke / T / Kreuzung / Ende / isoliert. Dieses
 * Modul liefert NUR die Klassifikation (Maske + Typ + kanonische Drehung).
 *
 * Das RENDERING ist bewusst NICHT hier: die App (Skia) und der Harness (CanvasKit)
 * zeichnen jeweils selbst, gesteuert allein durch dieses Ergebnis. In Phase 2
 * zeichnen beide den prozeduralen Vektor-Fallback (nur zum Prüfen der Logik), in
 * Phase 3 dieselbe Klassifikation → Blender-Sprite-Stücke (Basis + Drehung).
 */

/** Bit-Flags der 4 orthogonalen Nachbarn (Grid). */
export const WALL_N = 1; // y − 1
export const WALL_E = 2; // x + 1
export const WALL_S = 4; // y + 1
export const WALL_W = 8; // x − 1

export type WallConnectionType =
  | 'isolated'
  | 'end'
  | 'straight'
  | 'corner'
  | 't'
  | 'cross';

export interface WallConnection {
  /** 4-Bit-Nachbarmaske (WALL_N|E|S|W). */
  mask: number;
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  type: WallConnectionType;
  /**
   * Kanonische Drehung 0..3 in Vierteldrehungen IM UHRZEIGERSINN (Screen: N=oben-
   * rechts → E=unten-rechts → S=unten-links → W=oben-links, also CW = N→E→S→W).
   * Basis-Ausrichtung je Typ: end→N, straight→N–S, corner→N+E, t→ohne W (N+E+S).
   * Für Phase 2 (prozedural über n/e/s/w) unnötig, aber für die spätere
   * Sprite-Auswahl (Phase 3, Basisstück + Drehung/Spiegeln) vorbereitet.
   */
  rotation: number;
}

/** 4-Bit-Nachbarmaske für die Kachel (x,y) aus einem Mauer-Prädikat. */
export function wallMask(
  isWall: (x: number, y: number) => boolean,
  x: number,
  y: number,
): number {
  let m = 0;
  if (isWall(x, y - 1)) m |= WALL_N;
  if (isWall(x + 1, y)) m |= WALL_E;
  if (isWall(x, y + 1)) m |= WALL_S;
  if (isWall(x - 1, y)) m |= WALL_W;
  return m;
}

/** Maske → Verbindungstyp + kanonische Drehung. */
export function classifyWall(mask: number): WallConnection {
  const n = (mask & WALL_N) !== 0;
  const e = (mask & WALL_E) !== 0;
  const s = (mask & WALL_S) !== 0;
  const w = (mask & WALL_W) !== 0;
  const count = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);

  let type: WallConnectionType;
  let rotation = 0;

  if (count === 0) {
    type = 'isolated';
  } else if (count === 1) {
    type = 'end';
    rotation = n ? 0 : e ? 1 : s ? 2 : 3; // Richtung des einzigen Anschlusses
  } else if (count === 2) {
    if (n && s) {
      type = 'straight';
      rotation = 0; // N–S (senkrecht im Grid)
    } else if (e && w) {
      type = 'straight';
      rotation = 1; // E–W (waagerecht im Grid)
    } else {
      type = 'corner';
      rotation = n && e ? 0 : e && s ? 1 : s && w ? 2 : 3;
    }
  } else if (count === 3) {
    type = 't';
    // Basis = ohne W (N+E+S); Drehung nach FEHLENDER Seite (CW): W→0,N→1,E→2,S→3.
    rotation = !w ? 0 : !n ? 1 : !e ? 2 : 3;
  } else {
    type = 'cross';
  }

  return { mask, n, e, s, w, type, rotation };
}

/** Bequemer Direktzugriff: Verbindung der Mauer bei (x,y) aus einem Prädikat. */
export function wallConnectionAt(
  isWall: (x: number, y: number) => boolean,
  x: number,
  y: number,
): WallConnection {
  return classifyWall(wallMask(isWall, x, y));
}

/** Baut ein `isWall`-Prädikat aus einer Liste von Mauer-Koordinaten (1×1). */
export function wallPredicate(
  walls: ReadonlyArray<{ grid_x: number; grid_y: number }>,
): (x: number, y: number) => boolean {
  const set = new Set(walls.map((w) => `${w.grid_x},${w.grid_y}`));
  return (x, y) => set.has(`${x},${y}`);
}
