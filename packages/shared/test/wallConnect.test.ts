import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWall,
  wallMask,
  wallConnectionAt,
  wallPredicate,
  WALL_N,
  WALL_E,
  WALL_S,
  WALL_W,
} from '../src/index';

test('classifyWall: isoliert (keine Nachbarn)', () => {
  const c = classifyWall(0);
  assert.equal(c.type, 'isolated');
  assert.equal(c.rotation, 0);
});

test('classifyWall: Enden (genau 1 Nachbar) mit Drehung nach Richtung', () => {
  assert.deepEqual([classifyWall(WALL_N).type, classifyWall(WALL_N).rotation], ['end', 0]);
  assert.deepEqual([classifyWall(WALL_E).type, classifyWall(WALL_E).rotation], ['end', 1]);
  assert.deepEqual([classifyWall(WALL_S).type, classifyWall(WALL_S).rotation], ['end', 2]);
  assert.deepEqual([classifyWall(WALL_W).type, classifyWall(WALL_W).rotation], ['end', 3]);
});

test('classifyWall: gerade (gegenüberliegende Nachbarn)', () => {
  const ns = classifyWall(WALL_N | WALL_S);
  assert.equal(ns.type, 'straight');
  assert.equal(ns.rotation, 0);
  const ew = classifyWall(WALL_E | WALL_W);
  assert.equal(ew.type, 'straight');
  assert.equal(ew.rotation, 1);
});

test('classifyWall: Ecken (benachbarte Nachbarn) mit Drehung', () => {
  assert.deepEqual([classifyWall(WALL_N | WALL_E).type, classifyWall(WALL_N | WALL_E).rotation], ['corner', 0]);
  assert.deepEqual([classifyWall(WALL_E | WALL_S).type, classifyWall(WALL_E | WALL_S).rotation], ['corner', 1]);
  assert.deepEqual([classifyWall(WALL_S | WALL_W).type, classifyWall(WALL_S | WALL_W).rotation], ['corner', 2]);
  assert.deepEqual([classifyWall(WALL_W | WALL_N).type, classifyWall(WALL_W | WALL_N).rotation], ['corner', 3]);
});

test('classifyWall: T-Stücke (3 Nachbarn) Drehung nach fehlender Seite', () => {
  assert.deepEqual([classifyWall(WALL_N | WALL_E | WALL_S).type, classifyWall(WALL_N | WALL_E | WALL_S).rotation], ['t', 0]); // ohne W
  assert.deepEqual([classifyWall(WALL_E | WALL_S | WALL_W).type, classifyWall(WALL_E | WALL_S | WALL_W).rotation], ['t', 1]); // ohne N
  assert.deepEqual([classifyWall(WALL_S | WALL_W | WALL_N).type, classifyWall(WALL_S | WALL_W | WALL_N).rotation], ['t', 2]); // ohne E
  assert.deepEqual([classifyWall(WALL_W | WALL_N | WALL_E).type, classifyWall(WALL_W | WALL_N | WALL_E).rotation], ['t', 3]); // ohne S
});

test('classifyWall: Kreuzung (4 Nachbarn)', () => {
  const c = classifyWall(WALL_N | WALL_E | WALL_S | WALL_W);
  assert.equal(c.type, 'cross');
});

test('wallMask: liest die 4 orthogonalen Nachbarn korrekt', () => {
  // Nur der Ost-Nachbar ist Mauer.
  const isWall = (x: number, y: number) => x === 6 && y === 5;
  assert.equal(wallMask(isWall, 5, 5), WALL_E);
  // Nord + Süd.
  const vert = (x: number, y: number) => x === 5 && (y === 4 || y === 6);
  assert.equal(wallMask(vert, 5, 5), WALL_N | WALL_S);
});

test('wallPredicate + wallConnectionAt: Ecke einer L-förmigen Linie', () => {
  // L: (5,5)-(6,5)-(7,5) waagerecht, dann (7,6)-(7,7) runter. Ecke bei (7,5).
  const walls = [
    { grid_x: 5, grid_y: 5 }, { grid_x: 6, grid_y: 5 }, { grid_x: 7, grid_y: 5 },
    { grid_x: 7, grid_y: 6 }, { grid_x: 7, grid_y: 7 },
  ];
  const isWall = wallPredicate(walls);
  assert.equal(wallConnectionAt(isWall, 6, 5).type, 'straight'); // Mitte der Waagerechten
  const corner = wallConnectionAt(isWall, 7, 5); // W-Nachbar (6,5) + S-Nachbar (7,6)
  assert.equal(corner.type, 'corner');
  assert.equal(corner.rotation, 2); // S+W
  assert.equal(wallConnectionAt(isWall, 5, 5).type, 'end'); // nur E-Nachbar
});

test('geschlossenes Rechteck: alle Segmente sind gerade oder Ecke, nichts isoliert', () => {
  const walls: Array<{ grid_x: number; grid_y: number }> = [];
  const lo = 10, hi = 14;
  for (let x = lo; x <= hi; x++) { walls.push({ grid_x: x, grid_y: lo }); walls.push({ grid_x: x, grid_y: hi }); }
  for (let y = lo + 1; y < hi; y++) { walls.push({ grid_x: lo, grid_y: y }); walls.push({ grid_x: hi, grid_y: y }); }
  const isWall = wallPredicate(walls);
  let corners = 0, straights = 0;
  for (const w of walls) {
    const c = wallConnectionAt(isWall, w.grid_x, w.grid_y);
    assert.ok(c.type === 'corner' || c.type === 'straight', `unerwartet: ${c.type} bei (${w.grid_x},${w.grid_y})`);
    if (c.type === 'corner') corners++; else straights++;
  }
  assert.equal(corners, 4); // genau 4 Ecken
  assert.equal(straights, walls.length - 4);
});
