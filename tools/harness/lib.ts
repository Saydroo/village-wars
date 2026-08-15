/**
 * CANVASKIT-HARNESS — gemeinsame Basis.
 *
 * Regel für diesen Harness (Vertical Slice Schritt 2): er DUPLIZIERT keine
 * App-Zahlen. Alles, was Maßstab, Geometrie und Zoom betrifft, kommt per Import
 * aus `@village-wars/shared` (dieselbe Datei, die die App benutzt); die
 * Sprite-Dateinamen und Anker kommen aus derselben `manifest.json` wie im
 * Renderer. Läuft der Harness und die App auseinander, ist das ein Fehler im
 * Code — nicht in zwei getrennten Konstantensätzen.
 *
 * Start:  npx tsx tools/harness/<skript>.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  BUILDING_MASTER_PPU,
  PX_PER_WORLD_UNIT,
  TILE_HEIGHT,
  TILE_WIDTH,
  UNIT_MASTER_PPU,
  buildingDisplayWidth,
  gridToScreen,
  unitDisplayWidth,
} from '@village-wars/shared';

/* eslint-disable @typescript-eslint/no-var-requires */
const CanvasKitInit = require('canvaskit-wasm');
const sharp = require('sharp');

export const ROOT = path.resolve(__dirname, '..', '..');
export const ASSETS = path.join(ROOT, 'apps', 'mobile', 'src', 'assets', 'factions', 'humans');
export const OUT_DIR = path.join(ROOT, 'design', 'harness');

export interface Manifest {
  buildings: Record<string, { file: string; anchor?: number[] }>;
  units: Record<string, { file: string; anchor?: number[] }>;
}

export const manifest: Manifest = JSON.parse(
  fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'),
);

/** Anker aus dem Manifest — exakt die Regel aus humanUnitAssets/humanBuildingAssets. */
export function anchorOf(kind: 'buildings' | 'units', type: string): [number, number] {
  const a = manifest[kind][type]?.anchor;
  return Array.isArray(a) && a.length === 2 ? [a[0]!, a[1]!] : [0.5, 1.0];
}

export function assetPath(kind: 'buildings' | 'units', type: string): string {
  const file = manifest[kind][type]?.file ?? `${type}.png`;
  return path.join(ASSETS, kind, file);
}

// --- Messungen am Master (für die Maßstabs-Nachweise) ------------------------

export interface MasterMetrics {
  width: number;
  height: number;
  /** Alpha-Bounding-Box der Silhouette. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Breitester zusammenhängender Alpha-Lauf (trennt Körper von dünnem Bogen). */
  widestRun: number;
}

export async function measureMaster(file: string): Promise<MasterMetrics> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, widestRun = 0;
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * C + 3];
      if (a > 40) {
        run++;
        if (run > widestRun) widestRun = run;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      } else run = 0;
    }
  }
  return { width: W, height: H, bbox: { x0, y0, x1, y1 }, widestRun };
}

// --- CanvasKit-Zeichenhilfen -------------------------------------------------

export interface Harness {
  CK: any;
  canvas: any;
  surface: any;
  img: (kind: 'buildings' | 'units', type: string) => any;
  drawSprite: (kind: 'buildings' | 'units', type: string, cx: number, cy: number) => void;
  text: (s: string, x: number, y: number, size: number, color?: string) => void;
  isoGrid: (originX: number, originY: number, cols: number, rows: number, colA?: string, colB?: string) => void;
  save: (file: string) => string;
}

