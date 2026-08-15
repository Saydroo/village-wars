import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDeployBlocked,
  deployBlockedTiles,
  DEPLOY_OUTSIDE_RADIUS,
  type DeployZoneBuilding,
} from '../src/index';

const W = 20;
const H = 20;
const wall = (gx: number, gy: number): DeployZoneBuilding => ({ building_type: 'wall', gx, gy });
const blocked = (bs: DeployZoneBuilding[], x: number, y: number): boolean => isDeployBlocked(bs, x, y, W, H);

/** Geschlossener 1×1-Mauerring als Quadrat-Perimeter [lo..hi]×[lo..hi]. */
function ringWalls(lo: number, hi: number): DeployZoneBuilding[] {
  const out: DeployZoneBuilding[] = [];
  for (let x = lo; x <= hi; x++) { out.push(wall(x, lo)); out.push(wall(x, hi)); }
  for (let y = lo + 1; y < hi; y++) { out.push(wall(lo, y)); out.push(wall(hi, y)); }
  return out;
}

test('DEPLOY_OUTSIDE_RADIUS ist klein (Vorfeld bleibt bespielbar)', () => {
  assert.equal(DEPLOY_OUTSIDE_RADIUS, 1);
});

test('geschlossener Ring: GESAMTER Innenraum gesperrt (topologisch, keine Löcher)', () => {
  const ring = ringWalls(5, 9); // Innenraum [6..8]×[6..8]
  for (let y = 6; y <= 8; y++)
    for (let x = 6; x <= 8; x++)
      assert.equal(blocked(ring, x, y), true, `Innen-Loch bei (${x},${y})`);
  // Mauer-Kacheln selbst sind gesperrt (nicht AUF die Mauer deployen).
  assert.equal(blocked(ring, 5, 5), true);
  assert.equal(blocked(ring, 7, 5), true);
});

test('geschlossener Ring: außen frei — auch direkt neben der Mauer (Kern-Loop)', () => {
  const ring = ringWalls(5, 9);
  assert.equal(blocked(ring, 4, 7), false); // direkt links neben der Mauer, von außen
  assert.equal(blocked(ring, 7, 4), false); // direkt über der Mauer
  assert.equal(blocked(ring, 0, 0), false);
  assert.equal(blocked(ring, 15, 15), false);
});

test('Löcher-Test: Kantenmitte (früher das Loch) ist jetzt gesperrt — auch ohne Turm dort', () => {
  const ring = ringWalls(5, 9);
  // (7,6) = innen direkt an der oberen Kantenmitte, zwischen den Ecken. War der Bypass.
  assert.equal(blocked(ring, 7, 6), true);
  // Mit „Ecken-Türmen" identisch (Türme ändern am Innenraum nichts).
  const withTowers: DeployZoneBuilding[] = [
    ...ring,
    { building_type: 'watchtower', gx: 6, gy: 6 },
    { building_type: 'watchtower', gx: 8, gy: 8 },
  ];
  assert.equal(blocked(withTowers, 7, 6), true);
});

test('offener Ring (Bresche): Innenraum leckt → nicht mehr gesperrt', () => {
  const ring = ringWalls(5, 9).filter((w) => !(w.gx === 7 && w.gy === 5)); // obere Kantenmitte entfernt
  assert.equal(blocked(ring, 7, 7), false); // Innenraum jetzt vom Rand erreichbar
  assert.equal(blocked(ring, 7, 6), false);
});

test('tote Mauer öffnet den Innenraum (alive=false wie Bresche)', () => {
  const ring = ringWalls(5, 9).map((w) => (w.gx === 7 && w.gy === 5 ? { ...w, alive: false } : w));
  assert.equal(blocked(ring, 7, 7), false);
});

test('freistehendes Außen-Gebäude: kleiner Radius, Vorfeld bleibt frei', () => {
  const prod: DeployZoneBuilding[] = [{ building_type: 'gold_mine', gx: 14, gy: 14 }]; // 3×3, außen
  assert.equal(blocked(prod, 15, 15), true); // auf der Goldmine
  assert.equal(blocked(prod, 13, 14), true); // 1 Kachel Puffer
  assert.equal(blocked(prod, 12, 14), false); // 2 Kacheln weg = frei
  assert.equal(blocked(prod, 0, 0), false); // Vorfeld frei
});

test('lose Mauer ohne Ring: kein Radius — direkt daneben deployen geht', () => {
  const lone: DeployZoneBuilding[] = [wall(10, 10)];
  assert.equal(blocked(lone, 9, 10), false); // neben der Mauer
  assert.equal(blocked(lone, 11, 10), false);
});

test('kein Ring (frischer Spieler, nur Rathaus): nur kleiner Außen-Radius', () => {
  const th: DeployZoneBuilding[] = [{ building_type: 'town_hall', gx: 8, gy: 8 }]; // 4×4, kein Ring
  assert.equal(blocked(th, 8, 8), true); // auf dem Rathaus
  assert.equal(blocked(th, 12, 10), true); // Footprint-Rand (11) + 1 Puffer
  assert.equal(blocked(th, 13, 10), false); // 2 Kacheln hinter dem Footprint = frei
});

test('Float-Deploypunkt wird auf die Kachel abgebildet (Kachelmitte gx+0.5)', () => {
  const th: DeployZoneBuilding[] = [{ building_type: 'town_hall', gx: 8, gy: 8 }];
  assert.equal(isDeployBlocked(th, 8.5, 8.5, W, H), true); // Mitte von Kachel (8,8) = auf dem Rathaus
  assert.equal(isDeployBlocked(th, 8.9, 8.1, W, H), true); // irgendwo auf Kachel (8,8)
  assert.equal(isDeployBlocked(th, 13.5, 10, W, H), false); // Float im freien Vorfeld
});

test('deployBlockedTiles = isDeployBlocked, dublettenfrei & deterministisch', () => {
  const bs: DeployZoneBuilding[] = [...ringWalls(5, 9), { building_type: 'gold_mine', gx: 14, gy: 14 }];
  const a = deployBlockedTiles(bs, W, H);
  const b = deployBlockedTiles(bs, W, H);
  const keyset = new Set(a.map((t) => `${t.gx},${t.gy}`));
  assert.equal(keyset.size, a.length); // keine Dubletten
  assert.equal(a.length, b.length); // deterministisch (gleiche Ausgabe)
  for (const t of a) assert.equal(blocked(bs, t.gx, t.gy), true); // eine Wahrheit
  assert.ok(!keyset.has('0,0')); // Vorfeld nicht gelistet
});
