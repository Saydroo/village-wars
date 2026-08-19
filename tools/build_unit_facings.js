/**
 * Menschen-Einheiten-FACING-MASTER (768) → 512-App-Assets herunterskalieren.
 * Reine App-Integration (kein Blender-Aufruf): die Blender-Renders liegen als
 *   design/blender/units/archer/menschen_archer_<state>_az<AZ>.png (768, transparent)
 * und werden proportional auf die 512-Leinwand skaliert nach
 *   apps/mobile/src/assets/factions/humans/units/archer_<state>_az<AZ>.png
 *
 * Konvention wie der bestehende Archer: quadratische Leinwand, proportionaler
 * lanczos3-Downscale → der Fußpunkt-ANKER (0..1) ist skalierungsinvariant und
 * stammt direkt aus dem Blender-ANCHOR-Output (archer_export_facing.py); er wird
 * getrennt in manifest.json → unit_poses gepflegt (NICHT hier neu berechnet).
 *
 *   node tools/build_unit_facings.js
 *
 * JOBS steuert, welche Facings (neu) erzeugt werden. Aktuell: attack (Aim-Fix
 * ROT_ALIGN(AZ) + pro-Facing FRONT_DEG(AZ)); idle/walk bleiben unangetastet.
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'design', 'blender', 'units', 'archer');
const DST = path.join(ROOT, 'apps', 'mobile', 'src', 'assets', 'factions', 'humans', 'units');
const CANVAS = 512;

const UNIT = 'archer';
const AZ = [45, 135, 225, 315];
// Zu (re)generierende Zustände. walk neu (Facing-Fix: pro-Facing FRONT_DEG_WALK,
// rigide Koerperdrehung az45=-90/az315=+90/az135=az225=0); idle/attack bleiben.
const STATES = ['walk'];

(async () => {
  const jobs = STATES.flatMap((state) => AZ.map((az) => ({ state, az })));
  for (const { state, az } of jobs) {
    const src = path.join(SRC, `menschen_${UNIT}_${state}_az${az}.png`);
    const dst = path.join(DST, `${UNIT}_${state}_az${az}.png`);
    if (!fs.existsSync(src)) {
      console.log(`FEHLT  ${path.basename(src)} — übersprungen`);
      continue;
    }
    await sharp(src)
      .resize(CANVAS, CANVAS, { kernel: 'lanczos3' })
      .png()
      .toFile(dst);
    console.log(`OK     ${path.basename(src)} → ${path.basename(dst)} (${CANVAS}²)`);
  }
  console.log('\nFacing-Master aktualisiert. Anker in manifest.json → unit_poses pflegen.');
})();
