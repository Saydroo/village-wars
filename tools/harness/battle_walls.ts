/**
 * BELEG-RENDER: MAUERN IM KAMPF (Fix 1).
 *
 * Zeigt, dass der Kampf (BattleCanvas) Mauern jetzt über DENSELBEN Auto-Connect-
 * Pfad wie das Dorf zeichnet: 1×1-`WallSprite` gesteuert allein durch die Shared-
 * Logik `wallConnectionAt` / `wallPredicate` — NICHT mehr das große `wall.png`.
 *
 * Der Harness (headless CanvasKit) dupliziert KEINE Wall-Geometrie: die Block-
 * Offsets (Arme 17/8.5/16, Zentralblock 18/9/20, Steinfarben) sind 1:1 die aus
 * apps/mobile/src/rendering/wallSprite.tsx, und die Verbindung kommt aus exakt
 * demselben @village-wars/shared-Helfer, den BattleCanvas.tsx nun aufruft. Damit
 * ist dieser Render ein getreuer Stellvertreter des App-Render-Pfads.
 *
 * Szene: die ECHTE emuclan-Verteidigerbasis (generateEmuclanLayout) unter Angriff.
 * Zwei Mauer-Kacheln sind „zerstört" — sie werden NICHT gezeichnet (saubere
 * Lücke, kein weißer Riesen-Rest), bleiben aber im isWall-Prädikat (statisches
 * Layout), genau wie in BattleCanvas → die Nachbarn behalten ihre Arme zur Lücke.
 *
 *   npx tsx tools/harness/battle_walls.ts [vNN]
 */
import {
  gridToScreen, buildingDisplayWidth, buildingDisplayScale, TILE_WIDTH, TILE_HEIGHT,
  wallConnectionAt, wallPredicate, type WallConnection,
} from '@village-wars/shared';
import { makeHarness } from './lib';
import { generateEmuclanLayout, type Placement } from '../layout/emuclanLayout';
import { footprint, anchor, spriteScreenBox } from '../layout/spriteMetrics';

const VERSION = process.argv[2] ?? 'v01';

