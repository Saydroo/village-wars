/**
 * EMUCLAN-REFERENZ-LAYOUT — parametrisierbarer Zonen-Generator (S5).
 *
 * KEIN handplatziertes Wegwerf-Testdorf, sondern die Vorlage fürs Start-Dorf
 * neuer Spieler nach klassischem Clash-of-Clans-Schema:
 *
 *   • KERN (ummauert):   town_hall zentral · Verteidigung (cannon/watchtower)
 *                        eng um das Rathaus · Lager + clan_castle als Wertsachen-
 *                        Ring · hero_hall/research_lab direkt am Kern.
 *   • MAUER-RING:        EIN geschlossener Diamant-Ring um den Kern (nicht lose
 *                        Segmente). Auf dem Iso-Screen ein umlaufendes Rechteck.
 *   • RESSOURCEN-PUFFER: Produktion (gold_mine/lumber_camp/quarry/barracks)
 *                        als äußere Schicht vor der Mauer.
 *
 * Die Positionen werden aus benannten ZONEN-Radien BERECHNET (Ring-Verteilung),
 * nicht pro Gebäude hartkodiert — Radius/Zahl ändern lässt das Layout neu fließen.
 *
 * ABSTÄNDE: nach dem TATSÄCHLICHEN Sprite-Überhang (opake Box aus
 * spriteContentBox.ts, verankert am Footprint-Zentrum wie der echte Renderer),
 * NICHT nach dem Kachel-Footprint — die großen Master (gold_mine-Felsen,
 * research_lab, Rathaus) ragen über ihre kleinere Grundfläche hinaus. Footprints
 * kommen aus der manifest.json (seit S4 gold_mine 3×3, research_lab 2×2); es gibt
 * KEINE veraltete Footprint-Tabelle mehr.
 *
 * STRUKTUR vs. BALANCE getrennt: Zonen-Geometrie unten frei tunebar; die
 * kampf-relevanten Werte (Reichweiten aus der game-config, Mauer-Radius,
 * Rathaus-Position, Gebäude-Zahlen) stehen als benannte Konstanten in BALANCE
 * und lassen sich am fertigen Kampf nachjustieren, ohne den Generator umzubauen.
 *
 *   Analyse/Report:  npx tsx tools/layout/emuclanLayout.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, footprint, spriteScreenBox, type ScreenBox } from './spriteMetrics';

// ============================================================================
// BALANCE — am fertigen Kampf nachjustierbar (Reichweiten, Mauer, Zahlen, TH).
// ============================================================================

const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'server', 'config', 'game-config.json'), 'utf8'),
) as { buildings_common: Record<string, { range_tiles?: number }> };

/** Verteidigungs-Reichweiten in Kacheln — EINZIGE Quelle: game-config.json. */
export const DEFENSE_RANGE_TILES: Record<string, number> = {
  watchtower: config.buildings_common.watchtower?.range_tiles ?? 6,
  cannon: config.buildings_common.cannon?.range_tiles ?? 7,
};

