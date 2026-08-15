/**
 * HARNESS-BILD 3 (Vertical Slice Schritt 2.3) — Testdorf auf korrigiertem Raster.
 *
 * 5 Blender-Gebäude (Rathaus, Kaserne, zwei Lager, Wachturm) + 7 Archer im
 * gemeinsamen Weltmaßstab. Die Footprints kommen aus dem Manifest, das Layout
 * wird VOR dem Zeichnen validiert (kein Überlappen, ≥1 Kachel Abstand). Die
 * Grundflächen sind als Iso-Rechtecke eingezeichnet, damit man den Abstand sieht.
 *
 *   npx tsx tools/harness/scale_village.ts [vNN]
 */
import { gridToScreen } from '@village-wars/shared';
import { makeHarness, scaleBanner } from './lib';
import { BUILDINGS, UNITS, footprint, layoutBounds, validateLayout } from './village';

const VERSION = process.argv[2] ?? 'v01';

async function main(): Promise<void> {
  const { report } = validateLayout();
  console.log('LAYOUT-VALIDIERUNG (kein Ueberlappen, >=1 freie Kachel Abstand):');
  report.forEach((r) => console.log('  ' + r));

  const W = 1500, H = 1000;
  const h = await makeHarness(W, H, '#4d7a3a');
  const { CK, canvas } = h;

  // Kamera so, dass die Layout-Mitte in die Bildmitte fällt.
  const b = layoutBounds();
  const mid = gridToScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  const ORIGIN = { x: W / 2 - mid.x, y: H / 2 - mid.y - 40 };

  h.isoGrid(ORIGIN.x, ORIGIN.y, b.maxX + 3, b.maxY + 3);

  // Footprint-Rechtecke (Iso-Diamant über den Kachelbereich) einzeichnen.
  const fp = new CK.Paint();
  fp.setAntiAlias(true);
  for (const pl of BUILDINGS) {
    const f = footprint(pl.type);
    const c = [
      gridToScreen(pl.gx, pl.gy),
      gridToScreen(pl.gx + f, pl.gy),
      gridToScreen(pl.gx + f, pl.gy + f),
      gridToScreen(pl.gx, pl.gy + f),
    ];
    const p = new CK.Path();
    p.moveTo(ORIGIN.x + c[0]!.x, ORIGIN.y + c[0]!.y);
    for (let i = 1; i < 4; i++) p.lineTo(ORIGIN.x + c[i]!.x, ORIGIN.y + c[i]!.y);
    p.close();
    fp.setStyle(CK.PaintStyle.Fill);
    fp.setColor(CK.Color(255, 235, 150, 0.18));
    canvas.drawPath(p, fp);
    fp.setStyle(CK.PaintStyle.Stroke);
    fp.setStrokeWidth(2);
    fp.setColor(CK.Color(30, 40, 16, 0.8));
    canvas.drawPath(p, fp);
    p.delete();
  }
  fp.delete();

  // Alles tiefensortiert zeichnen. Gebäude sitzen mit ihrem Fußpunkt an der
  // VORDERECKE der Grundfläche (gx+f, gy+f) → die Figur füllt den Footprint nach
  // hinten aus (Unterkant-Anker), statt „hinten" auf der Mitte zu schweben.
  type Item = { depth: number; draw: () => void };
  const items: Item[] = [];
  for (const pl of BUILDINGS) {
    const f = footprint(pl.type);
    const s = gridToScreen(pl.gx + f, pl.gy + f);
    items.push({ depth: (pl.gx + f) + (pl.gy + f), draw: () => h.drawSprite('buildings', pl.type, ORIGIN.x + s.x, ORIGIN.y + s.y) });
  }
  for (const u of UNITS) {
    const s = gridToScreen(u.gx, u.gy);
    items.push({ depth: u.gx + u.gy, draw: () => h.drawSprite('units', u.type, ORIGIN.x + s.x, ORIGIN.y + s.y) });
  }
  items.sort((a, z) => a.depth - z.depth).forEach((it) => it.draw());

  // Kopf-/Fußtexte
  h.text('Schritt 3-Korrektur — ENGES TESTDORF (Grundzoom 1.0x, sockellose Gebaeude)', 24, 40, 26, '#0d1a08');
  h.text(scaleBanner(), 24, 66, 15, '#16290f');
  h.text(`${BUILDINGS.length} Blender-Gebaeude + ${UNITS.length} Archer · realistische Footprints aus Manifest (gelb) · validiert: kein Ueberlappen, genau 1 Kachel Weg`,
    24, 88, 15, '#16290f');
  h.text('Rathaus 4x4 · Kaserne 3x3 · Lager Holz/Stein 3x3 · Wachturm 2x2 · je 1 Kachel Weg dazwischen',
    24, H - 24, 16, '#0f1d09');

  const out = h.save(`vslice2_testdorf_${VERSION}.png`);
  console.log('WROTE', out);
}

void main();
