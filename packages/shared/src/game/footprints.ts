/**
 * GEBÄUDE-FOOTPRINTS (Grundflächen) — GETEILTE QUELLE für Server UND Client.
 *
 * Spiegelbild zu wallConnect.ts: reine, optik-unabhängige Spiellogik in shared,
 * die App (Skia) UND der Server benutzen exakt dieselbe Datei. Vorher lag der
 * Footprint NUR in der mobile-only `manifest.json` (Feld `tiles`) und wurde von
 * `apps/mobile/.../buildingFootprints.ts` gelesen — der Server kannte pro Gebäude
 * nur Position + Typ, NICHT die Größe. Das ist der „geteilte Footprint-Quelle"-
 * Punkt aus docs/STATUS.md §5: hier geschlossen.
 *
 * Trennung Spiellogik ↔ Rendering: der FOOTPRINT (Kachel-Grundfläche, Treffer-
 * flächen/Zerstörung, Platzierung, Deploy-Zone) ist Spiellogik → shared. Der
 * `anchor` (Fußpunkt in 0..1 der Master-Leinwand) und `file` bleiben in der
 * manifest.json, weil rein rendering-spezifisch.
 *
 * KEIN zweiter Konstantensatz: `BUILDING_FOOTPRINTS` ist ab jetzt die EINZIGE
 * Quelle. mobile (VillageCanvas), die Layout-Tools (spriteMetrics, emuclanLayout,
 * relayout_emuclan) und der Harness (village) lesen alle hierüber. Läuft etwas
 * auseinander, ist das ein Fehler im Code — nicht in getrennten Tabellen.
 */

/**
 * [breit, tief] in Kacheln je Gebäudetyp. Werte 1:1 aus der bisherigen
 * manifest.json übernommen (Bodenkontakt der sockellosen Master, gerundet —
 * Herleitung siehe docs/ASSET-PIPELINE.md + design/blender/_nosockel/
 * _masters_report.json). KEINE Balance-/Größenänderung hier.
 *
 * Hinweis: `gold_mine` steht bewusst auf 3×3 (aktueller Laufzeitstand). Die in
 * worldScale.ts angekündigte 4×4-Anhebung gehört in die separate Platzierungs-/
 * Layout-Runde und ist hier NICHT vorweggenommen.
 */
export const BUILDING_FOOTPRINTS: Record<string, readonly [number, number]> = {
  town_hall: [4, 4],
  cannon: [2, 2],
  lumber_camp: [3, 3],
  clan_castle: [2, 2],
  quarry: [3, 3],
  gold_mine: [3, 3],
  storage_wood: [3, 3],
  storage_stone: [3, 3],
  storage_gold: [3, 3],
  barracks: [3, 3],
  watchtower: [2, 2],
  wall: [1, 1],
  research_lab: [2, 2],
  hero_hall: [3, 3],
};

/** [breit, tief] in Kacheln; Default [1,1] wenn der Typ unbekannt ist. */
export function footprintTiles(type: string): [number, number] {
  const t = BUILDING_FOOTPRINTS[type];
  return t ? [t[0], t[1]] : [1, 1];
}

/**
 * GEMEINSAMER FOOTPRINT-HELFER (Hit-Test + Verankerung + Platzierung teilen ihn,
 * damit alle dieselbe Grundfläche „sehen" und nicht auseinanderlaufen).
 *
 * Grid-Zentrum der Grundfläche eines an (bx,by) verankerten Gebäudes — die MITTE
 * der belegten Kacheln, in Grid-Koordinaten (kann .5 sein). Genau hier gehört der
 * Fußpunkt-Anker hin, damit das Gebäude mittig auf seiner Fläche sitzt.
 */
export function footprintCenter(type: string, bx: number, by: number): [number, number] {
  const [fw, fh] = footprintTiles(type);
  return [bx + fw / 2, by + fh / 2];
}

/** Bounding-Box der Grundfläche in Grid-Koordinaten (halb-offen: [minX,maxX) × [minY,maxY)). */
export function footprintBounds(
  type: string,
  bx: number,
  by: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const [fw, fh] = footprintTiles(type);
  return { minX: bx, minY: by, maxX: bx + fw, maxY: by + fh };
}

/** Trifft die Kachel (gx,gy) den Footprint eines an (bx,by) verankerten Gebäudes? */
export function footprintContains(
  type: string,
  bx: number,
  by: number,
  gx: number,
  gy: number,
): boolean {
  const [fw, fh] = footprintTiles(type);
  return gx >= bx && gx < bx + fw && gy >= by && gy < by + fh;
}