export const BALANCE = {
  /** Grid-Mittelpunkt = Zentrum der town_hall-Grundfläche (Kern-Anker). */
  townHallCenter: { gx: 22, gy: 22 },

  /** Verteidigung verteilt auf den 4 MAUER-ECKEN-Diagonalen (nahe der Mauer, nicht
   *  im Kern). REIHENFOLGE bei Phase 0.5: u0.5=+x+y (Front), u1.5=−x+y, u2.5=−x−y,
   *  u3.5=+x−y. Kanonen (Reichweite 7) auf die zwei Diagonalen mit dem meisten
   *  Vorfeld/Produktion, Wachtürme (6) auf die übrigen — hier: [cannon(Front),
   *  cannon(−x+y), watchtower(−x−y), watchtower(+x−y)]. Jede Kanten-Mitte liegt
   *  zwischen zwei Eck-Türmen → Reichweiten-Überlappung an der Mauerlinie. */
  defenders: ['cannon', 'cannon', 'watchtower', 'watchtower'] as string[],

  /** Lager auf den 3 SICHTBAREN Kanten-Mitten (Front u0.5 / Links u1.5 / Rechts
   *  u3.5). Die Gerade-hinten-Mitte (u2.5, Rathaus-Schatten) bleibt bewusst FREI
   *  (kein totes Schauobjekt dort). REIHENFOLGE [Front, Links, Rechts]. */
  coreValuables: ['storage_gold', 'storage_wood', 'storage_stone'] as string[],

  /** clan_castle: Front-Tor mittig, VOR der Mauer (Screen unten). Eigener Slot,
   *  weiter außen als das Held/Labor-Paar, damit es außerhalb des Mauer-Rechtecks
   *  sitzt. */
  frontGate: ['clan_castle'] as string[],

  /** hero_hall + research_lab: sichtbares Paar „direkt am Kern", das Front-Tor
   *  flankierend (vor der Mauer). */
  special: ['hero_hall', 'research_lab'] as string[],

  /** Produktion als Ressourcen-Puffer AUSSERHALB der Mauer. */
  production: ['gold_mine', 'gold_mine', 'lumber_camp', 'quarry', 'barracks'] as string[],

  /** Mauer: GESCHLOSSENER, GRID-ACHSENPARALLELER 1×1-Ring (Clash-Modell: jedes
   *  Feld ein Mauerstück). Auf dem Iso-Screen ein DIAMANT. Grid-achsenparallel ist
   *  Pflicht fürs Auto-Connect (Phase 2): nur so sind benachbarte Segmente über
   *  ±1 in x/y (NESW) verbunden — ein Manhattan-Diamant (Screen-Rechteck) wäre
   *  eine diagonale Treppe, deren Stücke NICHT NESW-benachbart sind.
   *  wallHalfExtent = Chebyshev-Halbausdehnung um das Zentrum; 8 umschließt den
   *  Kern (reicht bis ±7) mit einer Kachel Luft. */
  wallHalfExtent: 8,

  /** GENERELLE ABSTANDS-REGEL: Mindest-Rasen (Kacheln) zwischen JEDEM Gebäude-
   *  Footprint und der nächsten Mauer-Kachel. 1 = überall ≥1 Kachel Gras zwischen
   *  Gebäude und Ring, damit kein Sprite optisch in die Mauer läuft (wie zuvor
   *  clan_castle & Co.). Als Constraint erzwungen (enforceWallSpacing), nicht pro
   *  Position — gilt so für jedes künftige Layout. */
  wallSpacing: 1,
} as const;

// ============================================================================
// ZONEN-GEOMETRIE — rein optisch/Spacing, frei tunebar (Radien in Kacheln).
// ============================================================================

const ZONES = {
  /** Verteidigung auf den 4 DIAGONALEN (Phase 0.5 → u=0.5/1.5/2.5/3.5), NAH an der
   *  Mauer statt zentral im Kern. Manhattan-Radius 12 = Chebyshev ~6 auf der
   *  Diagonale, also knapp innerhalb des Mauer-Quadrats (H=8) und je nahe einer
   *  Mauer-ECKE. Zweck: die Reichweiten (7/6) decken die MAUERLINIE + das Vorfeld
   *  DAVOR und überlappen an den Kanten-Mitten (jede Kanten-Mitte liegt zwischen
   *  zwei Eck-Verteidigern) — nicht mehr nur den leeren Kern. Ecken-Platzierung
   *  deckt ein Quadrat-Perimeter mit 4 Türmen besser ab als Achsen-Platzierung. */
  defenseRadius: 12,
  defensePhase: 0.5,

  /** Lager auf den 3 sichtbaren Kanten-Mitten. Radius 6.5: eng am Kern, zwischen
   *  den Eck-Verteidigern (Radius 6), innerhalb der Mauer (Radius 9). */
  coreRadius: 6.5,
  coreAngles: [0.5, 1.5, 3.5] as number[],

  /** clan_castle mittig am Front-Tor (u0.5), aber MIT echter Lücke zum Mauerring:
   *  Radius 24 (statt 20) → Footprint-Ursprung (33,33) statt (31,31), also 2 Kacheln
   *  diagonal vor der Mauer-Ecke (30,30). So überlappt ihr großes Tor-Sprite den
   *  Eck-Wall NICHT mehr (kein „verschmolzenes Tor"); Mauern verbinden sich nur mit
   *  Mauern. */
  frontGateRadius: 24,
  frontGateAngle: 0.5,

  /** hero_hall/research_lab flankieren das Front-Tor (u0.28/0.72), vor der Mauer. */
  specialRadius: 15,
  specialAngles: [0.28, 0.72] as number[],

  /** Produktion außerhalb der Mauer an EXPLIZITEN Winkeln: die FRONT (u≈3.7..0.8,
   *  dort stehen Eck-Wertsachen + Held/Labor + Tor) UND die Gerade-hinten-Achse
   *  (u2.5, Rathaus-Schatten) bleiben frei. So verdeckt kein Außen-Gebäude radial
   *  ein Kern-Gebäude, und nichts verschwindet hinter dem Rathaus. */
  productionRadius: 16.5,
  productionAngles: [1.0, 1.6, 2.15, 2.85, 3.4] as number[],
} as const;

