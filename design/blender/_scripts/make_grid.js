// Baut ein Grid aus den 15 Level-Renders: 5 Zeilen (Tiers) x 3 Spalten (Level je Tier).
// Aufruf: node make_grid.js <in_prefix> <out.png> "<Titel>"
const sharp = require("sharp");
const path = require("path");

const inPrefix = process.argv[2] || "out_barr_lvl";
const outFile = process.argv[3] || "GRID_barracks.png";
const title = process.argv[4] || "";

const CELL = 300, LBL = 28, PADX = 10, PADY = 8, TITLE_H = title ? 40 : 0, ROWLBL = 116;
const BG = { r: 43, g: 47, b: 56, alpha: 1 };
const TIER_NAMES = ["Tier 1 · Holz", "Tier 2 · Stein", "Tier 3 · Sandstein",
                    "Tier 4 · Marmor", "Tier 5 · Magie"];

(async () => {
  const cellW = CELL + 2 * PADX, cellH = CELL + LBL + 2 * PADY;
  const gridW = ROWLBL + cellW * 3, gridH = TITLE_H + cellH * 5;
  const comps = [];
  if (title) comps.push({ input: Buffer.from(
    `<svg width="${gridW}" height="${TITLE_H}" xmlns="http://www.w3.org/2000/svg">
       <text x="18" y="28" font-family="Segoe UI, Arial" font-size="22" font-weight="700"
             fill="#f0f0f4">${title}</text></svg>`), left: 0, top: 0 });

  for (let t = 0; t < 5; t++) {
    const rowTop = TITLE_H + t * cellH;
    // Tier-Label links (vertikal zentriert)
    comps.push({ input: Buffer.from(
      `<svg width="${ROWLBL}" height="${cellH}" xmlns="http://www.w3.org/2000/svg">
         <text x="14" y="${cellH/2}" font-family="Segoe UI, Arial" font-size="17" font-weight="700"
               fill="#cdd2dc">${TIER_NAMES[t].split("·")[0].trim()}</text>
         <text x="14" y="${cellH/2 + 22}" font-family="Segoe UI, Arial" font-size="14"
               fill="#8b92a0">${TIER_NAMES[t].split("·")[1].trim()}</text></svg>`),
      left: 0, top: rowTop });
    for (let s = 0; s < 3; s++) {
      const lv = t * 3 + s + 1;
      const f = String(lv).padStart(2, "0");
      const img = await sharp(path.join(__dirname, `${inPrefix}${f}.png`))
        .resize(CELL, CELL, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer();
      const left = ROWLBL + s * cellW;
      comps.push({ input: img, left: left + PADX, top: rowTop + PADY });
      comps.push({ input: Buffer.from(
        `<svg width="${cellW}" height="${LBL}" xmlns="http://www.w3.org/2000/svg">
           <text x="${cellW/2}" y="20" font-family="Segoe UI, Arial" font-size="15" font-weight="600"
                 fill="#e8e8ec" text-anchor="middle">Level ${lv}${s===0?" (Start)":s===2?" (max)":""}</text></svg>`),
        left, top: rowTop + PADY + CELL });
    }
  }
  await sharp({ create: { width: gridW, height: gridH, channels: 4, background: BG } })
    .composite(comps).png().toFile(path.join(__dirname, outFile));
  console.log("WROTE", outFile, `${gridW}x${gridH}`);
})();
