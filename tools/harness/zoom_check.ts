/**
 * HARNESS-BILD 2 (Vertical Slice Schritt 2.2) — Zoom-Beleg.
 *
 * Dieselbe kleine Szene (Rathaus + zwei Archer) in drei Panels bei 0.5x / 1.0x /
 * 1.5x. Die Transform kommt aus der ECHTEN App-Funktion `zoomAround`
 * (@village-wars/shared) — genau die, die der Village-/BattleCanvas über
 * `useWorldCamera` benutzt. Ein Fadenkreuz markiert in jedem Panel denselben
 * WELTPUNKT (Rathaus-Fuß); dass es überall an der gleichen Stelle relativ zum
 * Rathaus sitzt, zeigt: der Zoom skaliert nur, die Sprites laden nicht neu.
 *
 *   npx tsx tools/harness/zoom_check.ts [vNN]
 */
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  gridToScreen,
  zoomAround,
} from '@village-wars/shared';
import { makeHarness } from './lib';

const VERSION = process.argv[2] ?? 'v01';

async function main(): Promise<void> {
  const PANEL_W = 460, H = 620;
  const W = PANEL_W * 3;
  const h = await makeHarness(W, H, '#4d7a3a');
  const { CK, canvas } = h;

  const zooms = [clampZoom(ZOOM_MIN), 1.0, clampZoom(ZOOM_MAX)];

  // Eine Szene (Weltkoordinaten relativ zum lokalen Ursprung).
  const scene: Array<{ kind: 'buildings' | 'units'; type: string; gx: number; gy: number }> = [
    { kind: 'buildings', type: 'town_hall', gx: 2, gy: 2 },
    { kind: 'units', type: 'archer', gx: 4, gy: 1 },
    { kind: 'units', type: 'archer', gx: 4, gy: 3 },
  ];
  // Fokus = Rathaus-Fuß (Weltpunkt), in jedem Panel dasselbe Ziel.
  const focusWorld = gridToScreen(2.5, 2.5);

  zooms.forEach((zoom, i) => {
    const px0 = i * PANEL_W;
    // Panel-Hintergrund
    const bg = new CK.Paint();
    bg.setColor(CK.parseColorString(i === 1 ? '#5f8f47' : '#57853f'));
    canvas.drawRect(CK.XYWHRect(px0, 0, PANEL_W - 2, H), bg);
    bg.delete();

    // Basis-Kamera: lokalen Weltursprung in die Panelmitte legen (Grundzoom).
    const localOrigin = { x: px0 + PANEL_W / 2 - 40, y: 250 };
    // Fokus in Bildschirmkoordinaten bei Zoom 1 …
    const focusScreen = { x: localOrigin.x + focusWorld.x, y: localOrigin.y + focusWorld.y };
    // … und über die ECHTE App-Funktion auf den Zielzoom bringen (Fokus fix).
    const res = zoomAround(localOrigin, 1.0, zoom, focusScreen);

    canvas.save();
    // Clip aufs Panel, damit skalierte Sprites nicht ins Nachbarpanel ragen.
    canvas.clipRect(CK.XYWHRect(px0, 0, PANEL_W - 2, H), CK.ClipOp.Intersect, true);
    // Transform: screen = cam + zoom * world  (identisch zur Group [translate, scale]).
    canvas.translate(res.cam.x, res.cam.y);
    canvas.scale(res.zoom, res.zoom);

    // Iso-Raster im Weltraum
    h.isoGrid(0, 0, 7, 6);
    for (const it of [...scene].sort((a, b) => a.gx + a.gy - (b.gx + b.gy))) {
      const s = gridToScreen(it.gx + 0.5, it.gy + 0.5);
      h.drawSprite(it.kind, it.type, s.x, s.y);
    }
    canvas.restore();

    // Fadenkreuz auf dem Fokus-Weltpunkt (Bildschirmkoordinaten, unskaliert).
    const fx = res.cam.x + res.zoom * focusWorld.x;
    const fy = res.cam.y + res.zoom * focusWorld.y;
    const cp = new CK.Paint();
    cp.setColor(CK.parseColorString('#ff3b30'));
    cp.setStyle(CK.PaintStyle.Stroke);
    cp.setStrokeWidth(2);
    cp.setAntiAlias(true);
    const cross = (x: number, y: number) => {
      const p = new CK.Path();
      p.moveTo(x - 12, y); p.lineTo(x + 12, y);
      p.moveTo(x, y - 12); p.lineTo(x, y + 12);
      canvas.drawPath(p, cp); p.delete();
    };
    cross(fx, fy);
    cp.delete();

    h.text(`Zoom ${zoom.toFixed(1)}x`, px0 + 18, 42, 26, '#0d1a08');
  });

  h.text('Vertical Slice 2.2 — ZOOM 0.5x .. 1.5x (zoomAround aus shared, Sprites nur skaliert)',
    16, H - 18, 18, '#0d1a08');
  h.text('rotes Fadenkreuz = derselbe Weltpunkt (Rathaus-Fuss), in jedem Panel fix',
    16, H - 44, 15, '#16290f');

  const out = h.save(`vslice2_zoom_${VERSION}.png`);
  console.log('WROTE', out);

  // Numerischer Beleg: Fokus bleibt unter zoomAround exakt stehen.
  const t = { x: 100, y: 60 };
  const focus = { x: 220, y: 180 };
  for (const z of [0.5, 1.5]) {
    const r = zoomAround(t, 1.0, z, focus);
    const back = { x: r.cam.x + r.zoom * ((focus.x - t.x) / 1.0), y: r.cam.y + r.zoom * ((focus.y - t.y) / 1.0) };
    console.log(`zoomAround→${z}: Fokus (${focus.x},${focus.y}) bleibt (${back.x.toFixed(1)},${back.y.toFixed(1)})`);
  }
}

void main();