// ============================================================================
// PLATZIERUNGS-ENGINE
// ============================================================================

export interface Placement {
  type: string;
  /** Linke-obere Kachel der Grundfläche (= Building.grid_x/grid_y). */
  gx: number;
  gy: number;
  zone: 'core' | 'defense' | 'valuables' | 'production' | 'wall';
}

const { gx: CX, gy: CY } = BALANCE.townHallCenter;

/** Gebäude mit Footprint-ZENTRUM möglichst nah an (cx,cy) einrasten (Origin ganzzahlig). */
function placeCentered(
  type: string,
  cx: number,
  cy: number,
  zone: Placement['zone'],
): Placement {
  const [fw, fh] = footprint(type);
  return { type, gx: Math.round(cx - fw / 2), gy: Math.round(cy - fh / 2), zone };
}

/**
 * Punkt auf einem Manhattan-Diamant (|dx|+|dy|=R) um das Zentrum.
 * u∈[0,4): 0=+x-Ecke, 1=+y, 2=−x, 3=−y. Auf dem Iso-Screen ist der Diamant ein
 * achsenparalleles Rechteck → gleichmäßige u-Verteilung = gleichmäßiger Ring.
 */
function diamondPoint(R: number, u: number): { cx: number; cy: number } {
  const corners = [
    { x: R, y: 0 }, { x: 0, y: R }, { x: -R, y: 0 }, { x: 0, y: -R },
  ];
  const e = ((Math.floor(u) % 4) + 4) % 4;
  const f = u - Math.floor(u);
  const a = corners[e]!;
  const b = corners[(e + 1) % 4]!;
  return { cx: CX + a.x + (b.x - a.x) * f, cy: CY + a.y + (b.y - a.y) * f };
}

/** Roster gleichmäßig um einen Diamant-Ring verteilen (mit Phasenversatz). */
function ring(types: string[], R: number, phase: number, zone: Placement['zone']): Placement[] {
  return types.map((t, i) => {
    const u = (i * 4) / types.length + phase;
    const { cx, cy } = diamondPoint(R, u);
    return placeCentered(t, cx, cy, zone);
  });
}

/** Roster an EXPLIZITE Diamant-Winkel setzen (für gezielte Slots, z.B. Front-Tor). */
function placeAtAngles(types: string[], R: number, us: number[], zone: Placement['zone']): Placement[] {
  return types.map((t, i) => {
    const { cx, cy } = diamondPoint(R, us[i] ?? 0);
    return placeCentered(t, cx, cy, zone);
  });
}

/**
 * Geschlossener, GRID-ACHSENPARALLELER 1×1-Mauerring (Clash-Modell): eine
 * Kachel pro Segment, entlang des Quadrats [CX−H..CX+H] × [CY−H..CY+H]. Auf dem
 * Screen ein Diamant. Jede Kachel ist über ±1 in x/y mit ihren Ring-Nachbarn
 * verbunden (NESW-zusammenhängend) → Grundlage fürs Auto-Connect (Phase 2).
 */
function wallRect(H: number): Placement[] {
  const out: Placement[] = [];
  const lo = CX - H, hi = CX + H;
  const wall = (x: number, y: number): Placement => ({ type: 'wall', gx: x, gy: y, zone: 'wall' });
  for (let x = lo; x <= hi; x++) {
    out.push(wall(x, lo)); // obere Kante (Grid y=lo)
    out.push(wall(x, hi)); // untere Kante (Grid y=hi)
  }
  for (let y = lo + 1; y < hi; y++) {
    out.push(wall(lo, y)); // linke Kante (Grid x=lo)
    out.push(wall(hi, y)); // rechte Kante (Grid x=hi)
  }
  return out;
}

