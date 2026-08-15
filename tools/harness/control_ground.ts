/**
 * KONTROLLBILD (Schatten weg + runde Basen erden) — sockellose Gebäude OHNE
 * Boden-Ellipse auf EINEM durchgehenden Dorf-Rasen. Mit Rasen-Referenzlinie
 * unter jedem Gebäude; ein Spalt wäre sofort sichtbar. Der Abstand
 * Bodenkontakt→Rasen wird pro Gebäude UNABHÄNGIG aus dem Master gemessen
 * (tiefster solider Pixel), Ziel 0 px. Runde Gebäude (watchtower, clan_castle)
 * sind ausdrücklich dabei.
 *
 * ALLE 12 Gebäude werden zusätzlich in der Konsole gemessen.
 *
 *   npx tsx tools/harness/control_ground.ts [vNN]
 */
import { buildingDisplayWidth, gridToScreen } from '@village-wars/shared';
import { assetPath, anchorOf, manifest, makeHarness, scaleBanner } from './lib';
import { footprint } from './village';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

const VERSION = process.argv[2] ?? 'v01';

/** Tiefster solider Pixel (alpha≥128, Lauf ≥2) = wahrer Bodenkontakt. */
function groundContactRow(data: Buffer, W: number, H: number): number {
  for (let y = H - 1; y >= 0; y--) {
    let n = 0;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] >= 128) n++;
    if (n >= 2) return y;
  }
  return H - 1;
}
/** Tiefster überhaupt sichtbarer Pixel (alpha>24) — inkl. weichem Saum. */
function lowestVisibleRow(data: Buffer, W: number, H: number): number {
  for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) return y;
  return H - 1;
}

async function measure(type: string): Promise<{ gapGround: number; gapSoft: number }> {
  const m = await sharp(assetPath('buildings', type)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const MW = m.info.width, MH = m.info.height;
  const [, ay] = anchorOf('buildings', type);
  const scale = buildingDisplayWidth(MW) / MW;
  const gapGround = (groundContactRow(m.data, MW, MH) - ay * MH) * scale;
  const gapSoft = (lowestVisibleRow(m.data, MW, MH) - ay * MH) * scale;
  return { gapGround, gapSoft };
}

async function main(): Promise<void> {
  // --- Konsole: ALLE 12 Gebäude ---
  console.log('Bodenkontakt→Rasen (px, Ziel 0) je Gebäude:');
  for (const type of Object.keys(manifest.buildings)) {
    const { gapGround, gapSoft } = await measure(type);
    console.log(`  ${type.padEnd(14)} Basis→Rasen ${gapGround.toFixed(1)}px   (weicher Saum ${gapSoft.toFixed(1)}px)`);
  }

  const W = 1680, H = 900;
  const h = await makeHarness(W, H, '#5f8f47');
  const { CK, canvas } = h;

  // --- Durchgehender Rasen ---
  const ORIGIN = { x: W / 2 - 210, y: 200 };
  const COLS = 28, ROWS = 16;
  const corner = (gx: number, gy: number): [number, number] => {
    const s = gridToScreen(gx, gy); return [ORIGIN.x + s.x, ORIGIN.y + s.y];
  };
  const gp = new CK.Paint(); gp.setAntiAlias(true); gp.setColor(CK.parseColorString('#67a24c'));
  const field = new CK.Path();
  const cc = [corner(0, 0), corner(COLS, 0), corner(COLS, ROWS), corner(0, ROWS)];
  field.moveTo(cc[0]![0], cc[0]![1]); for (let i = 1; i < 4; i++) field.lineTo(cc[i]![0], cc[i]![1]); field.close();
  canvas.drawPath(field, gp); gp.delete();
  const lp = new CK.Paint(); lp.setAntiAlias(true); lp.setStyle(CK.PaintStyle.Stroke); lp.setStrokeWidth(1); lp.setColor(CK.Color(30, 60, 20, 0.15));
  for (let gx = 0; gx <= COLS; gx++) { const a = corner(gx, 0), b = corner(gx, ROWS); const p = new CK.Path(); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); canvas.drawPath(p, lp); p.delete(); }
  for (let gy = 0; gy <= ROWS; gy++) { const a = corner(0, gy), b = corner(COLS, gy); const p = new CK.Path(); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); canvas.drawPath(p, lp); p.delete(); }
  lp.delete();

  // --- Vier Gebäude: die beiden RUNDEN (watchtower, clan_castle) + Rathaus + Lager mit Prop ---
  // gx+gy konstant (=12) → gleiche Bildschirmhöhe.
  const picks: Array<{ type: string; gx: number; gy: number }> = [
    { type: 'watchtower', gx: 1, gy: 11 },
    { type: 'clan_castle', gx: 6, gy: 6 },
    { type: 'town_hall', gx: 11, gy: 1 },
    { type: 'storage_stone', gx: 17, gy: -5 },
  ];

  for (const p of picks) {
    const f = footprint(p.type);
    const fv = gridToScreen(p.gx + f, p.gy + f);
    const cx = ORIGIN.x + fv.x, cy = ORIGIN.y + fv.y;
    const { gapGround, gapSoft } = await measure(p.type);

    h.drawSprite('buildings', p.type, cx, cy); // ohne Ellipse (lib zeichnet für Gebäude keinen Schatten)
    // Rasen-Referenzlinie (weiß) + gemessene Bodenkontakt-Marke (rot) auf cy.
    const rl = new CK.Paint(); rl.setColor(CK.parseColorString('#ffffff')); rl.setStyle(CK.PaintStyle.Stroke); rl.setStrokeWidth(2); rl.setAntiAlias(true);
    const ln = new CK.Path(); ln.moveTo(cx - 110, cy); ln.lineTo(cx + 110, cy); canvas.drawPath(ln, rl); ln.delete(); rl.delete();
    const fm = new CK.Paint(); fm.setColor(CK.parseColorString('#ff3b30')); fm.setStyle(CK.PaintStyle.Stroke); fm.setStrokeWidth(2); fm.setAntiAlias(true);
    const fmk = new CK.Path(); fmk.moveTo(cx - 55, cy + gapGround); fmk.lineTo(cx + 55, cy + gapGround); canvas.drawPath(fmk, fm); fmk.delete(); fm.delete();

    const round = p.type === 'watchtower' || p.type === 'clan_castle';
    h.text(`${p.type}${round ? ' (rund)' : ''}  ${f}x${f}`, cx - 60, cy + 66, 18, '#0d1a08');
    h.text(`Basis→Rasen: ${gapGround.toFixed(1)} px`, cx - 95, cy + 88, 16, '#0a1806');
  }

  h.text('Schatten entfernt + runde Basen geerdet — sockellose Gebaeude OHNE Ellipse auf durchgehendem Rasen', 24, 40, 23, '#0d1a08');
  h.text(scaleBanner(), 24, 66, 15, '#16290f');
  h.text('weisze Linie = Rasen · rote Marke = gemessener tiefster Basis-Pixel · Ziel: 0 px · watchtower & clan_castle = RUND', 24, 88, 15, '#16290f');

  const out = h.save(`vslice3_bodencheck_${VERSION}.png`);
  console.log('\nWROTE', out);
}

void main();
