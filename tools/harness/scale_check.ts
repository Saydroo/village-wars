/**
 * HARNESS-BILD 1 (Vertical Slice Schritt 2.1) — gemeinsamer Weltmaßstab.
 *
 * Zeigt Blender-Rathaus und Archer im SELBEN Maßstab und misst nach:
 * Rathaus-Breite in Kacheln, Archer-Körperbreite in Pixeln. Alle Zahlen kommen
 * aus `@village-wars/shared` bzw. aus einer echten Alpha-Messung am Master —
 * nichts ist im Harness hartkodiert.
 *
 *   npx tsx tools/harness/scale_check.ts [vNN]
 */
import {
  BUILDING_MASTER_PPU,
  PX_PER_WORLD_UNIT,
  TILE_WIDTH,
  UNIT_MASTER_PPU,
  buildingDisplayWidth,
  gridToScreen,
  unitDisplayWidth,
} from '@village-wars/shared';
import { assetPath, makeHarness, measureMaster, scaleBanner } from './lib';

const VERSION = process.argv[2] ?? 'v01';

async function main(): Promise<void> {
  const th = await measureMaster(assetPath('buildings', 'town_hall'));
  const ar = await measureMaster(assetPath('units', 'archer'));

  // Nachweis-Rechnung (Master-Pixel → Welteinheiten → Bildschirm im Grundzoom)
  const thBboxW = th.bbox.x1 - th.bbox.x0 + 1;
  const thWorldW = thBboxW / BUILDING_MASTER_PPU;
  const thScreenW = thWorldW * PX_PER_WORLD_UNIT;
  const thTiles = thScreenW / TILE_WIDTH;

  const bodyWorldW = ar.widestRun / UNIT_MASTER_PPU;
  const bodyScreenW = bodyWorldW * PX_PER_WORLD_UNIT;

  const W = 1400, H = 900;
  const h = await makeHarness(W, H, '#5f8f47');
  const { CK, canvas } = h;

  const ORIGIN = { x: 470, y: 300 };
  h.isoGrid(ORIGIN.x - 0, ORIGIN.y, 12, 12);

  // Szene: Rathaus mittig, drei Archer daneben — gemeinsamer Weltmaßstab.
  const scene: Array<{ kind: 'buildings' | 'units'; type: string; gx: number; gy: number }> = [
    { kind: 'buildings', type: 'town_hall', gx: 3, gy: 3 },
    { kind: 'units', type: 'archer', gx: 7, gy: 1 },
    { kind: 'units', type: 'archer', gx: 8, gy: 5 },
    { kind: 'units', type: 'archer', gx: 10, gy: 3 },
  ];
  for (const it of [...scene].sort((a, b) => a.gx + a.gy - (b.gx + b.gy))) {
    const s = gridToScreen(it.gx + 0.5, it.gy + 0.5);
    h.drawSprite(it.kind, it.type, ORIGIN.x + s.x, ORIGIN.y + s.y);
  }

  // --- Messbalken Rathaus: Silhouettenbreite in Kacheln ---
  const thPos = gridToScreen(3.5, 3.5);
  const thCx = ORIGIN.x + thPos.x, thCy = ORIGIN.y + thPos.y;
  const mp = new CK.Paint();
  mp.setAntiAlias(true);
  mp.setColor(CK.parseColorString('#1b2a10'));
  mp.setStrokeWidth(3);
  mp.setStyle(CK.PaintStyle.Stroke);
  const barY = thCy + 60;
  const bx0 = thCx - thScreenW / 2, bx1 = thCx + thScreenW / 2;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const p = new CK.Path();
    p.moveTo(x0, y0); p.lineTo(x1, y1);
    canvas.drawPath(p, mp); p.delete();
  };
  line(bx0, barY, bx1, barY);
  line(bx0, barY - 10, bx0, barY + 10);
  line(bx1, barY - 10, bx1, barY + 10);
  // Kachel-Ticks auf demselben Balken
  for (let i = 0; i <= Math.floor(thTiles); i++) {
    const x = bx0 + i * TILE_WIDTH;
    line(x, barY - 5, x, barY + 5);
  }
  h.text(`Rathaus ${thScreenW.toFixed(0)} px = ${thTiles.toFixed(2)} Kacheln`,
    bx0, barY + 32, 20, '#12240c');

  // --- Messbalken Archer: Körperbreite ---
  const arPos = gridToScreen(10.5, 3.5);
  const arCx = ORIGIN.x + arPos.x, arCy = ORIGIN.y + arPos.y;
  const aY = arCy + 26;
  line(arCx - bodyScreenW / 2, aY, arCx + bodyScreenW / 2, aY);
  line(arCx - bodyScreenW / 2, aY - 7, arCx - bodyScreenW / 2, aY + 7);
  line(arCx + bodyScreenW / 2, aY - 7, arCx + bodyScreenW / 2, aY + 7);
  h.text(`Archer-Koerper ${bodyScreenW.toFixed(1)} px`, arCx - 70, aY + 26, 18, '#12240c');
  mp.delete();

  // --- Kopf-/Fusstexte ---
  h.text('Vertical Slice 2.1 — GEMEINSAMER WELTMASSSTAB (Grundzoom 1.0x)', 28, 40, 26, '#0d1a08');
  h.text(scaleBanner(), 28, 68, 16, '#16290f');
  h.text('Alte Regeln entfernt: Gebaeude FW*1.2 + TYPE_SCALE, Einheiten UNIT_DISP_W=123.', 28, 90, 16, '#3a2410');

  const lines = [
    'RECHENWEG (importiert aus packages/shared/src/game/worldScale.ts):',
    `  Rathaus-Master: Silhouette ${thBboxW} px / ${BUILDING_MASTER_PPU} px-je-WE = ${thWorldW.toFixed(2)} WE`,
    `                  ${thWorldW.toFixed(2)} WE x ${PX_PER_WORLD_UNIT} px/WE = ${thScreenW.toFixed(0)} px = ${thTiles.toFixed(2)} Kacheln  (Ziel ~4.7)`,
    `  Archer-Master:  Koerper ${ar.widestRun} px / ${UNIT_MASTER_PPU} px-je-WE = ${bodyWorldW.toFixed(3)} WE`,
    `                  ${bodyWorldW.toFixed(3)} WE x ${PX_PER_WORLD_UNIT} px/WE = ${bodyScreenW.toFixed(1)} px  (Ziel ~38)`,
    `  Leinwandbreite auf dem Schirm: Gebaeude ${buildingDisplayWidth(512).toFixed(0)} px, Einheit ${unitDisplayWidth(512).toFixed(0)} px`,
  ];
  lines.forEach((s, i) => h.text(s, 28, H - 130 + i * 22, 17, '#0f1d09'));

  const out = h.save(`vslice2_weltmassstab_${VERSION}.png`);
  console.log('WROTE', out);
  console.log(`Rathaus ${thScreenW.toFixed(1)} px = ${thTiles.toFixed(2)} Kacheln | Archer-Koerper ${bodyScreenW.toFixed(1)} px`);
}

void main();