/** Kleinster Chebyshev-Abstand zwischen einem Footprint und der Mauer. */
function minChebToWall(type: string, gx: number, gy: number, walls: Placement[]): number {
  const [fw, fh] = footprint(type);
  let best = Infinity;
  for (let x = gx; x < gx + fw; x++)
    for (let y = gy; y < gy + fh; y++)
      for (const w of walls) {
        const d = Math.max(Math.abs(x - w.gx), Math.abs(y - w.gy));
        if (d < best) best = d;
      }
  return best;
}

/**
 * GENERELLE ABSTANDS-REGEL (Constraint, KEINE Einzelpositionen): schiebt jedes
 * Gebäude so weit vom Mauerring weg, dass zwischen seinem Footprint und der
 * nächsten Mauer-Kachel mindestens `gap` Kacheln Rasen liegen (Chebyshev-Abstand
 * ≥ gap+1). Innen-Gebäude wandern Richtung Zentrum, Außen-Gebäude nach außen —
 * je Schritt die Richtung (Kante ODER Ecke), die den Abstand am stärksten
 * vergrößert. Wirkt für JEDES Layout gleich, damit kein Sprite in die Mauer läuft.
 * Die Mauer selbst bleibt unberührt.
 */
function enforceWallSpacing(buildings: Placement[], walls: Placement[], H: number, gap: number): Placement[] {
  const need = gap + 1;
  return buildings.map((p) => {
    let { gx, gy } = p;
    const [fw, fh] = footprint(p.type);
    for (let iter = 0; iter < 40 && minChebToWall(p.type, gx, gy, walls) < need; iter++) {
      const cx = gx + fw / 2, cy = gy + fh / 2;
      const inside = Math.max(Math.abs(cx - CX), Math.abs(cy - CY)) < H;
      const dir = inside ? -1 : 1; // innen: zum Zentrum, außen: weg vom Zentrum
      const ux = Math.sign(cx - CX) * dir;
      const uy = Math.sign(cy - CY) * dir;
      const cands: Array<[number, number]> = [];
      if (ux) cands.push([ux, 0]);
      if (uy) cands.push([0, uy]);
      if (ux && uy) cands.push([ux, uy]);
      let step: [number, number] | null = null;
      let bestD = minChebToWall(p.type, gx, gy, walls);
      for (const [mx, my] of cands) {
        const nd = minChebToWall(p.type, gx + mx, gy + my, walls);
        if (nd > bestD) { bestD = nd; step = [mx, my]; }
      }
      if (!step) break; // kein verbessernder Schritt → Sicherheitsausstieg
      gx += step[0]; gy += step[1];
    }
    return { ...p, gx, gy };
  });
}

// ============================================================================
// GENERATOR
// ============================================================================

export interface GeneratedLayout {
  townHall: Placement;
  defenders: Placement[];
  valuables: Placement[];
  special: Placement[];
  production: Placement[];
  walls: Placement[];
  /** Alle bebaubaren Gebäude (ohne Mauer) + Mauer getrennt abrufbar. */
  all: Placement[];
}

export function generateEmuclanLayout(): GeneratedLayout {
  const townHall = placeCentered('town_hall', CX, CY, 'core');
  const defenders = ring(BALANCE.defenders, ZONES.defenseRadius, ZONES.defensePhase, 'defense');
  const valuables = placeAtAngles(BALANCE.coreValuables, ZONES.coreRadius, ZONES.coreAngles, 'valuables');
  const frontGate = placeAtAngles(BALANCE.frontGate, ZONES.frontGateRadius, [ZONES.frontGateAngle], 'valuables');
  const special = [
    ...frontGate,
    ...placeAtAngles(BALANCE.special, ZONES.specialRadius, ZONES.specialAngles, 'valuables'),
  ];
  const production = placeAtAngles(BALANCE.production, ZONES.productionRadius, ZONES.productionAngles, 'production');
  const walls = wallRect(BALANCE.wallHalfExtent);

  // GENERELLE ABSTANDS-REGEL anwenden: kein Gebäude grenzt direkt an den Ring —
  // überall ≥ BALANCE.wallSpacing Kacheln Rasen zwischen Footprint und Mauer.
  // Reihenfolge bleibt erhalten → danach in die Gruppen zurück-slicen.
  const spaced = enforceWallSpacing(
    [townHall, ...defenders, ...valuables, ...special, ...production],
    walls, BALANCE.wallHalfExtent, BALANCE.wallSpacing,
  );
  let i = 0;
  const townHall2 = spaced[i++]!;
  const defenders2 = spaced.slice(i, (i += defenders.length));
  const valuables2 = spaced.slice(i, (i += valuables.length));
  const special2 = spaced.slice(i, (i += special.length));
  const production2 = spaced.slice(i, (i += production.length));
  const all = [...spaced, ...walls];
  return {
    townHall: townHall2, defenders: defenders2, valuables: valuables2,
    special: special2, production: production2, walls, all,
  };
}

