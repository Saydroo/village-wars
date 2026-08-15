/**
 * BELEG-RENDER: DEPLOY-SPERRZONE — ANKER-FIX (Außen-Gebäude).
 *
 * Zeigt den Fix aus BattleCanvas.tsx: der Kampf zeichnet Gebäude jetzt
 * FOOTPRINT-ZENTRIERT (`footprintCenter`, wie das Dorf/VillageCanvas), nicht mehr
 * auf der Ursprungskachel (gx+0.5, gy+0.5). Dadurch sitzt die server-autoritative
 * Außen-Sperrzone (kleiner Radius um freistehende Gebäude) kachelgenau UNTER ihrem
 * Gebäude — in exakt derselben Zonen-Beziehung wie die 1×1-Mauern im Innenraum
 * (die schon vorher „perfekt" saßen).
 *
 * KEINE duplizierte Logik: die rote Zone kommt aus `deployBlockedTiles`
 * (@village-wars/shared) — dieselbe Funktion, die das App-Overlay UND der Server
 * (isDeployBlocked) nutzen. Die Kachel-Raute ist 1:1 `tapTileDiamond` aus
 * BattleCanvas.tsx. Der Anker kommt aus `footprintCenter` (shared). Damit ist der
 * Render ein getreuer Stellvertreter des App-Render-Pfads.
 *
 * LINKS  = VORHER (Fuß auf Ursprungskachel gx+0.5): Außen-Zonen sichtbar versetzt.
 * RECHTS = NACHHER (footprintCenter): Außen-Zonen exakt unter dem Gebäude.
 * Die Zone ist in BEIDEN Panels identisch (dieselben blockierten Kacheln) —
 * NUR der Gebäude-Anker unterscheidet sich.
 *
 *   npx tsx tools/harness/deploy_zone_anchor.ts [vNN]
 */
import {
  gridToScreen, buildingDisplayWidth, buildingDisplayScale,
  TILE_WIDTH, TILE_HEIGHT, deployBlockedTiles, footprintCenter,
  type DeployZoneBuilding,
} from '@village-wars/shared';
import { makeHarness } from './lib';
import { anchor } from '../layout/spriteMetrics';

const VERSION = process.argv[2] ?? 'v01';

const GRID_W = 30;
const GRID_H = 26;

// --- Szene: geschlossener Mauerring (Innenraum-Sperre, unverändert „perfekt") +
// ein Rathaus INNEN, sowie drei FREISTEHENDE Gebäude AUSSERHALB (die Problemstelle).
interface B { type: string; gx: number; gy: number; zone: 'wall' | 'inside' | 'outside'; }
function ringWalls(lo: number, hi: number): B[] {
  const out: B[] = [];
  for (let x = lo; x <= hi; x++) { out.push({ type: 'wall', gx: x, gy: lo, zone: 'wall' }); out.push({ type: 'wall', gx: x, gy: hi, zone: 'wall' }); }
  for (let y = lo + 1; y < hi; y++) { out.push({ type: 'wall', gx: lo, gy: y, zone: 'wall' }); out.push({ type: 'wall', gx: hi, gy: y, zone: 'wall' }); }
  return out;
}
const SCENE: B[] = [
  ...ringWalls(3, 12),                                   // Mauerring, Innenraum 4..11
  { type: 'town_hall', gx: 5, gy: 5, zone: 'inside' },   // 4×4 innen (Tiles 5..8)
  { type: 'gold_mine', gx: 19, gy: 3, zone: 'outside' }, // 3×3 außen
  { type: 'lumber_camp', gx: 21, gy: 11, zone: 'outside' }, // 3×3 außen
  { type: 'barracks', gx: 16, gy: 17, zone: 'outside' },    // 3×3 außen
];

// Geteilte Deploy-Logik: exakt die Kacheln, die Server UND App-Overlay sperren.
const zoneBuildings: DeployZoneBuilding[] = SCENE.map((b) => ({ building_type: b.type, gx: b.gx, gy: b.gy }));
const blockedTiles = deployBlockedTiles(zoneBuildings, GRID_W, GRID_H);

// --- Iso-Raute EINER Deploy-Kachel — 1:1 tapTileDiamond aus BattleCanvas.tsx
// (Punkt-Konvention, zentriert auf gridToScreen(gx,gy)). ---
function tapDiamondPts(gx: number, gy: number): [number, number][] {
  const t = gridToScreen(gx - 0.5, gy - 0.5);
  const r = gridToScreen(gx + 0.5, gy - 0.5);
  const b = gridToScreen(gx + 0.5, gy + 0.5);
  const l = gridToScreen(gx - 0.5, gy + 0.5);
  return [[t.x, t.y], [r.x, r.y], [b.x, b.y], [l.x, l.y]];
}

