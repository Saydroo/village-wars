/**
 * SPRITE-METRIK-HELFER — die eine Quelle dafür, wie groß ein Gebäude-Sprite
 * TATSÄCHLICH auf dem Dorf-Rasen erscheint (opake Silhouette in Bildschirm-px),
 * verankert wie im echten Renderer (VillageCanvas): Fußpunkt-Anker auf der MITTE
 * der Grundfläche, Größe = buildingDisplayWidth × buildingDisplayScale, opake
 * Ränder aus SPRITE_CONTENT_BOX (dieselbe Box, die die Kamera-Clamp/S3 misst).
 *
 * Bewusst KEINE Zahlen dupliziert: Footprints + Anker aus der manifest.json,
 * Maßstab aus @village-wars/shared, opake Box aus dem App-Modul spriteContentBox.
 * Läuft der Generator und die App auseinander, ist das ein Code-Fehler, kein
 * zweiter Konstantensatz.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  buildingDisplayWidth,
  buildingDisplayScale,
  gridToScreen,
  footprintTiles,
} from '@village-wars/shared';
import { SPRITE_CONTENT_BOX, FULL_CONTENT_BOX } from '../../apps/mobile/src/rendering/spriteContentBox';

export const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'apps', 'mobile', 'src', 'assets', 'factions', 'humans');

interface Manifest {
  buildings: Record<string, { file: string; anchor?: number[] }>;
}
export const manifest: Manifest = JSON.parse(
  fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'),
);

/** Grundfläche [breit, tief] in Kacheln — EINZIGE Quelle: `@village-wars/shared`
 *  (footprints.ts). Kein veraltetes FOOT-Duplikat, kein manifest-`tiles` mehr. */
export function footprint(type: string): [number, number] {
  return footprintTiles(type);
}

/** Fußpunkt-Anker [x,y] in 0..1 der Master-Leinwand (aus dem Manifest). */
export function anchor(type: string): [number, number] {
  const a = manifest.buildings[type]?.anchor;
  return Array.isArray(a) && a.length === 2 ? [a[0]!, a[1]!] : [0.5, 0.8809];
}

/** Anzeigebreite = Höhe des quadratischen Masters auf dem Bildschirm (Grundzoom). */
export function dispSize(type: string): number {
  return buildingDisplayWidth(512) * buildingDisplayScale(type);
}

export interface ScreenExtents {
  /** px, die die opake Silhouette links/rechts/oben/unten über den Fußpunkt hinausragt. */
  left: number; right: number; top: number; bottom: number;
}

/**
 * Überhang der opaken Silhouette relativ zum Fußpunkt (Kachelmitte der
 * Grundfläche) in Bildschirm-px — exakt die Rechnung aus VillageCanvas'
 * worldBounds-Clamp, nur pro Gebäude isoliert.
 */
export function screenExtents(type: string): ScreenExtents {
  const [ax, ay] = anchor(type);
  const [fL, fT, fR, fB] = SPRITE_CONTENT_BOX[type] ?? FULL_CONTENT_BOX;
  const d = dispSize(type);
  return {
    left: (ax - fL) * d,
    right: (fR - ax) * d,
    top: (ay - fT) * d,
    bottom: (fB - ay) * d,
  };
}

export interface ScreenBox { x0: number; y0: number; x1: number; y1: number; }

/**
 * Opake Bildschirm-Box eines an Grid-Ursprung (gx,gy) stehenden Gebäudes,
 * verankert am Footprint-ZENTRUM (gx+fw/2, gy+fh/2) — 1:1 wie der Renderer.
 * Ergebnis in Bildschirm-px (ohne Kamera-Offset).
 */
export function spriteScreenBox(type: string, gx: number, gy: number): ScreenBox {
  const [fw, fh] = footprint(type);
  const c = gridToScreen(gx + fw / 2, gy + fh / 2);
  const e = screenExtents(type);
  return { x0: c.x - e.left, y0: c.y - e.top, x1: c.x + e.right, y1: c.y + e.bottom };
}

/** Kleinster Abstand (px) zwischen zwei achsenparallelen Boxen; <0 = Überlappung. */
export function boxGap(a: ScreenBox, b: ScreenBox): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1); // >0: horizontale Lücke
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1); // >0: vertikale Lücke
  if (dx >= 0 && dy >= 0) return Math.hypot(dx, dy); // Ecken-Diagonale
  if (dx >= 0) return dx; // nur horizontal getrennt
  if (dy >= 0) return dy; // nur vertikal getrennt
  return Math.max(dx, dy); // beide negativ → Überlappung (negativ)
}

// --- Analyse-CLI: npx tsx tools/layout/spriteMetrics.ts ----------------------
if (require.main === module) {
  const types = Object.keys(manifest.buildings);
  console.log(`Kachel ${TILE_WIDTH}x${TILE_HEIGHT} px · buildingDisplayWidth(512)=${buildingDisplayWidth(512).toFixed(1)} px\n`);
  console.log('Typ             foot  scale  dispPx   Überhang px [L / R / oben / unten]   Breite Kacheln(diag)');
  for (const t of types) {
    const [fw, fh] = footprint(t);
    const e = screenExtents(t);
    const d = dispSize(t);
    // "Kachel-Diagonalen": horizontale px / (TILE_WIDTH/2) = wie viele Kachel-Schritte breit
    const wTiles = ((e.left + e.right) / (TILE_WIDTH / 2)).toFixed(1);
    console.log(
      `${t.padEnd(15)} ${fw}x${fh}  ${buildingDisplayScale(t).toFixed(2)}  ${d.toFixed(0).padStart(5)}   ` +
      `${e.left.toFixed(0).padStart(4)} / ${e.right.toFixed(0).padStart(4)} / ${e.top.toFixed(0).padStart(4)} / ${e.bottom.toFixed(0).padStart(3)}` +
      `        ${wTiles}`,
    );
  }
}
