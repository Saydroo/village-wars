/**
 * HARNESS-BILD 4 (Vertical Slice Schritt 2.4) — Kontur-Archer als Standard.
 *
 * Links der PLAIN-Master (archer_base.png), rechts der neue Standard
 * (archer.png = dünne dunkle Kontur) — je bei mehreren Anzeigegrößen über einem
 * unruhigen Hintergrund. Zeigt, warum die Kontur der Standard ist: die
 * Silhouette hebt sich auch klein sauber ab. Der Renderer lädt bereits
 * archer.png (humanUnitAssets.ts) — es ist also live im Einsatz.
 *
 *   npx tsx tools/harness/outline_check.ts [vNN]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PX_PER_WORLD_UNIT, UNIT_MASTER_PPU } from '@village-wars/shared';
import { ASSETS, makeHarness } from './lib';

const VERSION = process.argv[2] ?? 'v01';

async function main(): Promise<void> {
  const W = 1100, H = 560;
  const h = await makeHarness(W, H, '#33502a');
  const { CK, canvas } = h;

  const dec = (p: string) => CK.MakeImageFromEncoded(fs.readFileSync(p));
  const plain = dec(path.join(ASSETS, 'units', 'archer_base.png'));
  const outline = dec(path.join(ASSETS, 'units', 'archer.png'));
  const paint = new CK.Paint(); paint.setAntiAlias(true);

  // Unruhiger Hintergrund (Streifen + Flecken), damit der Umriss zählt.
  const bp = new CK.Paint(); bp.setAntiAlias(true);
  for (let i = 0; i < 40; i++) {
    bp.setColor(CK.Color(40 + (i * 37) % 90, 70 + (i * 53) % 80, 30 + (i * 29) % 70, 1));
    canvas.drawRect(CK.XYWHRect((i * 53) % W, (i * 91) % H, 120, 40), bp);
  }
  bp.delete();

  // Master ~512 breit; Anzeigebreite aus dem gemeinsamen Weltmaßstab.
  const dispFor = (bodyBased512: number) => (512 / UNIT_MASTER_PPU) * PX_PER_WORLD_UNIT * bodyBased512;
  // Wir zeigen die realen Größen (Faktor 1 = App-Größe) plus kleinere.
  const factors = [1.3, 1.0, 0.7, 0.5];
  const drawCol = (img: any, x0: number, label: string) => {
    h.text(label, x0 - 150, 34, 22, '#f2f8e8');
    let y = 175;
    for (const f of factors) {
      const dispW = dispFor(f);
      const iw = img.width(), ih = img.height();
      const dispH = dispW * (ih / iw);
      // Anker unten-mitte-ish zum Ausrichten (nur Vergleich, kein Gameplay).
      canvas.drawImageRectOptions(
        img, CK.XYWHRect(0, 0, iw, ih),
        CK.XYWHRect(x0 - dispW / 2, y - dispH * 0.89, dispW, dispH),
        CK.FilterMode.Linear, CK.MipmapMode.Linear, paint,
      );
      h.text(`x${f}`, x0 + dispW / 2 + 10, y - 6, 14, '#dfeacb');
      y += 96;
    }
  };

  drawCol(plain, 320, 'PLAIN (archer_base.png)');
  drawCol(outline, 760, 'KONTUR = Standard (archer.png)');

  h.text('Vertical Slice 2.4 — Kontur-Archer als Standard-Asset (duenner dunkler Umriss, GROW 5px im 512-Master)',
    20, H - 20, 17, '#eaf2dc');

  const out = h.save(`vslice2_kontur_${VERSION}.png`);
  console.log('WROTE', out);
}

void main();