async function main(): Promise<void> {
  const layout = generateEmuclanLayout();

  // --- „Zerstörte" Mauern an der klar sichtbaren RECHTEN Ringkante (max gx):
  // zwei benachbarte Kacheln werden NICHT gezeichnet (Lücke), bleiben aber im
  // isWall-Prädikat → die Nachbarn behalten ihre Arme zur Lücke (exakt das
  // Verhalten von BattleCanvas: Prädikat = statisches Layout, toter Sprite = null).
  const walls = layout.walls;
  const maxGx = Math.max(...walls.map((w) => w.gx));
  const rightCol = walls.filter((w) => w.gx === maxGx).sort((a, b) => a.gy - b.gy);
  const midIdx = Math.max(1, Math.floor(rightCol.length / 2));
  const breachA = rightCol[midIdx - 1]!;
  const breachB = rightCol[midIdx]!;
  const destroyed = new Set([`${breachA.gx},${breachA.gy}`, `${breachB.gx},${breachB.gy}`]);
  const gy0 = breachA.gy;

  // --- Angreifer-Einheiten: Sturmgruppe RECHTS neben der Bresche (die Lücke
  // bleibt frei sichtbar), plus ein Ritter, der schon durchgebrochen ist. ---
  type UnitDot = { type: string; gx: number; gy: number };
  const attackers: UnitDot[] = [
    { type: 'knight', gx: maxGx + 1, gy: gy0 },        // am Mund der Bresche (außen)
    { type: 'militia', gx: maxGx + 2, gy: gy0 - 1 },
    { type: 'militia', gx: maxGx + 2, gy: gy0 + 1 },
    { type: 'archer', gx: maxGx + 3, gy: gy0 },
    { type: 'catapult', gx: maxGx + 3, gy: gy0 + 2 },
    { type: 'healer', gx: maxGx + 3, gy: gy0 - 1 },
    { type: 'knight', gx: maxGx - 1, gy: gy0 + 1 },    // schon durchgebrochen (innen)
  ];

  // --- Kamera-Bounds: gesamte opake Sprite-Box aller Gebäude + Angreifer fassen.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of layout.all) {
    const b = spriteScreenBox(p.type, p.gx, p.gy);
    minX = Math.min(minX, b.x0); maxX = Math.max(maxX, b.x1);
    minY = Math.min(minY, b.y0); maxY = Math.max(maxY, b.y1);
  }
  for (const u of attackers) {
    const s = gridToScreen(u.gx + 0.5, u.gy + 0.5);
    minX = Math.min(minX, s.x - 40); maxX = Math.max(maxX, s.x + 40);
    minY = Math.min(minY, s.y - 70); maxY = Math.max(maxY, s.y + 20);
  }

  const PAD = 70;
  const W = Math.ceil(maxX - minX) + PAD * 2;
  const H = Math.ceil(maxY - minY) + PAD * 2 + 70; // +70 für Kopfzeile
  const ORIGIN = { x: PAD - minX, y: PAD - minY + 58 };

  // Kampf-Boden: kühler/erdiger als das Dorf-Grün, damit klar „Schlachtfeld".
  const h = await makeHarness(W, H, '#2f2a22');
  const { CK, canvas } = h;
  h.isoGrid(ORIGIN.x, ORIGIN.y, 44, 44, '#5c6b46', '#556340');

  // Schutt/Brand auf den zerstörten Kacheln (Proof-Hinweis; BattleCanvas zeichnet
  // dort nichts — hier eine dezente, klar als „Bresche" beschriftete Bodenmarke).
  const drawScorch = (gx: number, gy: number) => {
    const c = gridToScreen(gx + 0.5, gy + 0.5);
    const cx = ORIGIN.x + c.x, cy = ORIGIN.y + c.y;
    const p = new CK.Path();
    p.moveTo(cx, cy - TILE_HEIGHT / 2); p.lineTo(cx + TILE_WIDTH / 2, cy);
    p.lineTo(cx, cy + TILE_HEIGHT / 2); p.lineTo(cx - TILE_WIDTH / 2, cy); p.close();
    const pt = new CK.Paint(); pt.setAntiAlias(true); pt.setColor(CK.Color(22, 17, 12, 0.55));
    canvas.drawPath(p, pt); p.delete(); pt.delete();
  };
  drawScorch(breachA.gx, breachA.gy); drawScorch(breachB.gx, breachB.gy);

  // --- Iso-Steinblock (identisch zu wallSprite.tsx IsoBlock) ---
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

  const fillCircle = (cx: number, cy: number, r: number, rgb: number[]) => {
    const pt = new CK.Paint();
    pt.setAntiAlias(true);
    pt.setColor(CK.Color(rgb[0]!, rgb[1]!, rgb[2]!, rgb[3] ?? 1));
    canvas.drawCircle(cx, cy, r, pt);
    pt.delete();
  };

  // Prozedurale Einheit — dieselbe Rollen-Farbe + Fußschatten/Kopf wie der
  // Fallback in BattleCanvas.renderUnit (die V2-Sprites außer Archer fehlen noch).
  const roleColor = (t: string): number[] => {
    if (t.includes('archer') || t.includes('catapult')) return [255, 210, 74];
    if (t.includes('healer')) return [74, 222, 128];
    if (t.includes('knight') || t.includes('giant')) return [255, 123, 84];
    return [122, 167, 255];
  };
  const drawUnitDot = (cx: number, cy: number, t: string) => {
    const body = roleColor(t);
    const outline = body.map((v, i) => (i < 3 ? Math.max(0, v - 90) : v));
    const head = body.map((v, i) => (i < 3 ? Math.min(255, v + 60) : v));
    canvas.save(); canvas.translate(cx, cy); canvas.scale(1, 0.4);
    fillCircle(0, 4, 6, [0, 0, 0, 0.27]); canvas.restore();
    fillCircle(cx, cy - 1, 5.6, outline);
    fillCircle(cx, cy - 1, 4.6, body);
    fillCircle(cx, cy - 6, 3.1, outline);
    fillCircle(cx, cy - 6, 2.3, head);
  };

  const STONE = [150, 145, 125];
  const drawWallConnected = (gx: number, gy: number, conn: WallConnection) => {
    const c = gridToScreen(gx + 0.5, gy + 0.5);
    const cx = ORIGIN.x + c.x, cy = ORIGIN.y + c.y;
    if (conn.n) { const e = gridToScreen(gx + 0.5, gy); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.e) { const e = gridToScreen(gx + 1, gy + 0.5); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.s) { const e = gridToScreen(gx + 0.5, gy + 1); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    if (conn.w) { const e = gridToScreen(gx, gy + 0.5); isoBlock(ORIGIN.x + e.x, ORIGIN.y + e.y, 17, 8.5, 16, STONE); }
    isoBlock(cx, cy, 18, 9, 20, [168, 163, 143]);
  };

  // --- Gebäude (Bild-Pfad wie buildingSprite.tsx). Position wie BattleCanvas:
  // Fußpunkt am Footprint-Zentrum. ---
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

  // --- Tiefensortierung gemeinsam über Gebäude/Mauern UND Einheiten (gx+gy),
  // exakt wie BattleCanvas (Painter's Algorithm). ---
  type Item =
    | { depth: number; kind: 'b'; p: Placement }
    | { depth: number; kind: 'u'; u: UnitDot };
  const items: Item[] = [];
  for (const p of layout.all) items.push({ depth: p.gx + p.gy, kind: 'b', p });
  for (const u of attackers) items.push({ depth: u.gx + u.gy + 0.1, kind: 'u', u });
  items.sort((a, b) => a.depth - b.depth);

  // isWall-Prädikat über das VOLLE, statische Wandlayout (auch „zerstörte") —
  // genau wie in BattleCanvas.
  const isWall = wallPredicate(walls.map((w) => ({ grid_x: w.gx, grid_y: w.gy })));

  for (const it of items) {
    if (it.kind === 'u') {
      const s = gridToScreen(it.u.gx + 0.5, it.u.gy + 0.5);
      const ux = ORIGIN.x + s.x, uy = ORIGIN.y + s.y;
      // Archer existiert als Master-Sprite → echter Bild-Pfad; übrige Einheiten
      // (V2 noch offen) als prozeduraler Punkt, exakt wie BattleCanvas.renderUnit.
      if (it.u.type === 'archer') h.drawSprite('units', 'archer', ux, uy);
      else drawUnitDot(ux, uy, it.u.type);
      continue;
    }
    const p = it.p;
    if (p.zone === 'wall') {
      if (destroyed.has(`${p.gx},${p.gy}`)) continue; // zerstört → Lücke (nichts zeichnen)
      drawWallConnected(p.gx, p.gy, wallConnectionAt(isWall, p.gx, p.gy));
    } else {
      drawBuilding(p);
    }
  }

  // Bresche markieren (dezenter Rauch/Schutt-Hinweis, KEIN Sprite).
  const bc = gridToScreen(maxGx + 0.5, gy0 + 1);
  h.text('Bresche', ORIGIN.x + bc.x - 4, ORIGIN.y + bc.y - 8, 14, '#ffd24a');

  h.text('KAMPF — 1×1-Mauern verbinden sich automatisch (WallSprite / wallConnectionAt), kein wall.png', 24, 40, 23, '#f4ead2');
  h.text(`${walls.length} Mauern · gerade/Ecke/T ganz aus der Nachbarschaft (shared) · zerstoerte Mauer = saubere Luecke, kein weisser Riesen-Rest`, 24, 66, 15, '#d8cbb0');

  const out = h.save(`battle_walls_${VERSION}.png`);
  console.log('WROTE', out);
}

void main();
