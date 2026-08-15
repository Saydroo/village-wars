import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initBattleState,
  deployUnit,
  stepBattle,
  determineResult,
  computeLoot,
  computeTrophyDelta,
  defenderTrophyDelta,
  toStateUpdate,
  deriveUnitVisual,
  type BattleState,
  type DefenderBuildingInput,
  type InitBattleParams,
} from '../src/index';
import { cfg } from './helpers';

function townHall(gx = 15, gy = 15, level = 1): DefenderBuildingInput {
  return { id: 'th', building_type: 'town_hall', level, grid_x: gx, grid_y: gy };
}

function initState(overrides: Partial<InitBattleParams> = {}): BattleState {
  return initBattleState(cfg, {
    battleId: 'b1',
    attackerId: 'atk',
    attackerFaction: 'humans',
    defenderId: 'def',
    defenderFaction: 'humans',
    isBot: false,
    defenderBuildings: [townHall()],
    army: { militia: 1 },
    ...overrides,
  });
}

/** Spielt einen Kampf bis zum Ende (oder Ablauf) durch. */
function runBattle(state: BattleState): BattleState {
  const dt = 1 / cfg.combat.tick_rate_per_second;
  const maxTicks = Math.ceil(state.duration_seconds / dt) + 10;
  for (let i = 0; i < maxTicks && !state.finished; i++) stepBattle(cfg, state, dt);
  return state;
}

// --- Loot ---

test('computeLoot: Prozentsatz aus der Config (20% Holz/Stein)', () => {
  const l = cfg.pvp.loot_on_victory;
  const loot = computeLoot(cfg, 1000, 500);
  assert.equal(loot.wood, Math.floor(1000 * (l.wood_percentage / 100)));
  assert.equal(loot.stone, Math.floor(500 * (l.stone_percentage / 100)));
});

// --- Trophäen (Abschnitt 8: +28/+35/+18 bzw. −14/−22/−30) ---

test('computeTrophyDelta: Sieg — Basis / vs. Stärkere / vs. Schwächere', () => {
  const t = cfg.pvp.trophy_change;
  const scale = t.diff_scale_trophies;
  assert.equal(computeTrophyDelta(cfg, 'attacker_win', 1000, 1000), t.win_base);
  assert.equal(computeTrophyDelta(cfg, 'attacker_win', 0, scale), t.win_max); // Gegner +scale stärker
  assert.equal(computeTrophyDelta(cfg, 'attacker_win', scale, 0), t.win_min); // Gegner schwächer
});

test('computeTrophyDelta: Niederlage — Basis / vs. Stärkere / vs. Schwächere', () => {
  const t = cfg.pvp.trophy_change;
  const scale = t.diff_scale_trophies;
  assert.equal(computeTrophyDelta(cfg, 'defender_win', 1000, 1000), t.loss_base);
  assert.equal(computeTrophyDelta(cfg, 'defender_win', 0, scale), -t.loss_min_magnitude); // gegen Stärkere mild
  assert.equal(computeTrophyDelta(cfg, 'defender_win', scale, 0), -t.loss_max_magnitude); // gegen Schwächere hart
});

test('computeTrophyDelta: Unentschieden = 0', () => {
  assert.equal(computeTrophyDelta(cfg, 'draw', 100, 900), 0);
});

test('defenderTrophyDelta: gegenläufig, nie unter 0 Trophäen', () => {
  assert.equal(defenderTrophyDelta(28, 1000), -Math.round(28 * 0.75));
  assert.equal(defenderTrophyDelta(28, 5), -5); // auf vorhandene Trophäen geklemmt
  assert.equal(defenderTrophyDelta(-22, 1000), Math.round(22 * 0.5)); // Angreifer verlor → Verteidiger gewinnt
  assert.equal(defenderTrophyDelta(0, 1000), 0);
});

// --- initBattleState ---

test('initBattleState: Baustellen (Stufe 0) zählen nicht', () => {
  const state = initState({
    defenderBuildings: [townHall(), { id: 'lc', building_type: 'lumber_camp', level: 0, grid_x: 10, grid_y: 10 }],
  });
  assert.equal(state.buildings.length, 1);
  assert.equal(state.buildings[0]!.building_type, 'town_hall');
});

test('initBattleState: total_building_hp = Summe der Gebäude-HP, reserve = Armee', () => {
  const state = initState({ army: { militia: 7, archer: 3 } });
  const sum = state.buildings.reduce((s, b) => s + b.max_hp, 0);
  assert.equal(state.total_building_hp, sum);
  assert.ok(sum > 0);
  assert.deepEqual(state.reserve, { militia: 7, archer: 3 });
  assert.equal(state.destroyed_building_hp, 0);
  assert.equal(state.destruction_pct, 0);
});