// ============================================================================
// VERIFIKATION — Abstände nach opaker Sprite-Box (nicht Footprint)
// ============================================================================

/** Tiefe = Zeichenreihenfolge (größer = weiter vorne, wird später gezeichnet). */
function depthOf(p: Placement): number {
  const [fw, fh] = footprint(p.type);
  return p.gx + fw + p.gy + fh;
}

export interface Visibility {
  type: string; gx: number; gy: number; visible: number;
}

/**
 * ABSTANDS-/VERDECKUNGS-PRÜFUNG über die opake Sprite-Box.
 *
 * Bei einer Iso-Ansicht ist bloße Box-Überlappung KEIN Fehler — vorne gezeichnete
 * Gebäude verdecken hintere teilweise (Dächer/Türme überlagern, das ist gewollt).
 * Der echte Qualitätswert ist: „sieht man jedes Gebäude noch?" → welcher Anteil
 * der opaken Silhouette eines Gebäudes bleibt frei von WEITER VORNE gezeichneten
 * Gebäuden. Wird per Raster-Sampling der opaken Box gemessen (Mauer zählt nicht
 * als Verdecker: Mauern vor einem Gebäude sind gewollt und niedrig).
 *
 * Ergebnis: je Gebäude der sichtbare Anteil (0..1); ok, wenn alle ≥ MIN_VISIBLE.
 */
export function computeVisibility(placements: Placement[]): Visibility[] {
  const items = placements
    .map((p) => ({ p, box: spriteScreenBox(p.type, p.gx, p.gy), depth: depthOf(p) }))
    .sort((a, b) => a.depth - b.depth);
  const inside = (b: ScreenBox, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

  return items.map((it, i) => {
    const b = it.box;
    const NX = 24, NY = 24;
    let free = 0, total = 0;
    for (let sx = 0; sx < NX; sx++) {
      for (let sy = 0; sy < NY; sy++) {
        const x = b.x0 + ((sx + 0.5) / NX) * (b.x1 - b.x0);
        const y = b.y0 + ((sy + 0.5) / NY) * (b.y1 - b.y0);
        total++;
        let covered = false;
        for (let j = i + 1; j < items.length; j++) {
          if (items[j]!.p.zone === 'wall') continue; // Mauer verdeckt gewollt
          if (inside(items[j]!.box, x, y)) { covered = true; break; }
        }
        if (!covered) free++;
      }
    }
    return { type: it.p.type, gx: it.p.gx, gy: it.p.gy, visible: free / total };
  });
}

/**
 * Prüfergebnis: sind alle BEBAUBAREN Gebäude (ohne Mauer) hinreichend sichtbar?
 * Rückgabe enthält die schwächsten Gebäude für den Report.
 */
export function verifySpacing(placements: Placement[]): {
  ok: boolean;
  worst: Visibility[];
  minVisible: number;
} {
  const vis = computeVisibility(placements);
  const buildings = vis.filter((p) => p.type !== 'wall').sort((a, b) => a.visible - b.visible);
  const minVisible = buildings.length ? buildings[0]!.visible : 1;
  return { ok: minVisible >= MIN_VISIBLE, worst: buildings.slice(0, 6), minVisible };
}

/**
 * Mindest-Sichtbarkeitsanteil je bebaubarem Gebäude (opake Box, ohne Mauer-
 * Verdeckung). 0.4: Ziel ist ~50 %+; die eine Ausnahme ist das Front-Lager, das
 * bewusst zur Hälfte hinter dem Tor-Trio (clan_castle/hero_hall) hervorschaut —
 * eine gewollte, gut lesbare Staffelung am Tor (kein verstecktes Gebäude).
 */
export const MIN_VISIBLE = 0.4;

/**
 * MECHANISCHE Footprint-Kollision: Gebäude dürfen sich KEINE Kacheln teilen
 * (Spiellogik — assertTileFree). Anders als die opake-Box-Sichtbarkeit ist das
 * eine harte Regel. Prüft alle Paare (inkl. Mauer) auf Grundflächen-Überlappung.
 */
export function footprintOverlaps(placements: Placement[]): Array<{ a: string; b: string }> {
  const rects = placements.map((p) => {
    const [fw, fh] = footprint(p.type);
    return { p, x0: p.gx, y0: p.gy, x1: p.gx + fw, y1: p.gy + fh };
  });
  const hits: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
        hits.push({ a: `${a.p.type}(${a.p.gx},${a.p.gy})`, b: `${b.p.type}(${b.p.gx},${b.p.gy})` });
      }
    }
  }
  return hits;
}

