/**
 * GEMEINSAMER WELTMASSSTAB — eine einzige Quelle für „wie groß ist ein Ding".
 *
 * Vorher hatte jeder Sprite-Typ seine eigene Größenregel: Gebäude `FW * 1.2`
 * (+ `TYPE_SCALE`-Sonderfaktoren), Einheiten die feste Konstante `UNIT_DISP_W`.
 * Damit standen Gebäude und Einheiten NICHT im selben Maßstab — genau das, was
 * Clash of Clans eisern durchhält. Hier lebt jetzt EINE Konstante
 * (`PX_PER_WORLD_UNIT`); jedes Sprite wird nur noch über die Pixel-pro-
 * Welteinheit seines Masters umgerechnet.
 *
 * Kette: Blender-Welteinheit → Master-PNG (px/Welteinheit je Master-Sorte) →
 * Bildschirm (px/Welteinheit im Grundzoom). Der Zoom skaliert danach nur noch
 * die Kamera-Gruppe, nie die Sprite-Größe (kein Nachladen beim Zoomen).
 *
 * KALIBRIERUNG (Messungen am 512er-Master, 2026-07-26):
 * - Gebäude-Master: vom Export-Skript nachweislich auf **38.74 px/Welteinheit**
 *   normiert (`design/blender/_scripts` → export_buildings.py, siehe
 *   docs/ASSET-PIPELINE.md §2). Rathaus-Silhouette misst dort 261 px
 *   → 6.74 Welteinheiten breit.
 * - Einheiten-Master: der Archer wurde ohne festgehaltenen px/Welteinheit-Wert
 *   exportiert. Kalibriert über die Figurhöhe: Fußpunkt (Anker y=0.8921 →
 *   y=456.8) bis Oberkante Kapuze (y=14) = **442.8 px**, angesetzt als
 *   **1.90 Welteinheiten** Figurhöhe (Mensch inkl. Kapuze/Feder)
 *   → 442.8 / 1.90 = **233 px/Welteinheit**. Körpersilhouette 197 px
 *   → 0.845 Welteinheiten.
 * - Daraus im Grundzoom (Kachel 64 px): Rathaus 6.74 × 45 = 303 px ≈ **4.74
 *   Kacheln** breit, Archer-Körper 0.845 × 45 ≈ **38 px**.
 */

import { TILE_WIDTH } from './render';

/** Kantenlänge der quadratischen Sprite-Master (PNG-Leinwand). */
export const SPRITE_MASTER_CANVAS = 512;

/** Pixel pro Welteinheit IM GEBÄUDE-MASTER (Export-Normierung). */
export const BUILDING_MASTER_PPU = 38.74;

/** Pixel pro Welteinheit IM EINHEITEN-MASTER (Figurhöhen-Kalibrierung). */
export const UNIT_MASTER_PPU = 233;

/**
 * DIE Konstante: Bildschirm-Pixel pro Welteinheit im Grundzoom (Zoom = 1).
 * Gebäude UND Einheiten teilen sie sich — hier wird der Maßstab gesetzt.
 */
export const PX_PER_WORLD_UNIT = 45;

/** Kachelbreite im Grundzoom, ausgedrückt in Welteinheiten (≈ 1.42). */
export const WORLD_UNITS_PER_TILE = TILE_WIDTH / PX_PER_WORLD_UNIT;

/**
 * Anzeigebreite eines Sprites in Bildschirm-Pixeln (Grundzoom).
 * @param masterWidthPx Breite der Master-Leinwand des Sprites (meist 512).
 * @param masterPpu     px/Welteinheit, mit dem dieser Master exportiert wurde.
 */
export function spriteDisplayWidth(masterWidthPx: number, masterPpu: number): number {
  return (masterWidthPx / masterPpu) * PX_PER_WORLD_UNIT;
}

/** Anzeigebreite eines Gebäude-Masters (Grundzoom). */
export function buildingDisplayWidth(masterWidthPx: number = SPRITE_MASTER_CANVAS): number {
  return spriteDisplayWidth(masterWidthPx, BUILDING_MASTER_PPU);
}

/**
 * PRO-TYP-ANZEIGE-FAKTOR — bewusste Feinjustierung der Größenhierarchie
 * (CoC-orientiert; Freigabe Ufuk 2026-07-28, Runde 1 „rein optisch").
 *
 * Der gemeinsame Weltmaßstab oben hält alle Master physikalisch im selben
 * px/Welteinheit. Clash of Clans weicht davon bewusst ab: das Rathaus dominiert,
 * Produktion ist mittel, Verteidigung/Lager kompakt. Dieser Faktor multipliziert
 * NUR die Bildschirm-Anzeigegröße eines Bild-Sprites um seinen Fußpunkt-Anker —
 * Footprint, Anker-Verhältnis und Master-PNG bleiben unberührt. Die Hierarchie
 * ist damit rein optisch, in-App und jederzeit reversibel (kein Neu-Render).
 * 1.0 bzw. fehlender Eintrag = unverändert.
 *
 * hero_hall & research_lab fehlen bewusst: ihre Zielgröße kommt später beim
 * Neu-Render (Gebäude-Aufwärmung), nicht per In-App-Upscale. wall bleibt bei 1.0.
 * Footprint-Änderungen (gold_mine, research_lab) laufen separat in der
 * Platzierungs-/Layout-Runde.
 */
export const BUILDING_DISPLAY_SCALE: Record<string, number> = {
  town_hall: 1.22,
  gold_mine: 0.80,
  quarry: 0.81,
  lumber_camp: 0.82,
  barracks: 0.91,
  storage_wood: 0.72,
  storage_gold: 0.89,
  storage_stone: 0.91,
  clan_castle: 0.99,
  cannon: 0.84,
  watchtower: 1.04,
};

/** Anzeige-Skalierungsfaktor für einen Gebäudetyp (Default 1.0, fehlt = unverändert). */
export function buildingDisplayScale(type: string): number {
  return BUILDING_DISPLAY_SCALE[type] ?? 1;
}

/** Anzeigebreite eines Einheiten-Masters (Grundzoom). */
export function unitDisplayWidth(masterWidthPx: number = SPRITE_MASTER_CANVAS): number {
  return spriteDisplayWidth(masterWidthPx, UNIT_MASTER_PPU);
}

// --- Kamera-Zoom (Vertical Slice Schritt 2) ---------------------------------
// Der Zoom ist eine reine Skalierung der Kamera-Gruppe ÜBER dem bestehenden
// Pan. Web/Desktop steuert ihn per Mausrad (auf die Mausposition zentriert),
// Mobil per Zwei-Finger-Pinch (auf die Fingermitte zentriert) — beide schreiben
// denselben Zustand.

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 1.5;
export const ZOOM_DEFAULT = 1;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * Zoom um einen Bildschirm-Fixpunkt (Maus bzw. Fingermitte): der Weltpunkt
 * unter `focus` muss nach dem Zoom wieder exakt unter `focus` liegen.
 * `cam` ist der Kamera-Offset in Bildschirm-Pixeln (screen = cam + zoom*welt).
 */
export function zoomAround(
  cam: { x: number; y: number },
  zoom: number,
  nextZoomRaw: number,
  focus: { x: number; y: number },
): { cam: { x: number; y: number }; zoom: number } {
  const next = clampZoom(nextZoomRaw);
  const k = next / zoom;
  return {
    zoom: next,
    cam: { x: focus.x - k * (focus.x - cam.x), y: focus.y - k * (focus.y - cam.y) },
  };
}
