// Baut aus N Level-Renders einen Streifen mit Custom-Labels (für Tier-interne Level-Stufen).
// Aufruf: node make_level_strip.js <out.png> "<Titel>" <img1>|<label1> <img2>|<label2> ...
const sharp = require("sharp");
const path = require("path");

const outFile = process.argv[2];
const title = process.argv[3] || "";
const items = process.argv.slice(4).map((s) => {
  const [file, label] = s.split("|");
  return { file, label: label || "" };
});

const CELL = 340, LABEL_H = 40, PAD = 14, TITLE_H = title ? 34 : 0;
const BG = { r: 43, g: 47, b: 56, alpha: 1 };

(async () => {
  const cellW = CELL + 2 * PAD, cellH = CELL + LABEL_H + 2 * PAD;
  const stripW = cellW * items.length, stripH = cellH + TITLE_H;
  const comps = [];
  if (title) {
    comps.push({ input: Buffer.from(
      `<svg width="${stripW}" height="${TITLE_H}" xmlns="http://www.w3.org/2000/svg">
         <text x="20" y="24" font-family="Segoe UI, Arial" font-size="20" font-weight="700"
               fill="#f0f0f4">${title}</text></svg>`), left: 0, top: 0 });
  }
  for (let i = 0; i < items.length; i++) {
    const img = await sharp(path.join(__dirname, items[i].file))
      .resize(CELL, CELL, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    comps.push({ input: img, left: i * cellW + PAD, top: TITLE_H + PAD });
    comps.push({ input: Buffer.from(
      `<svg width="${cellW}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
         <text x="${cellW/2}" y="26" font-family="Segoe UI, Arial" font-size="16" font-weight="600"
               fill="#e8e8ec" text-anchor="middle">${items[i].label}</text></svg>`),
      left: i * cellW, top: TITLE_H + PAD + CELL });
  }
  await sharp({ create: { width: stripW, height: stripH, channels: 4, background: BG } })
    .composite(comps).png().toFile(path.join(__dirname, outFile));
  console.log("WROTE", outFile, `${stripW}x${stripH}`);
})();
