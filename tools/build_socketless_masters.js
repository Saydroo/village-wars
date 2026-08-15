/**
 * SOCKELLOSE 512-MASTER aus den sockellosen Blender-Renders (design/blender/
 * _nosockel/<type>.png + .json) erzeugen — reine App-Integration.
 *
 * Kette (wie der alte export_buildings, aber jetzt auf das sockellose Bauwerk):
 *   ppu_src = res / ortho_scale        (px pro Blender-Welteinheit im Render)
 *   Skalierung s = 38.74 / ppu_src     (Ziel: BUILDING_MASTER_PPU der App)
 *   Figur auf 512-Leinwand, Fußpunkt (aus JSON) auf (256, 0.86*512).
 * Da der Export auf 38.74 px/Blender-Einheit normiert und die App
 * BUILDING_MASTER_PPU = 38.74 nutzt, gilt: 1 Blender-Einheit = 1 App-Welteinheit.
 *
 * Footprint (Spielmechanik) = Bodenkontakt-Breite des Bauwerks (Sockelband des
 * Masters direkt über dem Fußpunkt) in ganzen Kacheln:
 *   Kacheln = basisBreite_px / 38.74 (px/WE) / (64/45) (WE/Kachel).
 *
 * Alte Sockel-Master werden nach _archiv_sockel_v01/ versioniert.
 *
 *   node tools/build_socketless_masters.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'design', 'blender', '_nosockel');
const DST = path.join(ROOT, 'apps', 'mobile', 'src', 'assets', 'factions', 'humans', 'buildings');
const ARCHIVE = path.join(ROOT, 'apps', 'mobile', 'src', 'assets', 'factions', 'humans', '_archiv_sockel_v01');

const BUILDING_MASTER_PPU = 38.74; // muss zu packages/shared/worldScale.ts passen
const PX_PER_WORLD_UNIT = 45;
const TILE_WIDTH = 64;
const WORLD_UNITS_PER_TILE = TILE_WIDTH / PX_PER_WORLD_UNIT; // 1.4222
const CANVAS = 512;
// Der Fußpunkt-Anker liegt auf der FESTEN FUNDAMENT-Unterkante bei dieser Höhe
// (nicht auf dem untersten Pixel — der kann ein dünner vorderer Prop-Fortsatz
// sein). Horizontal = Modellzentrum (Projektion von x=0, stabil 350/700). Unter
// FOOT_FRAC bleibt Platz für solche Fortsätze, die leicht in den Rasen tauchen.
const FOOT_FRAC = 0.88;

const TYPES = [
  'town_hall', 'clan_castle', 'barracks', 'watchtower', 'cannon', 'wall',
  'gold_mine', 'quarry', 'lumber_camp', 'storage_gold', 'storage_stone', 'storage_wood',
  'research_lab', 'hero_hall',
];

async function alphaBBox(buf, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (buf[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Bodenkontakt-Zeile = TIEFSTER solider Pixel des Bauwerks. In Blender sitzt
 * alles auf z=0; im projizierten Bild ist der unterste solide Pixel der wahre
 * Bodenkontakt (Spitze der RUNDEN Basis, Treppe, vorderstes Bodenelement). Der
 * weiche Antialiasing-Saum (alpha < 128) wird ignoriert, ein einzelner Streu-
 * Pixel ebenfalls (Lauf ≥ 2). Kein „Fundament-20 %"-Sprung mehr — der würde die
 * spitz zulaufende Basis runder Gebäude (watchtower/clan_castle) über den Boden
 * heben.
 */
function groundContactRow(buf, W, H, C) {
  for (let y = H - 1; y >= 0; y--) {
    let n = 0;
    for (let x = 0; x < W; x++) if (buf[(y * W + x) * C + 3] >= 128) n++;
    if (n >= 2) return y;
  }
  return H - 1;
}

/** Breitester Alpha-Lauf in einem y-Band [ya,yb) (px). */
function widestRunInBand(buf, W, H, ya, yb) {
  let widest = 0;
  for (let y = Math.max(0, ya); y < Math.min(H, yb); y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      if (buf[(y * W + x) * 4 + 3] > 40) { run++; if (run > widest) widest = run; }
      else run = 0;
    }
  }
  return widest;
}