// ============================================================================
// REICHWEITEN-ABDECKUNG — kein totes Feld im Kern/an der Mauer
// ============================================================================

/**
 * Zahl der Verteidiger, in deren Reichweite die Kachel (gx,gy) liegt.
 * Feuerpunkt EXAKT wie die Engine (game/combat.ts): ein Verteidigungsgebäude
 * feuert vom URSPRUNGS-Kachelzentrum (gx+0.5, gy+0.5) — NICHT vom Footprint-
 * Zentrum — und trifft eine Einheit in Reichweite + 0.5 (nearestInList-Toleranz).
 * So misst die Deckung die ECHTE Reichweite statt einer idealisierten.
 */
export function coveredBy(defenders: Placement[], gx: number, gy: number): number {
  let n = 0;
  for (const d of defenders) {
    const r = DEFENSE_RANGE_TILES[d.type] ?? 0;
    // (gx+0.5)-(d.gx+0.5) = gx-d.gx
    if (Math.hypot(gx - d.gx, gy - d.gy) <= r + 0.5) n++;
  }
  return n;
}

/** Vorfeld-Tiefe (Kacheln AUSSERHALB der Mauer), die die Verteidigung decken soll. */
export const FOREFIELD_DEPTH = 4;

/**
 * REICHWEITEN-DECKUNG der VERTEIDIGUNGS-Zielzone: MAUERLINIE + VORFELD DAVOR —
 * NICHT der leere Kern. Genau dort greift der Angreifer an und muss beschossen
 * werden; dort sollen sich die Reichweiten überlappen. (Die frühere Version maß
 * den Kern-Innenraum — die falsche Zone: der Kern war gedeckt, das Vorfeld nicht.)
 *
 * - wallCovered/wallTotal : Mauer-Kacheln in Reichweite ≥1 Verteidiger.
 * - wallOverlap           : Mauer-Kacheln in Reichweite ≥2 (Überlappung an der Linie).
 * - ffCovered/ffTotal     : Vorfeld-Band Chebyshev (H+1 .. H+FOREFIELD_DEPTH) in Reichweite ≥1.
 */
export function coverageReport(layout: GeneratedLayout): {
  wallTotal: number; wallCovered: number; wallOverlap: number;
  ffTotal: number; ffCovered: number;
} {
  const H = BALANCE.wallHalfExtent;
  let wallCovered = 0, wallOverlap = 0;
  for (const w of layout.walls) {
    const m = coveredBy(layout.defenders, w.gx, w.gy);
    if (m >= 1) wallCovered++;
    if (m >= 2) wallOverlap++;
  }
  let ffTotal = 0, ffCovered = 0;
  const F = FOREFIELD_DEPTH;
  for (let gx = CX - H - F; gx <= CX + H + F; gx++) {
    for (let gy = CY - H - F; gy <= CY + H + F; gy++) {
      const cheb = Math.max(Math.abs(gx - CX), Math.abs(gy - CY));
      if (cheb <= H || cheb > H + F) continue; // nur das Band AUSSERHALB der Mauer
      ffTotal++;
      if (coveredBy(layout.defenders, gx, gy) >= 1) ffCovered++;
    }
  }
  return { wallTotal: layout.walls.length, wallCovered, wallOverlap, ffTotal, ffCovered };
}