export async function makeHarness(W: number, H: number, bg: string): Promise<Harness> {
  const ckPath = path.dirname(require.resolve('canvaskit-wasm'));
  const CK = await CanvasKitInit({ locateFile: (f: string) => path.join(ckPath, f) });
  const surface = CK.MakeSurface(W, H);
  const canvas = surface.getCanvas();
  canvas.clear(CK.parseColorString(bg));

  const cache = new Map<string, any>();
  const img = (kind: 'buildings' | 'units', type: string) => {
    const key = `${kind}/${type}`;
    let im = cache.get(key);
    if (!im) {
      im = CK.MakeImageFromEncoded(fs.readFileSync(assetPath(kind, type)));
      cache.set(key, im);
    }
    return im;
  };

  const paint = new CK.Paint();
  paint.setAntiAlias(true);

  /**
   * Ein Sprite am Fußpunkt-Anker platzieren — 1:1 die Rechnung aus
   * buildingSprite.tsx bzw. BattleCanvas.tsx, nur mit importierten Funktionen.
   */
  const drawSprite = (kind: 'buildings' | 'units', type: string, cx: number, cy: number) => {
    const im = img(kind, type);
    const iw = im.width(), ih = im.height();
    const dispW = kind === 'buildings' ? buildingDisplayWidth(iw) : unitDisplayWidth(iw);
    const dispH = dispW * (ih / iw);
    const [ax, ay] = anchorOf(kind, type);
    // GEBÄUDE: kein Boden-Schatten (sitzen direkt auf dem Rasen, CoC-Style).
    // EINHEITEN behalten einen kleinen Fußschatten (helfen der Lesbarkeit).
    if (kind === 'units') {
      const sh = new CK.Paint();
      sh.setAntiAlias(true);
      sh.setColor(CK.Color(0, 0, 0, 0.27));
      canvas.save();
      canvas.translate(cx, cy);
      canvas.scale(1, 0.4);
      canvas.drawCircle(0, 0, dispW * 0.11, sh);
      canvas.restore();
      sh.delete();
    }
    canvas.drawImageRectOptions(
      im,
      CK.XYWHRect(0, 0, iw, ih),
      CK.XYWHRect(cx - ax * dispW, cy - ay * dispH, dispW, dispH),
      CK.FilterMode.Linear,
      CK.MipmapMode.Linear,
      paint,
    );
  };

  // Ohne Typeface zeichnet CanvasKit KEINEN Text.
  const TF = CK.Typeface.MakeFreeTypeFaceFromData(
    fs.readFileSync('C:/Windows/Fonts/arialbd.ttf').buffer,
  );
  const text = (s: string, x: number, y: number, size: number, color = '#0d1a08') => {
    const f = new CK.Font(TF, size);
    const p = new CK.Paint();
    p.setColor(CK.parseColorString(color));
    p.setAntiAlias(true);
    canvas.drawText(s, x, y, p, f);
    f.delete();
    p.delete();
  };

  /** Iso-Kachelraster über die echte gridToScreen-Projektion aus shared. */
  const isoGrid = (
    originX: number, originY: number, cols: number, rows: number,
    colA = '#6aa04e', colB = '#649a49',
  ) => {
    const dp = new CK.Paint();
    dp.setAntiAlias(true);
    for (let gx = 0; gx < cols; gx++) {
      for (let gy = 0; gy < rows; gy++) {
        const s = gridToScreen(gx + 0.5, gy + 0.5);
        const cx = originX + s.x, cy = originY + s.y;
        const p = new CK.Path();
        p.moveTo(cx, cy - TILE_HEIGHT / 2);
        p.lineTo(cx + TILE_WIDTH / 2, cy);
        p.lineTo(cx, cy + TILE_HEIGHT / 2);
        p.lineTo(cx - TILE_WIDTH / 2, cy);
        p.close();
        dp.setColor(CK.parseColorString((gx + gy) % 2 ? colA : colB));
        canvas.drawPath(p, dp);
        p.delete();
      }
    }
    dp.delete();
  };

  const save = (file: string) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, file);
    surface.flush();
    fs.writeFileSync(out, Buffer.from(surface.makeImageSnapshot().encodeToBytes()));
    return out;
  };

  return { CK, canvas, surface, img, drawSprite, text, isoGrid, save };
}

/** Kopfzeile mit den importierten Weltmaßstab-Werten (Beweis: keine Duplikate). */
export function scaleBanner(): string {
  return (
    `Weltmasszstab: ${PX_PER_WORLD_UNIT} px/Welteinheit · Kachel ${TILE_WIDTH}x${TILE_HEIGHT} px · ` +
    `Master Gebaeude ${BUILDING_MASTER_PPU} px/WE, Einheiten ${UNIT_MASTER_PPU} px/WE`
  );
}