(async () => {
  fs.mkdirSync(ARCHIVE, { recursive: true });
  const anchors = {};
  const tiles = {};
  const rows = [];

  for (const t of TYPES) {
    const png = path.join(SRC, `${t}.png`);
    const meta = JSON.parse(fs.readFileSync(path.join(SRC, `${t}.json`), 'utf8'));
    const { res, ortho_scale, footx, footy } = meta;
    const ppuSrc = res / ortho_scale;
    const s = BUILDING_MASTER_PPU / ppuSrc;

    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const bb = await alphaBBox(data, W, H);

    // Figur zuschneiden + skalieren (raw, zum Scannen der Fundamentkante)
    const figW = Math.max(1, Math.round((bb.x1 - bb.x0 + 1) * s));
    const figH = Math.max(1, Math.round((bb.y1 - bb.y0 + 1) * s));
    const figRawObj = await sharp(png)
      .extract({ left: bb.x0, top: bb.y0, width: bb.x1 - bb.x0 + 1, height: bb.y1 - bb.y0 + 1 })
      .resize(figW, figH, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const figRaw = figRawObj.data;

    // Horizontal: Modellzentrum (Projektion von x=0 → footx) auf Canvas-Mitte.
    // Vertikal: TIEFSTER solider Pixel = wahrer Bodenkontakt (auch runde Basen).
    const foundRow = groundContactRow(figRaw, figW, figH, 4); // 0..figH-1
    const legBelow = figH - 1 - foundRow; // weicher Saum darunter (px)
    const fpx = (footx - bb.x0) * s; // Modellzentrum in der skalierten Figur
    const fpy = foundRow; // Bodenkontakt-Anker
    const px = Math.round(CANVAS / 2 - fpx);
    const py = Math.round(CANVAS * FOOT_FRAC - fpy);
    const clip = (px < 0 || py < 0 || px + figW > CANVAS || py + figH > CANVAS) ? '  <-- CLIP!' : '';

    // 512-Master schreiben (alte Sockel-Version vorher archivieren)
    const outPath = path.join(DST, `${t}.png`);
    if (fs.existsSync(outPath)) fs.copyFileSync(outPath, path.join(ARCHIVE, `${t}.png`));
    await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: figRaw, raw: { width: figW, height: figH, channels: 4 }, left: px, top: py }]).png().toFile(outPath);

    const ax = +((px + fpx) / CANVAS).toFixed(4);
    const ay = +((py + fpy) / CANVAS).toFixed(4);
    anchors[t] = [ax, ay];

    // Footprint aus dem Fundament-Band des NEUEN Masters (8..90px über dem Anker)
    const master = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const footYpx = py + fpy;
    const baseRun = widestRunInBand(master.data, CANVAS, CANVAS, Math.round(footYpx - 90), Math.round(footYpx - 8));
    const fullBB = await alphaBBox(master.data, CANVAS, CANVAS);
    const fullRun = fullBB.x1 - fullBB.x0 + 1;
    const baseTiles = baseRun / BUILDING_MASTER_PPU / WORLD_UNITS_PER_TILE;
    const fullTiles = fullRun / BUILDING_MASTER_PPU / WORLD_UNITS_PER_TILE;
    const foot = Math.max(1, Math.round(baseTiles));
    tiles[t] = foot;

    rows.push({ t, foot, baseTiles: +baseTiles.toFixed(2), fullTiles: +fullTiles.toFixed(2),
      widthWorld: meta.width_world, anchor: [ax, ay], softEdgeBelowPx: legBelow, clip: clip.trim() });
    console.log(`${t.padEnd(14)} foot ${foot}  Anker [${ax},${ay}]  (tiefster solider Pixel; weicher Saum darunter: ${legBelow}px)${clip}`);
  }

  // Anker gehört in die manifest.json (Rendering), der Footprint in die geteilte
  // Spiellogik-Quelle packages/shared/src/game/footprints.ts (BUILDING_FOOTPRINTS).
  console.log('\n=== PATCH-VORSCHLAG — anchor → manifest.json · tiles → packages/shared/.../footprints.ts (BUILDING_FOOTPRINTS) ===');
  for (const t of TYPES) {
    console.log(`  "${t}": anchor ${JSON.stringify(anchors[t])}  footprint [${tiles[t]}, ${tiles[t]}]`);
  }
  fs.writeFileSync(path.join(SRC, '_masters_report.json'), JSON.stringify({ anchors, tiles, rows }, null, 2));
  console.log('\nReport -> design/blender/_nosockel/_masters_report.json');
})();