test('initBattleState: Clan-Burg-Verteidiger werden gespawnt', () => {
  const state = initState({ defenderUnits: { militia: 3, archer: 2 } });
  assert.equal(state.defenders.length, 5);
  assert.ok(state.defenders.every((d) => d.side === 'defender' && d.alive));
  // Ohne defenderUnits keine Verteidiger.
  assert.equal(initState().defenders.length, 0);
});

// --- deployUnit ---

test('deployUnit: verbraucht Reserve, scheitert wenn leer', () => {
  const state = initState({ army: { militia: 2 } });
  assert.equal(deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 }).ok, true);
  assert.equal(state.reserve.militia, 1);
  assert.equal(state.units.length, 1);
  assert.equal(deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 }).ok, true);
  assert.equal(state.reserve.militia, 0);
  const fail = deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 });
  assert.equal(fail.ok, false);
  assert.match(fail.reason!, /verfügbar/);
});

test('deployUnit: unbekannte Einheit und beendeter Kampf scheitern', () => {
  const state = initState({ army: { militia: 1, phantom: 1 } });
  assert.equal(deployUnit(cfg, state, { unit_type: 'phantom', x: 1, y: 1 }).ok, false);
  state.finished = true;
  assert.equal(deployUnit(cfg, state, { unit_type: 'militia', x: 1, y: 1 }).ok, false);
});

// --- determineResult ---

test('determineResult: Zerstörung >= Schwelle → Angreifer-Sieg', () => {
  const state = initState();
  state.destruction_pct = cfg.pvp.win_destruction_threshold_pct;
  assert.equal(determineResult(cfg, state), 'attacker_win');
  state.destruction_pct = cfg.pvp.win_destruction_threshold_pct - 1;
  assert.equal(determineResult(cfg, state), 'defender_win');
});

test('determineResult: zerstörtes Rathaus = Sieg auch unter der Schwelle', () => {
  const state = initState();
  state.destruction_pct = 0;
  state.buildings.find((b) => b.building_type === 'town_hall')!.alive = false;
  assert.equal(determineResult(cfg, state), 'attacker_win');
});

// --- Vollständige Simulation ---

test('stepBattle: übermächtige Armee zerstört das Rathaus → Angreifer-Sieg', () => {
  const state = initState({ army: { militia: 40 } });
  for (let i = 0; i < 40; i++) deployUnit(cfg, state, { unit_type: 'militia', x: 15.5, y: 15.5 });
  runBattle(state);
  assert.equal(state.finished, true);
  assert.equal(state.result, 'attacker_win');
  assert.equal(state.destruction_pct, 100);
});

test('stepBattle: ABSEITS deployte Einheiten laufen heran und zerstören (Regression: Reichweiten-Lock)', () => {
  // Regression für den am Emulator gefundenen Bug: Nahkampf-Einheiten, die zu einem
  // entfernten Gebäude laufen müssen, blieben durch Float-Rundung exakt auf Reichweite
  // hängen (d ≈ range + 1e-15 > range) und griffen NIE an → 0 % über die volle Dauer.
  // Frühere Tests deployten immer DIREKT auf dem Gebäude und verfehlten ihn daher.
  for (const [x, y] of [[1, 1], [0, 0], [29, 29]] as const) {
    const state = initState({ army: { militia: 40 }, defenderBuildings: [townHall(15, 15)] });
    for (let i = 0; i < 40; i++) deployUnit(cfg, state, { unit_type: 'militia', x, y });
    runBattle(state);
    assert.equal(state.result, 'attacker_win', `Deploy @(${x},${y}) sollte gewinnen`);
    assert.equal(state.destruction_pct, 100, `Deploy @(${x},${y}) sollte 100 % zerstören`);
    // Muss deutlich vor Ablauf gewinnen (Heranlaufen + Zerstören, nicht Timeout).
    assert.ok(state.elapsed_seconds < state.duration_seconds, `Deploy @(${x},${y}) endete erst per Timeout`);
  }
});

test('stepBattle: einzelne Einheit gegen Kanone wird aufgerieben → Verteidiger-Sieg', () => {
  const state = initState({
    defenderBuildings: [townHall(15, 15), { id: 'cn', building_type: 'cannon', level: 1, grid_x: 15, grid_y: 16 }],
    army: { militia: 1 },
  });
  // Verteidigungsgebäude muss feuern können.
  assert.ok(state.buildings.some((b) => b.is_defense && b.dps > 0));
  deployUnit(cfg, state, { unit_type: 'militia', x: 15.5, y: 15.5 });
  runBattle(state);
  assert.equal(state.finished, true);
  assert.equal(state.result, 'defender_win');
  assert.ok(state.destruction_pct < cfg.pvp.win_destruction_threshold_pct);
});

