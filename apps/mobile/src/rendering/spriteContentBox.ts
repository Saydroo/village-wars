/**
 * Opake Bounding-Box der MENSCHEN-Gebäude-Master (sockellose 512er-Blender-
 * Renders) als [links, oben, rechts, unten] in Bruchteilen der Leinwand (0..1).
 *
 * NUR für die Kamera-/Pan-Clamp-Logik (useWorldCamera „contain"). Die Master
 * haben je nach Bauhöhe viel transparenten Rand — town_hall ist erst ab ~37 %
 * der Leinwand opak, eine Kanone erst ab ~73 %. Dieser Rand gehört NICHT zur
 * sichtbaren Silhouette. Würde die Clamp-Box die volle Leinwand mitzählen,
 * bliebe beim Scrollen an die Ränder Leerraum stehen (die transparente Fläche
 * über den Turmspitzen). Mit diesen Trim-Werten umschließt die Box exakt das,
 * was man sieht → kein Scrollen ins Leere, nichts abgeschnitten.
 *
 * WICHTIG: beeinflusst ausschließlich die Scroll-Grenzen. Rendering, Sprites,
 * Footprints und BUILDING_DISPLAY_SCALE bleiben unberührt.
 *
 * Regenerieren nach Neu-Rendern der Master (alpha>16-Scan der PNGs):
 *   scratchpad/genbbox.ps1  (System.Drawing, Schrittweite 2)
 */
export type ContentBox = readonly [left: number, top: number, right: number, bottom: number];

export const SPRITE_CONTENT_BOX: Record<string, ContentBox> = {
  town_hall: [0.2891, 0.3672, 0.6738, 0.8848],
  cannon: [0.3828, 0.7305, 0.6465, 0.8809],
  lumber_camp: [0.2891, 0.6094, 0.6934, 0.8809],
  clan_castle: [0.3789, 0.6367, 0.6152, 0.8809],
  quarry: [0.2891, 0.5, 0.6973, 0.8848],
  gold_mine: [0.2773, 0.4766, 0.6895, 0.8809],
  storage_wood: [0.2695, 0.5859, 0.6895, 0.8809],
  storage_stone: [0.3359, 0.6406, 0.6699, 0.8848],
  storage_gold: [0.332, 0.668, 0.6738, 0.8809],
  barracks: [0.3125, 0.5156, 0.6777, 0.8809],
  watchtower: [0.3906, 0.4336, 0.6074, 0.8809],
  wall: [0.4062, 0.707, 0.5918, 0.8809],
  research_lab: [0.3945, 0.6523, 0.5605, 0.8809],
  hero_hall: [0.3945, 0.668, 0.623, 0.8809],
};

/** Fallback = volle Leinwand (kein Trim), falls ein Typ fehlt. */
export const FULL_CONTENT_BOX: ContentBox = [0, 0, 1, 1];
