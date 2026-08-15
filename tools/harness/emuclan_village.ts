/**
 * BELEG-RENDER fürs EMUCLAN-REFERENZ-LAYOUT (S5).
 *
 * Zeichnet den Generator-Output (tools/layout/emuclanLayout.ts) exakt wie der
 * echte Dorf-Renderer (VillageCanvas): Fußpunkt-Anker am Footprint-ZENTRUM,
 * Größe = buildingDisplayWidth × buildingDisplayScale, Tiefensortierung nach
 * (gx+fw)+(gy+fh). KEINE duplizierten Maßstabs-/Anker-Zahlen — alles aus
 * @village-wars/shared + manifest.json + spriteContentBox.ts.
 *
 *   npx tsx tools/harness/emuclan_village.ts overview [vNN]
 *   npx tsx tools/harness/emuclan_village.ts ranges   [vNN]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  gridToScreen, buildingDisplayWidth, buildingDisplayScale, TILE_WIDTH, TILE_HEIGHT,
  wallConnectionAt, wallPredicate, type WallConnection,
} from '@village-wars/shared';
import { makeHarness } from './lib';
import {
  generateEmuclanLayout,
  BALANCE,
  DEFENSE_RANGE_TILES,
  type Placement,
} from '../layout/emuclanLayout';
import { footprint, anchor, spriteScreenBox } from '../layout/spriteMetrics';

const MODE = process.argv[2] ?? 'overview';
const VERSION = process.argv[3] ?? 'v01';

const ASSETS = path.resolve(__dirname, '..', '..', 'apps', 'mobile', 'src', 'assets', 'factions', 'humans');

function imgPath(type: string): string {
  return path.join(ASSETS, 'buildings', `${type}.png`);
}

/**
 * Test-Mauer-Layout (nur MODE 'wallconnect'): bewusst ALLE Verbindungstypen —
 * gerade Linie mit T-Abzweig + zwei Enden, eine L-Ecke, eine Kreuzung, ein
 * isoliertes Stück. Zeigt, dass die Auto-Connect-Logik jeden Fall korrekt
 * zusammensetzt (rein aus der Nachbarschaft, optik-unabhängig).
 */
const TEST_WALLS: Array<{ grid_x: number; grid_y: number }> = [
  // Waagerechte Linie (5..9,8) mit T-Abzweig runter bei x=7 und zwei Enden.
  { grid_x: 5, grid_y: 8 }, { grid_x: 6, grid_y: 8 }, { grid_x: 7, grid_y: 8 },
  { grid_x: 8, grid_y: 8 }, { grid_x: 9, grid_y: 8 },
  { grid_x: 7, grid_y: 9 }, { grid_x: 7, grid_y: 10 },
  // L-Ecke: (13..15,8) waagerecht → runter (15,9),(15,10).
  { grid_x: 13, grid_y: 8 }, { grid_x: 14, grid_y: 8 }, { grid_x: 15, grid_y: 8 },
  { grid_x: 15, grid_y: 9 }, { grid_x: 15, grid_y: 10 },
  // Kreuzung bei (11,14).
  { grid_x: 11, grid_y: 14 }, { grid_x: 10, grid_y: 14 }, { grid_x: 12, grid_y: 14 },
  { grid_x: 11, grid_y: 13 }, { grid_x: 11, grid_y: 15 },
  // Isoliertes Stück.
  { grid_x: 18, grid_y: 12 },
];