async function main(): Promise<void> {
  // --- Gemeinsame Screen-Bounds über BEIDE Panels: alle Zonenkacheln + beide
  // Anker-Varianten der Gebäude, damit VORHER/NACHHER dieselbe Projektion teilen.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const t of blockedTiles) for (const [x, y] of tapDiamondPts(t.gx, t.gy)) acc(x, y);
  // grobe Sprite-Höhe nach oben einrechnen (Türme ragen weit über den Fuß).
  for (const b of SCENE) {
    const [cx, cy] = footprintCenter(b.type, b.gx, b.gy);
    const s = gridToScreen(cx, cy);
    acc(s.x - 90, s.y - 150); acc(s.x + 90, s.y + 30);
  }

  const PAD = 60;
  const panelW = Math.ceil(maxX - minX) + PAD * 2;
  const panelH = Math.ceil(maxY - minY) + PAD * 2;
  const HEADER = 74;
  const GAP = 40;
  const W = panelW * 2 + GAP;
  const H = panelH + HEADER;

  const h = await makeHarness(W, H, '#2b271f');
  const { CK, canvas } = h;

  const paint = new CK.Paint();
  paint.setAntiAlias(true);

  const fillPath = (pts: [number, number][], color: number[]) => {
    const p = new CK.Path();
    p.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]![0], pts[i]![1]);
    p.close();
    const pt = new CK.Paint(); pt.setAntiAlias(true);
    pt.setColor(CK.Color(color[0]!, color[1]!, color[2]!, color[3] ?? 1));
    canvas.drawPath(p, pt); p.delete(); pt.delete();
  };
  const strokePath = (pts: [number, number][], color: number[], wdt: number) => {
    const p = new CK.Path();
    p.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]![0], pts[i]![1]);
    p.close();
    const pt = new CK.Paint(); pt.setAntiAlias(true); pt.setStyle(CK.PaintStyle.Stroke); pt.setStrokeWidth(wdt);
    pt.setColor(CK.Color(color[0]!, color[1]!, color[2]!, color[3] ?? 1));
    canvas.drawPath(p, pt); p.delete(); pt.delete();
  };

  // Simpler Iso-Steinblock für Mauern (nur Beleg-Kulisse; die App nutzt WallSprite).
  const isoBlock = (cx: number, cy: number, hw: number, hh: number, hgt: number, base: number[]) => {
    const top: [number, number][] = [[cx, cy - hh - hgt], [cx + hw, cy - hgt], [cx, cy + hh - hgt], [cx - hw, cy - hgt]];
    const left: [number, number][] = [[cx - hw, cy - hgt], [cx, cy + hh - hgt], [cx, cy + hh], [cx - hw, cy]];
    const right: [number, number][] = [[cx, cy + hh - hgt], [cx + hw, cy - hgt], [cx + hw, cy], [cx, cy + hh]];
    const lt = (f: number) => base.map((v, i) => (i < 3 ? Math.min(255, v + f) : v));
    const dk = (f: number) => base.map((v, i) => (i < 3 ? Math.max(0, v - f) : v));
    fillPath(left, dk(35)); fillPath(right, dk(60)); fillPath(top, lt(25));
  };

  const drawBuildingAt = (type: string, agx: number, agy: number, ox: number, oy: number) => {
    const im = h.img('buildings', type);
    const iw = im.width(), ih = im.height();
    const dispW = buildingDisplayWidth(iw) * buildingDisplayScale(type);
    const dispH = dispW * (ih / iw);
    const [ax, ay] = anchor(type);
    const s = gridToScreen(agx, agy);
    const cx = ox + s.x, cy = oy + s.y;
    canvas.drawImageRectOptions(
      im, CK.XYWHRect(0, 0, iw, ih),
      CK.XYWHRect(cx - ax * dispW, cy - ay * dispH, dispW, dispH),
      CK.FilterMode.Linear, CK.MipmapMode.Linear, paint,
    );
  };

  // --- Ein Panel (footprintCentered: true = NACHHER, false = VORHER) ---
  const drawPanel = (ox: number, oy: number, footprintCentered: boolean, title: string) => {
    // Boden
    h.isoGrid(ox, oy, GRID_W, GRID_H, '#5c6b46', '#556340');

    // Rote Deploy-Sperrzone (unter den Gebäuden), identisch in beiden Panels.
    for (const t of blockedTiles) {
      const pts = tapDiamondPts(t.gx, t.gy).map(([x, y]) => [ox + x, oy + y] as [number, number]);
      fillPath(pts, [255, 32, 18, 0.42]);
      strokePath(pts, [255, 202, 160, 0.55], 1);
    }

    // Gebäude + Mauern nach Tiefe (gx+gy) sortiert.
    const items = [...SCENE].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    for (const b of items) {
      if (b.type === 'wall') {
        const s = gridToScreen(b.gx + 0.5, b.gy + 0.5);
        isoBlock(ox + s.x, oy + s.y, 17, 8.5, 18, [150, 145, 125]);
      } else {
        const [fcx, fcy] = footprintCenter(b.type, b.gx, b.gy);
        const [agx, agy] = footprintCentered ? [fcx, fcy] : [b.gx + 0.5, b.gy + 0.5];
        drawBuildingAt(b.type, agx, agy, ox, oy);
      }
    }

    h.text(title, ox + 20, oy - 16, 22, footprintCentered ? '#bff0b0' : '#ffcf9a');
  };

  const oyPanel = HEADER + 24;
  drawPanel(PAD - minX, oyPanel - minY, false, 'VORHER  ·  Anker = Ursprungskachel (gx+0.5, gy+0.5)');
  drawPanel(PAD - minX + panelW + GAP, oyPanel - minY, true, 'NACHHER  ·  Anker = footprintCenter (wie Dorf + Zone)');

  h.text('DEPLOY-SPERRZONE — Anker-Fix: Aussen-Zonen sitzen kachelgenau unter ihren Gebaeuden (rote Zone = deployBlockedTiles, identisch in beiden Panels)', 22, 34, 20, '#f4ead2');
  h.text('Innenraum-Sperre (Flood-Fill) unveraendert · nur der Gebaeude-Anker im Battle-Render geaendert · Server-Regel (isDeployBlocked) unberuehrt', 22, 58, 14, '#d8cbb0');

  const out = h.save(`deploy_zone_anchor_${VERSION}.png`);
  console.log('WROTE', out);
}

void main();