/**
 * NESW-Zusammenhang der Mauer: jede Mauer-Kachel muss ≥2 orthogonale
 * (±1 in x/y) Mauer-Nachbarn haben → geschlossener Ring ohne isolierte Stücke.
 * Das ist die harte Voraussetzung fürs Auto-Connect (Phase 2). Gibt die Zahl
 * der Mauern mit <2 Nachbarn zurück (0 = sauber geschlossen).
 */
export function wallContiguityReport(walls: Placement[]): { open: number; total: number } {
  const set = new Set(walls.map((w) => `${w.gx},${w.gy}`));
  let open = 0;
  for (const w of walls) {
    let n = 0;
    if (set.has(`${w.gx + 1},${w.gy}`)) n++;
    if (set.has(`${w.gx - 1},${w.gy}`)) n++;
    if (set.has(`${w.gx},${w.gy + 1}`)) n++;
    if (set.has(`${w.gx},${w.gy - 1}`)) n++;
    if (n < 2) open++;
  }
  return { open, total: walls.length };
}

// --- CLI-Report -------------------------------------------------------------
if (require.main === module) {
  const layout = generateEmuclanLayout();
  const list = (ps: Placement[]) => ps.map((p) => `${p.type}(${p.gx},${p.gy})`).join('  ');
  console.log('== EMUCLAN-REFERENZ-LAYOUT ==\n');
  console.log('Rathaus     :', list([layout.townHall]));
  console.log('Verteidigung:', list(layout.defenders));
  console.log('Wertsachen  :', list(layout.valuables));
  console.log('Held/Labor  :', list(layout.special));
  console.log('Produktion  :', list(layout.production));
  console.log(`Mauer       : ${layout.walls.length} 1×1-Segmente (Grid-Rechteck, Halbausdehnung ${BALANCE.wallHalfExtent} → Screen-Diamant)\n`);

  // Sichtbarkeit: NUR bebaubare Gebäude sind kritisch. Mauer-Segmente hinter dem
  // Kern dürfen verdeckt sein (man sieht die Vorderfront) — separat ausgewiesen.
  const allVis = computeVisibility(layout.all);
  const v = verifySpacing(layout.all);
  console.log(`SICHTBARKEIT (opake Box): min. Gebäude = ${(v.minVisible * 100).toFixed(0)} %  → ${v.ok ? 'OK' : 'ZU VERDECKT'} (Schwelle ${(MIN_VISIBLE * 100).toFixed(0)} %)`);
  console.log('  Am stärksten verdeckte Gebäude (ohne Mauer):');
  for (const p of v.worst) {
    console.log(`   ${p.type.padEnd(15)} (${p.gx},${p.gy})  sichtbar ${(p.visible * 100).toFixed(0)} %`);
  }
  const hiddenWalls = allVis.filter((p) => p.type === 'wall' && p.visible < 0.15).length;
  console.log(`  (Mauer: ${hiddenWalls}/${layout.walls.length} Segmente überwiegend hinter dem Kern — gewollt, Vorderfront sichtbar)`);

  const overlaps = footprintOverlaps(layout.all);
  console.log(`\nFOOTPRINT-KOLLISION (Spiellogik, harte Regel): ${overlaps.length === 0 ? '✓ keine (kein Gebäude teilt Kacheln)' : `⚠ ${overlaps.length}`}`);
  for (const o of overlaps.slice(0, 8)) console.log(`   ${o.a} ⨯ ${o.b}`);

  const wc = wallContiguityReport(layout.walls);
  console.log(`\nMAUER-ZUSAMMENHANG (NESW, Voraussetzung Auto-Connect): ${wc.open === 0 ? `✓ geschlossen (alle ${wc.total} Segmente ≥2 Nachbarn)` : `⚠ ${wc.open}/${wc.total} Segmente mit <2 Nachbarn`}`);

  const cov = coverageReport(layout);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 100);
  console.log('\nREICHWEITEN-DECKUNG (Zielzone = MAUERLINIE + VORFELD davor, nicht Kern):');
  console.log(`  Mauerlinie : ${cov.wallCovered}/${cov.wallTotal} (${pct(cov.wallCovered, cov.wallTotal)} %) in Reichweite · ${cov.wallOverlap} mit Überlappung (≥2 Türme)`);
  console.log(`  Vorfeld    : ${cov.ffCovered}/${cov.ffTotal} (${pct(cov.ffCovered, cov.ffTotal)} %) des Bandes (${FOREFIELD_DEPTH} Kacheln vor der Mauer) in Reichweite`);
}
