import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_FOOTPRINTS,
  footprintTiles,
  footprintCenter,
  footprintBounds,
  footprintContains,
} from '../src/index';

test('footprintTiles: bekannte Gebäude aus der geteilten Quelle', () => {
  assert.deepEqual(footprintTiles('town_hall'), [4, 4]);
  assert.deepEqual(footprintTiles('barracks'), [3, 3]);
  assert.deepEqual(footprintTiles('watchtower'), [2, 2]);
  assert.deepEqual(footprintTiles('wall'), [1, 1]);
  // gold_mine bewusst 3×3 (aktueller Laufzeitstand, keine 4×4-Vorwegnahme).
  assert.deepEqual(footprintTiles('gold_mine'), [3, 3]);
});

test('footprintTiles: unbekannter Typ → Default [1,1]', () => {
  assert.deepEqual(footprintTiles('gibtsnicht'), [1, 1]);
  assert.deepEqual(footprintTiles(''), [1, 1]);
});

test('footprintTiles: liefert eine frische, unabhängige Kopie (Quelle unveränderlich)', () => {
  const a = footprintTiles('town_hall');
  a[0] = 99;
  assert.deepEqual(footprintTiles('town_hall'), [4, 4]); // Quelle unberührt
  // Und die zurückgegebenen Arrays sind nicht dasselbe Objekt.
  assert.notEqual(footprintTiles('town_hall'), footprintTiles('town_hall'));
});

test('footprintCenter: Mitte der belegten Kacheln (kann .5 sein)', () => {
  // 4×4 an (10,10) → Zentrum (12,12).
  assert.deepEqual(footprintCenter('town_hall', 10, 10), [12, 12]);
  // 3×3 an (10,10) → Zentrum (11.5,11.5).
  assert.deepEqual(footprintCenter('barracks', 10, 10), [11.5, 11.5]);
  // 1×1 an (5,7) → Zentrum (5.5,7.5).
  assert.deepEqual(footprintCenter('wall', 5, 7), [5.5, 7.5]);
});

test('footprintBounds: halb-offene Box [minX,maxX) × [minY,maxY)', () => {
  assert.deepEqual(footprintBounds('town_hall', 3, 4), { minX: 3, minY: 4, maxX: 7, maxY: 8 });
  assert.deepEqual(footprintBounds('wall', 0, 0), { minX: 0, minY: 0, maxX: 1, maxY: 1 });
});

test('footprintContains: alle Footprint-Kacheln treffen, Rand halb-offen', () => {
  // town_hall 4×4 an (10,10) belegt x,y ∈ 10..13.
  assert.equal(footprintContains('town_hall', 10, 10, 10, 10), true); // Ursprung
  assert.equal(footprintContains('town_hall', 10, 10, 13, 13), true); // hintere Ecke
  assert.equal(footprintContains('town_hall', 10, 10, 12, 11), true); // innen
  assert.equal(footprintContains('town_hall', 10, 10, 14, 10), false); // eine Kachel zu weit (maxX exklusiv)
  assert.equal(footprintContains('town_hall', 10, 10, 9, 10), false); // links daneben
  assert.equal(footprintContains('town_hall', 10, 10, 10, 14), false); // maxY exklusiv
});

test('BUILDING_FOOTPRINTS: nur positive ganzzahlige Kantenlängen', () => {
  for (const [type, [w, h]] of Object.entries(BUILDING_FOOTPRINTS)) {
    assert.ok(Number.isInteger(w) && w >= 1, `${type}.w ungültig: ${w}`);
    assert.ok(Number.isInteger(h) && h >= 1, `${type}.h ungültig: ${h}`);
  }
});
