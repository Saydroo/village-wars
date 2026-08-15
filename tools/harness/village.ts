/**
 * TESTDORF-LAYOUT (Vertical Slice Schritt 2.3) — nur zur Maßstabskontrolle,
 * keine Spiellogik. Wird von scale_village.ts (Punkt 3) UND zoom_village.ts
 * (Punkt 5) benutzt.
 *
 * Platzierung: jede Gebäude-Grundfläche kommt aus der geteilten Footprint-Quelle
 * `@village-wars/shared` (footprints.ts). Der Validator unten stellt sicher, dass
 * sich keine zwei Footprints überlappen UND mindestens EINE Kachel Abstand
 * dazwischen bleibt — genau die Ergänzung zu Schritt 3.
 */
import { footprintTiles } from '@village-wars/shared';

export interface Placement {
  type: string;
  /** Linke-obere Kachel der Grundfläche (wie Building.grid_x/grid_y im Spiel). */
  gx: number;
  gy: number;
}
export interface UnitPlacement {
  type: string;
  /** Kachel-Mittelpunkt (Float), Einheiten haben keine feste Grundfläche. */
  gx: number;
  gy: number;
}

export function footprint(type: string): number {
  return footprintTiles(type)[0];
}

/**
 * ENGES CoC-Dorf mit REALISTISCHEN (sockellosen) Footprints, je genau 1 Kachel
 * Weg dazwischen. Origin = linke-obere Footprint-Kachel; Footprints aus dem
 * Manifest (town_hall 4, gold_mine 4, barracks/Lager 3, watchtower 2).
 *
 *   Spalten:  2..5 [6] 7..10        Lücken = Wege (genau 1 Kachel)
 *   town_hall(4) . gold_mine(4)     Reihe 2..5
 *   barracks(3) storage_wood(3) storage_stone(3)   Reihe 7..9
 *   watchtower(2)                   Reihe 11..12
 */
export const BUILDINGS: Placement[] = [
  { type: 'town_hall', gx: 2, gy: 2 }, // foot 4 → x2..5  y2..5
  { type: 'barracks', gx: 7, gy: 2 }, // foot 3 → x7..9  y2..4 (Weg: Spalte 6)
  { type: 'storage_wood', gx: 2, gy: 7 }, // foot 3 → x2..4  y7..9 (Weg: Reihe 6)
  { type: 'storage_stone', gx: 6, gy: 7 }, // foot 3 → x6..8 (Weg: Spalte 5)
  { type: 'watchtower', gx: 10, gy: 7 }, // foot 2 → x10..11 y7..8 (Weg: Spalte 9)
];

/** 8 Archer in den echten 1-Kachel-Gassen und am Dorfrand (nie im Footprint). */
export const UNITS: UnitPlacement[] = [
  { type: 'archer', gx: 6.5, gy: 3.0 }, // Gasse Spalte 6 (Rathaus ↔ Kaserne)
  { type: 'archer', gx: 6.5, gy: 4.5 }, // Gasse Spalte 6
  { type: 'archer', gx: 4.0, gy: 6.5 }, // Weg Reihe 6 (Rathaus ↔ Holzlager)
  { type: 'archer', gx: 7.5, gy: 6.0 }, // Weg Reihe 6 (unter der Kaserne)
  { type: 'archer', gx: 5.5, gy: 8.0 }, // Gasse Spalte 5 (Lager ↔ Lager)
  { type: 'archer', gx: 9.5, gy: 8.0 }, // Gasse Spalte 9 (Steinlager ↔ Wachturm)
  { type: 'archer', gx: 3.0, gy: 10.5 }, // Rand unten
  { type: 'archer', gx: 11.0, gy: 10.5 }, // Rand unten am Wachturm
];

/** Bounding-Box in Kacheln über alle Footprints (für Kamera-Zentrierung). */
export function layoutBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of BUILDINGS) {
    const f = footprint(b.type);
    minX = Math.min(minX, b.gx);
    minY = Math.min(minY, b.gy);
    maxX = Math.max(maxX, b.gx + f);
    maxY = Math.max(maxY, b.gy + f);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Prüft: kein Footprint überlappt, und zwischen je zwei Gebäuden bleibt ≥1
 * Kachel frei. Wirft mit Klartext, wenn das Layout die Regel verletzt.
 */
export function validateLayout(): { ok: true; report: string[] } {
  const report: string[] = [];
  const rects = BUILDINGS.map((b) => {
    const f = footprint(b.type);
    return { type: b.type, x0: b.gx, y0: b.gy, x1: b.gx + f - 1, y1: b.gy + f - 1, f };
  });
  for (const r of rects) report.push(`${r.type.padEnd(14)} foot ${r.f}  Kacheln x[${r.x0}..${r.x1}] y[${r.y0}..${r.y1}]`);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      // FREIE Kacheln zwischen den Footprints je Achse: berührt = 0, ein Feld
      // dazwischen = 1. (Koordinatendifferenz minus 1.)
      const freeX = Math.max(a.x0 - b.x1, b.x0 - a.x1) - 1;
      const freeY = Math.max(a.y0 - b.y1, b.y0 - a.y1) - 1;
      // Im Iso-Grid genügt eine Achse mit ≥1 freier Kachel als sauberer Abstand.
      const free = Math.max(freeX, freeY);
      if (free < 1) {
        throw new Error(`Footprints ohne 1-Kachel-Abstand: ${a.type} vs ${b.type} (freiX=${freeX}, freiY=${freeY})`);
      }
      report.push(`  Abstand ${a.type} ↔ ${b.type}: ${free} freie Kachel(n)`);
    }
  }
  // Einheiten dürfen nicht in einem Footprint stehen.
  for (const u of UNITS) {
    for (const r of rects) {
      if (u.gx > r.x0 && u.gx < r.x1 + 1 && u.gy > r.y0 && u.gy < r.y1 + 1) {
        throw new Error(`Archer bei (${u.gx},${u.gy}) steht im Footprint von ${r.type}`);
      }
    }
  }
  return { ok: true, report };
}
