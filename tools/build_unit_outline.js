/**
 * KONTUR-VARIANTE für Einheiten-Sprites (reine App-Integration — die
 * Blender-Assets bleiben unangetastet). Legt einen dünnen dunklen Umriss UNTER
 * die Figur, damit die Einheit bei Kleingröße/vor unruhigem Hintergrund lesbar
 * bleibt (Clash-of-Clans-„Sticker"-Look).
 *
 * Quelle = der PLAIN-Master `<unit>_base.png` (Blender-Render, unverändert),
 * Ziel = `<unit>.png` (das der Renderer via humanUnitAssets.ts lädt). So kann
 * die Kontur jederzeit neu erzeugt werden, ohne sich selbst zu verdicken.
 *
 * Umriss = Graustufen-Dilatation des Alpha-Kanals (Scheibe mit Radius GROW),
 * eingefärbt in ein dunkles Braun-Schwarz, dann Original darüber komponiert.
 *
 *   node tools/build_unit_outline.js [unit=archer] [grow=5]
 */
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const UNIT = process.argv[2] || 'archer';
const GROW = parseInt(process.argv[3] || '5', 10);
const DARK = [26, 20, 14]; // #1a140e — dunkles Braun-Schwarz
const DIR = path.join(__dirname, '..', 'apps', 'mobile', 'src', 'assets', 'factions', 'humans', 'units');
const SRC = path.join(DIR, `${UNIT}_base.png`);
const OUT = path.join(DIR, `${UNIT}.png`);

(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // Scheibenförmige Offsets für die Dilatation (Radius GROW).
  const disk = [];
  for (let dy = -GROW; dy <= GROW; dy++)
    for (let dx = -GROW; dx <= GROW; dx++)
      if (dx * dx + dy * dy <= GROW * GROW) disk.push([dx, dy]);

  const srcA = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) srcA[i] = data[i * C + 3];

  // grownA = Max des Alphas über die Scheibe (= Dilatation).
  const grownA = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (const [dx, dy] of disk) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const a = srcA[ny * W + nx];
        if (a > m) { m = a; if (m === 255) break; }
      }
      grownA[y * W + x] = m;
    }
  }

  // Ausgabe: dunkle Kontur (grownA) UNTEN, Original per „source-over" darüber.
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const sa = data[i * C + 3] / 255; // Original-Alpha 0..1
    const oa = grownA[i] / 255; // Kontur-Alpha 0..1
    const outA = sa + oa * (1 - sa);
    const mix = (sc, dc) => {
      // src (Original-Farbe sc) over dst (Kontur-Farbe dc), premultiplied korrekt
      const num = sc * sa + dc * oa * (1 - sa);
      return outA > 0 ? num / outA : 0;
    };
    out[i * 4 + 0] = Math.round(mix(data[i * C + 0], DARK[0]));
    out[i * 4 + 1] = Math.round(mix(data[i * C + 1], DARK[1]));
    out[i * 4 + 2] = Math.round(mix(data[i * C + 2], DARK[2]));
    out[i * 4 + 3] = Math.round(outA * 255);
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT);
  console.log(`OK: Kontur (GROW=${GROW}px) aus ${path.basename(SRC)} → ${path.basename(OUT)} (${W}x${H})`);
})();
