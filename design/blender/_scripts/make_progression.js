// Baut aus 5 Tier-Renders einen Progressions-Vergleichsstreifen auf dunklem BG
// (wie PROGRESSION_town_hall.png). Generisch für jedes Gebäude.
//
// Aufruf (node mit sharp aus vw_imgtools):
//   NODE_PATH=C:\Users\Ufuk\vw_imgtools\node_modules node make_progression.js \
//       <in_prefix> <out.png> "<Gebaeude-Titel>"
//   z.B.: node make_progression.js out_barr_tier PROGRESSION_barracks.png "Kaserne"
const sharp = require("sharp");
const path = require("path");

const inPrefix = process.argv[2] || "out_barr_tier";
const outFile = process.argv[3] || "PROGRESSION_barracks.png";
const title = process.argv[4] || "";

const CELL = 360;          // Bildkante je Tier
const LABEL_H = 46;        // Platz fürs Label
const PAD = 14;            // Rand um jede Zelle
const BG = { r: 43, g: 47, b: 56, alpha: 1 };  // #2b2f38 dunkelgrau

const TIER_LABELS = [
  "Tier 1 (Lv1-3): Holz",
  "Tier 2 (Lv4-6): Stein+Holz",
  "Tier 3 (Lv7-9): Sandstein-Burg",
  "Tier 4 (Lv10-12): Edel/Marmor",
  "Tier 5 (Lv13-15): Magie/Episch",
];

(async () => {
  const cellW = CELL + 2 * PAD;
  const cellH = CELL + LABEL_H + 2 * PAD;
  const stripW = cellW * 5;
  const stripH = cellH;

  // Hintergrund
  let base = sharp({
    create: { width: stripW, height: stripH, channels: 4, background: BG },
  });

  const composites = [];
  for (let i = 0; i < 5; i++) {
    const file = path.join(__dirname, `${inPrefix}${i + 1}.png`);
    const img = await sharp(file).resize(CELL, CELL, { fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    composites.push({ input: img, left: i * cellW + PAD, top: PAD });

    // Label als SVG
    const label = TIER_LABELS[i];
    const svg = Buffer.from(
      `<svg width="${cellW}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
         <text x="${cellW / 2}" y="22" font-family="Segoe UI, Arial, sans-serif"
               font-size="16" font-weight="600" fill="#e8e8ec"
               text-anchor="middle">${label.split(":")[0]}</text>
         <text x="${cellW / 2}" y="40" font-family="Segoe UI, Arial, sans-serif"
               font-size="14" fill="#aab0bd"
               text-anchor="middle">${label.split(":")[1].trim()}</text>
       </svg>`
    );
    composites.push({ input: svg, left: i * cellW, top: PAD + CELL });
  }

  await base.composite(composites).png().toFile(path.join(__dirname, outFile));
  console.log("WROTE", outFile, `${stripW}x${stripH}`);
})();