// --- toStateUpdate ---

test('toStateUpdate: nur lebende Einheiten, Gebäude-HP gerundet', () => {
  const state = initState({ army: { militia: 2 } });
  deployUnit(cfg, state, { unit_type: 'militia', x: 1, y: 1 });
  deployUnit(cfg, state, { unit_type: 'militia', x: 2, y: 2 });
  state.units[0]!.alive = false; // einen "töten"
  const upd = toStateUpdate(state);
  assert.equal(upd.units.length, 1);
  assert.equal(upd.buildings.length, state.buildings.length);
  assert.ok(Number.isInteger(upd.buildings[0]!.hp));
  assert.ok(upd.timer <= state.duration_seconds);
});

// --- Anim-Zustand + Blickrichtung (deriveUnitVisual) ---

test('deriveUnitVisual: Blickrichtung — die 4 Iso-Facings aus der Zielrichtung', () => {
  const state = initState();
  const b = state.buildings[0]!; // town_hall
  const u = deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 }).unit!;
  u.target_id = b.id;
  const facingWhenTargetAt = (bx: number, by: number): string => {
    b.gx = bx;
    b.gy = by;
    return deriveUnitVisual(state, u).facing;
  };
  // Einheit bei (15,15); Ziel-Mitte = (bx+0.5, by+0.5). Dominante Grid-Achse → Facing.
  assert.equal(facingWhenTargetAt(25, 15), 'az315'); // +x → unten-rechts
  assert.equal(facingWhenTargetAt(5, 15), 'az225'); //  -x → oben-links
  assert.equal(facingWhenTargetAt(15, 25), 'az45'); //  +y → unten-links
  assert.equal(facingWhenTargetAt(15, 5), 'az135'); //  -y → oben-rechts
});

test('deriveUnitVisual: walk außer Reichweite, attack in Reichweite', () => {
  const state = initState();
  const b = state.buildings[0]!; // (15,15)
  const u = deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 25 }).unit!;

  u.target_id = b.id; // Ziel ~10 Tiles entfernt → läuft hin
  assert.equal(deriveUnitVisual(state, u).state, 'walk');

  // In Reichweite heranrücken (halbe Reichweite zum Ziel-Mittelpunkt) → schlägt zu.
  u.x = b.gx + 0.5;
  u.y = b.gy + 0.5 + u.range * 0.5;
  assert.equal(deriveUnitVisual(state, u).state, 'attack');
});

test('deriveUnitVisual: keine lebenden Gebäude → idle (Ruhehaltung, Default-Blick)', () => {
  const state = initState();
  state.buildings.forEach((b) => (b.alive = false)); // alles zerstört
  const u = deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 25 }).unit!;
  u.target_id = null;
  const vis = deriveUnitVisual(state, u);
  assert.equal(vis.state, 'idle');
  assert.equal(vis.facing, 'az315');
});

test('deriveUnitVisual: ANTI-FLACKER — Ziel zerstört, weiteres Gebäude da → kein idle', () => {
  // Regression: früher blitzte die Einheit für einen Frame auf idle+az315 auf,
  // sobald ihr Ziel fiel (target_id zeigte kurz auf ein totes Gebäude). Jetzt
  // nimmt sie sofort das nächste lebende Gebäude vorweg (walk/attack).
  const state = initState({
    defenderBuildings: [
      townHall(15, 15),
      { id: 'g2', building_type: 'gold_mine', level: 1, grid_x: 16, grid_y: 15 },
    ],
  });
  const th = state.buildings.find((b) => b.building_type === 'town_hall')!;
  const u = deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 }).unit!;
  u.target_id = th.id;
  th.alive = false; // Ziel gerade zerstört, gold_mine lebt noch
  const vis = deriveUnitVisual(state, u);
  assert.notEqual(vis.state, 'idle'); // KEIN Aufblitzen
  assert.ok(vis.state === 'attack' || vis.state === 'walk');
});

test('toStateUpdate: liefert state + facing je Einheit (gültige Enums)', () => {
  const state = initState({ army: { militia: 1 } });
  deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 25 });
  stepBattle(cfg, state, 0.1); // Zielwahl im Tick
  const u0 = toStateUpdate(state).units[0]!;
  assert.ok(['idle', 'walk', 'attack'].includes(u0.state));
  assert.ok(['az45', 'az135', 'az225', 'az315'].includes(u0.facing));
});

