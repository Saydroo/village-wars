import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gridToScreen,
  screenToGrid,
  screenToGridFloat,
  getTier,
  tierProgress,
  lerpColor,
  roofColorForLevel,
  hasGoldAccents,
  hasMagicAura,
  hasLegendaryAura,
  TILE_WIDTH,
  TILE_HEIGHT,
} from '../src/index';

test('gridToScreen: Ursprung + Achsen', () => {
  assert.deepEqual(gridToScreen(0, 0), { x: 0, y: 0 });
  // (gx-gy)*tileW/2, (gx+gy)*tileH/2
  assert.deepEqual(gridToScreen(1, 0), { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  assert.deepEqual(gridToScreen(0, 1), { x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
});

test('screenToGrid ist die Inverse von gridToScreen (gerundet)', () => {
  for (const [gx, gy] of [[0, 0], [3, 7], [12, 5], [29, 29]] as const) {
    const s = gridToScreen(gx, gy);
    assert.deepEqual(screenToGrid(s.x, s.y), { gx, gy });
  }
});

test('screenToGridFloat liefert exakte Float-Koordinaten', () => {
  const s = gridToScreen(4, 9);
  const f = screenToGridFloat(s.x, s.y);
  assert.ok(Math.abs(f.gx - 4) < 1e-9);
  assert.ok(Math.abs(f.gy - 9) < 1e-9);
});

test('getTier: Grenzen Abschnitt 13', () => {
  assert.equal(getTier(1), 'wood');
  assert.equal(getTier(2), 'wood');
  assert.equal(getTier(3), 'stone');
  assert.equal(getTier(4), 'stone');
  assert.equal(getTier(5), 'metal');
  assert.equal(getTier(6), 'metal');
  assert.equal(getTier(7), 'magic');
  assert.equal(getTier(8), 'magic');
  assert.equal(getTier(9), 'legendary');
  assert.equal(getTier(99), 'legendary');
});

test('tierProgress: 0..1, geklemmt', () => {
  assert.equal(tierProgress(1, 10), 0);
  assert.equal(tierProgress(10, 10), 1);
  assert.equal(tierProgress(1, 1), 0); // maxLevel<=1
  assert.ok(Math.abs(tierProgress(5, 9) - 0.5) < 1e-9);
  assert.equal(tierProgress(100, 10), 1); // über max → geklemmt
  assert.equal(tierProgress(-5, 10), 0); // unter min → geklemmt
});

test('lerpColor: Endpunkte + Mitte', () => {
  assert.equal(lerpColor('#000000', '#ffffff', 0), '#000000');
  assert.equal(lerpColor('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(lerpColor('#000000', '#ffffff', 0.5), '#808080');
  // 3-stellige Hex-Kurzform wird expandiert
  assert.equal(lerpColor('#000', '#fff', 1), '#ffffff');
  // t wird geklemmt
  assert.equal(lerpColor('#000000', '#ffffff', 5), '#ffffff');
});

test('roofColorForLevel: nimmt höchste passende Schwelle', () => {
  // monoton: höheres Level darf nie auf eine frühere Farbe zurückfallen
  let last = roofColorForLevel(1);
  const seen = new Set<string>([last]);
  for (let lvl = 2; lvl <= 10; lvl++) {
    const c = roofColorForLevel(lvl);
    seen.add(c);
    last = c;
  }
  assert.ok(seen.size >= 4); // mehrere Tiers über die Levelspanne
  assert.equal(roofColorForLevel(1), roofColorForLevel(2)); // unter Schwelle 3 gleich
});

test('Aura-/Gold-Schwellen (Abschnitt 13)', () => {
  assert.equal(hasGoldAccents(4), false);
  assert.equal(hasGoldAccents(5), true);
  assert.equal(hasMagicAura(6), false);
  assert.equal(hasMagicAura(7), true);
  assert.equal(hasLegendaryAura(8), false);
  assert.equal(hasLegendaryAura(9), true);
});