async function main(): Promise<void> {
  const layout = generateEmuclanLayout();
  const CX = BALANCE.townHallCenter.gx, CY = BALANCE.townHallCenter.gy;

  // --- Kamera-Bounds je nach Modus ---
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (MODE === 'wallconnect') {
    for (const w of TEST_WALLS) {
      const c = gridToScreen(w.grid_x + 0.5, w.grid_y + 0.5);
      minX = Math.min(minX, c.x - 44); maxX = Math.max(maxX, c.x + 44);
      minY = Math.min(minY, c.y - 60); maxY = Math.max(maxY, c.y + 30);
    }
  } else {
    // gesamte opake Sprite-Box aller Gebäude fassen (wie App-Clamp)
    for (const p of layout.all) {
      const b = spriteScreenBox(p.type, p.gx, p.gy);
      minX = Math.min(minX, b.x0); maxX = Math.max(maxX, b.x1);
      minY = Math.min(minY, b.y0); maxY = Math.max(maxY, b.y1);
    }
  }
  const PAD = 70;
  const W = Math.ceil(maxX - minX) + PAD * 2;
  const H = Math.ceil(maxY - minY) + PAD * 2 + 60; // +60 für Kopfzeile
  const ORIGIN = { x: PAD - minX, y: PAD - minY + 50 };

  const h = await makeHarness(W, H, '#4d7a3a');
  const { CK, canvas } = h;

  // Grasraster nur im relevanten Bereich.
  h.isoGrid(ORIGIN.x, ORIGIN.y, 44, 44);

  // --- Zonen-Hinterlegung (Diamant-Flächen) --------------------------------
  const diamond = (R: number): [number, number][] =>
    [[R, 0], [0, R], [-R, 0], [0, -R]].map(([dx, dy]) => {
      const s = gridToScreen(CX + dx, CY + dy);
      return [ORIGIN.x + s.x, ORIGIN.y + s.y];
    });
  const fillDiamond = (R: number, color: number[]) => {
    const pts = diamond(R);
    const p = new CK.Path();
    p.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < 4; i++) p.lineTo(pts[i]![0], pts[i]![1]);
    p.close();
    const pt = new CK.Paint();
    pt.setAntiAlias(true);
    pt.setColor(CK.Color(color[0]!, color[1]!, color[2]!, color[3]!));
    canvas.drawPath(p, pt);
    p.delete(); pt.delete();
  };
  void fillDiamond;
  // Kern-Fläche INNERHALB des Mauer-Rechtecks (Grid-Quadrat → Screen-Diamant).
  const WH = BALANCE.wallHalfExtent;
  const fillRect = (half: number, color: number[]) => {
    const corners: [number, number][] = [
      [CX - half, CY - half], [CX + half, CY - half],
      [CX + half, CY + half], [CX - half, CY + half],
    ].map(([gx, gy]) => {
      const s = gridToScreen(gx, gy);
      return [ORIGIN.x + s.x, ORIGIN.y + s.y];
    });
    const p = new CK.Path();
    p.moveTo(corners[0]![0], corners[0]![1]);
    for (let i = 1; i < 4; i++) p.lineTo(corners[i]![0], corners[i]![1]);
    p.close();
    const pt = new CK.Paint();
    pt.setAntiAlias(true);
    pt.setColor(CK.Color(color[0]!, color[1]!, color[2]!, color[3]!));
    canvas.drawPath(p, pt);
    p.delete(); pt.delete();
  };
  fillRect(WH, [255, 236, 170, 0.10]);

  // Eine 1×1-Grid-Kachel als Iso-Diamant füllen (für die Mauer-Kette in Phase 1).
  const drawTile = (gx: number, gy: number, color: number[], stroke = false) => {
    const c = gridToScreen(gx + 0.5, gy + 0.5);
    const cx = ORIGIN.x + c.x, cy = ORIGIN.y + c.y;
    const p = new CK.Path();
    p.moveTo(cx, cy - TILE_HEIGHT / 2);
    p.lineTo(cx + TILE_WIDTH / 2, cy);
    p.lineTo(cx, cy + TILE_HEIGHT / 2);
    p.lineTo(cx - TILE_WIDTH / 2, cy);
    p.close();
    const pt = new CK.Paint();
    pt.setAntiAlias(true);
    pt.setColor(CK.Color(color[0]!, color[1]!, color[2]!, color[3] ?? 1));
    pt.setStyle(stroke ? CK.PaintStyle.Stroke : CK.PaintStyle.Fill);
    if (stroke) pt.setStrokeWidth(2);
    canvas.drawPath(p, pt);
    p.delete(); pt.delete();
  };

  // Ein niedriger Iso-Steinblock (Top + linke/rechte Wand) um einen Screen-Punkt.
  const quad = (pts: [number, number][], rgb: number[]) => {
    const p = new CK.Path();
    p.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]![0], pts[i]![1]);
    p.close();
    const pt = new CK.Paint();
    pt.setAntiAlias(true);
    pt.setColor(CK.Color(rgb[0]!, rgb[1]!, rgb[2]!, rgb[3] ?? 1));
    canvas.drawPath(p, pt);
    p.delete(); pt.delete();
  };
  const isoBlock = (cx: number, cy: number, hw: number, hh: number, hgt: number, base: number[]) => {
    const top: [number, number][] = [[cx, cy - hh - hgt], [cx + hw, cy - hgt], [cx, cy + hh - hgt], [cx - hw, cy - hgt]];
    const left: [number, number][] = [[cx - hw, cy - hgt], [cx, cy + hh - hgt], [cx, cy + hh], [cx - hw, cy]];
    const right: [number, number][] = [[cx, cy + hh - hgt], [cx + hw, cy - hgt], [cx + hw, cy], [cx, cy + hh]];
    const lt = (f: number) => base.map((v, i) => (i < 3 ? Math.min(255, v + f) : v));
    const dk = (f: number) => base.map((v, i) => (i < 3 ? Math.max(0, v - f) : v));
    quad(left, dk(35));
    quad(right, dk(60));
    quad(top, lt(25));
  };

  /**
   * Prozedurale VERBUNDENE Mauer (Phase 2 — NICHT der Endstand): zentraler Block
   * + je ein Arm-Block zur Kachel-Kante Richtung jeder verbundenen Seite. Die
   * Verbindung kommt ALLEIN aus der Shared-Logik (conn.n/e/s/w) — so lesen sich
   * gerade/Ecke/T/Kreuz/Ende/isoliert korrekt zusammen.
   */
  const STONE = [150, 145, 125];
  const drawWallConnected = (gx: number, gy: number, conn: WallConnection) => {
    const c = gridToScreen(gx + 0.5, gy + 0.5);
    const cx = ORIGIN.x + c.x, cy = ORIGIN.y + c.y;
    // Arm-Block zur Kanten-Mitte je verbundener Richtung (halbe Kachel).
    // Arme reichen bis zur Kanten-Mitte; Blockbreite ≈ halbe Kachel, damit sie
    // den Nachbar-Arm überlappen (nahtlose Linie, keine Lücke).
    if (conn.n) { const e = gridToScreen(gx + 0.5, gy); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.e) { const e = gridToScreen(gx + 1, gy + 0.5); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.s) { const e = gridToScreen(gx + 0.5, gy + 1); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.w) { const e = gridToScreen(gx, gy + 0.5); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    // Zentraler Block zuletzt (etwas höher/größer → Ecke/Kreuzung sauber).
    isoBlock(cx, cy, 18, 9, 20, [168, 163, 143]);
  };

  // --- Sprite-Zeichnung (exakt wie buildingSprite.tsx BILD-Pfad) -----------
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  const drawBuilding = (p: Placement) => {
    const im = h.img('buildings', p.type);
    const iw = im.width(), ih = im.height();
    const dispW = buildingDisplayWidth(iw) * buildingDisplayScale(p.type);
    const dispH = dispW * (ih / iw);
    const [ax, ay] = anchor(p.type);
    const [fw, fh] = footprint(p.type);
    const s = gridToScreen(p.gx + fw / 2, p.gy + fh / 2);
    const cx = ORIGIN.x + s.x, cy = ORIGIN.y + s.y;
    canvas.drawImageRectOptions(
      im,
      CK.XYWHRect(0, 0, iw, ih),
      CK.XYWHRect(cx - ax * dispW, cy - ay * dispH, dispW, dispH),
      CK.FilterMode.Linear, CK.MipmapMode.Linear, paint,
    );
  };

  const depth = (p: Placement) => {
    const [fw, fh] = footprint(p.type);
    return p.gx + fw + p.gy + fh;
  };

  if (MODE === 'wallconnect') {
    // Auto-Connect-BELEG (Phase 2): prozeduraler Vektor je Verbindungstyp, allein
    // durch die Shared-Logik gesteuert (isWall-Prädikat → classifyWall).
    const isWall = wallPredicate(TEST_WALLS);
    const sorted = [...TEST_WALLS].sort((a, b) => (a.grid_x + a.grid_y) - (b.grid_x + b.grid_y));
    const labels: Array<{ gx: number; gy: number; t: string }> = [];
    for (const w of sorted) {
      const conn = wallConnectionAt(isWall, w.grid_x, w.grid_y);
      drawWallConnected(w.grid_x, w.grid_y, conn);
      if (['corner', 't', 'cross', 'end', 'isolated'].includes(conn.type)) {
        const label = { corner: 'Ecke', t: 'T-Stück', cross: 'Kreuzung', end: 'Ende', isolated: 'isoliert' }[conn.type]!;
        labels.push({ gx: w.grid_x, gy: w.grid_y, t: label });
      }
    }
    // Labels über den markanten Stücken.
    for (const l of labels) {
      const c = gridToScreen(l.gx + 0.5, l.gy + 0.5);
      h.text(l.t, ORIGIN.x + c.x - l.t.length * 4, ORIGIN.y + c.y - 34, 15, '#0d1a08');
    }
    h.text('EMUCLAN Phase 2 — Auto-Connect (prozeduraler Vektor, NICHT der Endstand)', 24, 40, 24, '#0d1a08');
    h.text('Verbindung allein aus der Nachbarschaft (shared/wallConnect): gerade · Ecke · T · Kreuzung · Ende · isoliert', 24, 66, 16, '#16290f');
    const out = h.save(`emuclan_wallconnect_${VERSION}.png`);
    console.log('WROTE', out);
    return;
  }

  if (MODE === 'ranges') {
    // Volle Basis als Kontext (inkl. Produktion/Vorfeld), dann Reichweiten-Ellipsen —
    // so sieht man, dass die Reichweiten die MAUERLINIE + das Vorfeld davor decken.
    const isWallR = wallPredicate(layout.walls.map((w) => ({ grid_x: w.gx, grid_y: w.gy })));
    const context = [...layout.all].sort((a, b) => depth(a) - depth(b));
    for (const p of context) {
      if (p.zone === 'wall') drawWallConnected(p.gx, p.gy, wallConnectionAt(isWallR, p.gx, p.gy));
      else drawBuilding(p);
    }

    // Reichweite = Iso-Projektion eines Kreises → Ellipse. Feuerpunkt + Radius
    // EXAKT wie die Engine (game/combat.ts) / coveredBy: Ursprungs-Kachelzentrum
    // (gx+0.5,gy+0.5), Reichweite + 0.5 (nearestInList-Toleranz). Überlappende
    // Füllungen zeigen die Deckung ohne totes Feld an der Mauerlinie.
    const colors: Record<string, number[]> = {
      watchtower: [90, 190, 255], // blau
      cannon: [255, 150, 70],     // orange
    };
    for (const d of layout.defenders) {
      const dcx = d.gx + 0.5, dcy = d.gy + 0.5;
      const r = (DEFENSE_RANGE_TILES[d.type] ?? 0) + 0.5;
      const col = colors[d.type] ?? [255, 255, 255];
      const path = new CK.Path();
      const N = 96;
      for (let k = 0; k <= N; k++) {
        const a = (2 * Math.PI * k) / N;
        const s = gridToScreen(dcx + r * Math.cos(a), dcy + r * Math.sin(a));
        const x = ORIGIN.x + s.x, y = ORIGIN.y + s.y;
        if (k === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.close();
      const fillP = new CK.Paint();
      fillP.setAntiAlias(true);
      fillP.setColor(CK.Color(col[0]!, col[1]!, col[2]!, 0.16));
      canvas.drawPath(path, fillP);
      const strokeP = new CK.Paint();
      strokeP.setAntiAlias(true);
      strokeP.setStyle(CK.PaintStyle.Stroke);
      strokeP.setStrokeWidth(2.5);
      strokeP.setColor(CK.Color(col[0]!, col[1]!, col[2]!, 0.9));
      canvas.drawPath(path, strokeP);
      path.delete(); fillP.delete(); strokeP.delete();
    }

    h.text('EMUCLAN — Verteidigung an den MAUER-ECKEN: Reichweiten decken Mauerlinie + Vorfeld DAVOR (nicht mehr nur den Kern)', 24, 40, 21, '#0d1a08');
    h.text(`Wachturm ${DEFENSE_RANGE_TILES.watchtower} Kacheln (blau) · Kanone ${DEFENSE_RANGE_TILES.cannon} (orange) · Feuerpunkt+Reichweite wie combat.ts · Mauerlinie 100% gedeckt`, 24, 66, 15, '#16290f');
    const out = h.save(`emuclan_ranges_${VERSION}.png`);
    console.log('WROTE', out);
    return;
  }

  // MODE overview (Phase 2): Mauern connection-aware (Auto-Connect) auf dem echten
  // emuclan-Ring, tiefensortiert mit den Gebäuden. Mauer-Optik = prozeduraler
  // Vektor (wie WallSprite in der App), NICHT der Endstand.
  void drawTile;
  const isWall = wallPredicate(layout.walls.map((w) => ({ grid_x: w.gx, grid_y: w.gy })));
  for (const p of [...layout.all].sort((a, b) => depth(a) - depth(b))) {
    if (p.zone === 'wall') drawWallConnected(p.gx, p.gy, wallConnectionAt(isWall, p.gx, p.gy));
    else drawBuilding(p);
  }

  h.text('EMUCLAN Phase 2 — geschlossener Ring mit Auto-Connect (gerade/Ecke), prozedural (NICHT der Endstand)', 24, 40, 24, '#0d1a08');
  h.text(`${layout.walls.length} 1×1-Mauern · Verbindung aus der Nachbarschaft (shared/wallConnect) · Optik-Sprites folgen in Phase 3`, 24, 66, 16, '#16290f');
  const out = h.save(`emuclan_overview_${VERSION}.png`);
  console.log('WROTE', out);
}

void main();