// --- Bresche-Ansteuern (Option A) ---

/** Horizontale Mauerlinie y=wy über x=[x0..x1] als einzelne 1×1-Segmente. */
function wallRow(wy: number, x0: number, x1: number): DefenderBuildingInput[] {
  const out: DefenderBuildingInput[] = [];
  for (let x = x0; x <= x1; x++) {
    out.push({ id: `w${x}_${wy}`, building_type: 'wall', level: 1, grid_x: x, grid_y: wy });
  }
  return out;
}

function runTicks(state: BattleState, maxTicks: number): void {
  const dt = 1 / cfg.combat.tick_rate_per_second;
  for (let i = 0; i < maxTicks && !state.finished; i++) stepBattle(cfg, state, dt);
}

test('stepBattle: Einheit nutzt vorhandene Bresche statt das intakte Segment auf der Linie abzuklopfen', () => {
  // Mauerlinie y=10, x=13..17; offene Bresche bei (14,10). Rathaus INNEN bei (15,5),
  // Einheit deployt AUSSEN bei (15,15) → die direkte Linie kreuzt das INTAKTE Segment
  // (15,10). Erwartung: die Einheit steuert die offene Lücke (14,10) an, erreicht das
  // Rathaus; das direkte Segment (15,10) bleibt unberührt.
  const state = initState({
    army: { militia: 1 },
    defenderBuildings: [townHall(15, 5), ...wallRow(10, 13, 17)],
  });
  const gap = state.buildings.find((b) => b.gx === 14 && b.gy === 10)!;
  gap.hp = 0;
  gap.alive = false; // Bresche bereits geschlagen
  const directSeg = state.buildings.find((b) => b.gx === 15 && b.gy === 10)!;
  const th = state.buildings.find((b) => b.building_type === 'town_hall')!;

  deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 });
  runTicks(state, 600);

  assert.ok(th.hp < th.max_hp, 'Rathaus sollte Schaden nehmen (Einheit kam durch die Lücke)');
  assert.equal(directSeg.alive, true, 'intaktes Segment (15,10) darf nicht durchbrochen werden');
  assert.equal(directSeg.hp, directSeg.max_hp, 'intaktes Segment (15,10) bleibt unberührt (Lücke genutzt)');
});

test('stepBattle: geschlossene Mauer wird durchbrochen (kein Dauer-Stillstand an der Mauer)', () => {
  // Voll intakte Mauerlinie zwischen Armee und Rathaus: die Einheiten müssen ein
  // Segment durchbrechen und das Rathaus erreichen, statt ewig davor zu stehen.
  const walls = wallRow(10, 13, 17);
  const state = initState({
    army: { militia: 30 },
    defenderBuildings: [townHall(15, 5), ...walls],
  });
  const th = state.buildings.find((b) => b.building_type === 'town_hall')!;
  for (let i = 0; i < 30; i++) deployUnit(cfg, state, { unit_type: 'militia', x: 15, y: 15 });
  runTicks(state, 1500);

  const breached = walls.some((w) => !state.buildings.find((b) => b.id === w.id)!.alive);
  assert.ok(breached, 'mindestens ein Mauersegment muss durchbrochen werden');
  assert.ok(th.hp < th.max_hp, 'Rathaus wird nach dem Durchbruch erreicht/beschädigt');
});

test('stepBattle: Determinismus — zwei identische Läufe ergeben bitgleiche Positionen (Bresche)', () => {
  // Replays erfordern strikten Determinismus: gleiche Eingabe → gleicher Verlauf.
  const build = (): BattleState => {
    const s = initState({ army: { militia: 5 }, defenderBuildings: [townHall(15, 5), ...wallRow(10, 13, 17)] });
    const seg = s.buildings.find((b) => b.gx === 14 && b.gy === 10)!;
    seg.hp = 0;
    seg.alive = false;
    for (let i = 0; i < 5; i++) deployUnit(cfg, s, { unit_type: 'militia', x: 15, y: 15 });
    return s;
  };
  const a = build();
  const b = build();
  runTicks(a, 120);
  runTicks(b, 120);
  const pos = (s: BattleState): string =>
    s.units.map((u) => `${u.x.toFixed(6)},${u.y.toFixed(6)},${u.hp}`).join('|') +
    '#' + s.buildings.map((bb) => `${bb.hp}`).join(',');
  assert.equal(pos(a), pos(b), 'zwei identische Läufe müssen exakt übereinstimmen');
});
