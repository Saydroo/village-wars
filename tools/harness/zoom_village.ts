/**
 * HARNESS-BILDER 5 (Vertical Slice Schritt 2.5) — Testdorf bei 0.5x / 1.0x / 1.5x.
 *
 * Dasselbe validierte Testdorf (Blender-Gebäude + Kontur-Archer, gemeinsamer
 * Weltmaßstab) in drei getrennten Bildern, gezoomt über die ECHTE App-Funktion
 * `zoomAround` (@village-wars/shared). Der Zoom skaliert nur die Kamera —
 * dieselben Sprites, kein Nachladen.
 *
 *   npx tsx tools/harness/zoom_village.ts [vNN]
 */
import { ZOOM_MAX, ZOOM_MIN, clampZoom, gridToScreen, zoomAround } from '@village-wars/shared';
import { makeHarness, scaleBanner } from './lib';
import { BUILDINGS, UNITS, footprint, layoutBounds } from './village';

const VERSION = process.argv[2] ?? 'v01';

async function renderAt(zoom: number): Promise<string> {
  const W = 1280, H = 900;
  const h = await makeHarness(W, H, '#4d7a3a');
  const { CK, canvas } = h;

  // Grundzoom-Kamera: Layout-Mitte in die Bildmitte.
  const b = layoutBounds();
  const mid = gridToScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  const base = { x: W / 2 - mid.x, y: H / 2 - mid.y - 10 };
  // Zoom um die Bildmitte über die App-Funktion (Fokus = Bildmitte).
  const res = zoomAround(base, 1.0, clampZoom(zoom), { x: W / 2, y: H / 2 });

  canvas.save();
  canvas.translate(res.cam.x, res.cam.y);
  canvas.scale(res.zoom, res.zoom);

  h.isoGrid(0, 0, b.maxX + 3, b.maxY + 3);

  // Gebäude an der Vorderecke der Grundfläche (gx+f, gy+f) — füllt den Footprint
  // nach hinten aus (Unterkant-Anker). Einheiten am Kachelpunkt.
  type Item = { depth: number; draw: () => void };
  const items: Item[] = [];
  for (const pl of BUILDINGS) {
    const f = footprint(pl.type);
    const c = gridToScreen(pl.gx + f, pl.gy + f);
    items.push({ depth: (pl.gx + f) + (pl.gy + f), draw: () => h.drawSprite('buildings', pl.type, c.x, c.y) });
  }
  for (const u of UNITS) {
    const c = gridToScreen(u.gx, u.gy);
    items.push({ depth: u.gx + u.gy, draw: () => h.drawSprite('units', u.type, c.x, c.y) });
  }
  items.sort((a, z) => a.depth - z.depth).forEach((it) => it.draw());
  canvas.restore();

  // Overlay (unskaliert): Zoom-Label + Weltmaßstab-Banner.
  h.text(`Testdorf @ Zoom ${zoom.toFixed(1)}x`, 24, 40, 26, '#0d1a08');
  h.text(scaleBanner(), 24, 66, 15, '#16290f');
  h.text('Blender-Gebaeude + Kontur-Archer · gemeinsamer Weltmaszstab · zoomAround aus @village-wars/shared',
    24, H - 22, 15, '#0f1d09');

  const label = zoom.toFixed(1).replace('.', '');
  const out = h.save(`vslice2_dorf_zoom${label}_${VERSION}.png`);
  console.log('WROTE', out);
  return out;
}

async function main(): Promise<void> {
  for (const z of [clampZoom(ZOOM_MIN), 1.0, clampZoom(ZOOM_MAX)]) {
    await renderAt(z);
  }
}

void main();
