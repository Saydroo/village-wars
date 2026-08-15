import type { BuildingCategory, CommonBuildingConfig, FactionId, GameConfig, TargetPriority } from '../types/gameConfig';
import type {
  BattleBuilding,
  BattleHeroStats,
  BattleResult,
  BattleState,
  BattleStateUpdate,
  BattleUnit,
  UnitFacing,
  UnitVisualState,
} from '../types/combat';
import { mod } from './factions';
import { getUnitCombatStats } from './units';

/**
 * Reine, deterministische Echtzeit-Kampfsimulation (Phase 3). Server-autoritativ:
 * der Server ruft initBattleState einmalig auf, dann pro Tick stepBattle und
 * deployUnit bei Deploy-Events. Keine Zahl ist hartcodiert — alles aus der
 * GameConfig (combat, pvp, buildings_*, units_*, factions). Plattformunabhängig.
 */

const EPS = 1e-6;

/**
 * Distanz (Tiles), ab der eine Einheit eine offene Lücke als „passiert" wertet und
 * wieder auf ihr Endziel umschwenkt. Rein geometrische Toleranz für das
 * Bresche-Ansteuern (Option A) — kein Balance-Wert (analog zu EPS / den 0.5-Tile-
 * Toleranzen im übrigen Code).
 */
const GAP_PASS_DIST = 1.0;

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Gebäude-Kategorie aus Config ableiten (Roadmap P5) ----------------------

function getBuildingCategory(config: GameConfig, buildingType: string): BuildingCategory {
  const cats = config.unit_target_priorities?.building_categories;
  if (!cats) return 'other';
  if (cats.defense.includes(buildingType)) return 'defense';
  if (cats.resource.includes(buildingType)) return 'resource';
  if (cats.wall.includes(buildingType)) return 'wall';
  return 'other';
}

/** Ziel-Priorität einer Einheit aus der Config lesen. */
function getTargetPriority(config: GameConfig, unitType: string): TargetPriority {
  const prio = config.unit_target_priorities?.unit_priorities?.[unitType];
  if (prio === 'defense' || prio === 'resource' || prio === 'wall') return prio;
  return 'nearest';
}

// --- Gebäude-Werte aus der Config ableiten -----------------------------------

function commonBuildingDef(config: GameConfig, type: string): CommonBuildingConfig | null {
  const def = config.buildings_common[type];
  return def && typeof def === 'object' ? (def as CommonBuildingConfig) : null;
}

/** base_hp / Verteidigungswerte eines Gebäudetyps (gemeinsam ODER exklusiv). */
function buildingBaseStats(
  config: GameConfig,
  type: string,
  faction: FactionId,
): { base_hp: number | null; base_dps: number; range: number; is_defense: boolean } {
  const common = commonBuildingDef(config, type);
  if (common) {
    const dps = common.base_damage_per_second ?? 0;
    return {
      base_hp: typeof common.base_hp === 'number' ? common.base_hp : null,
      base_dps: dps,
      range: common.range_tiles ?? 0,
      is_defense: dps > 0,
    };
  }
  const ex = config.factions_exclusive_content[faction]?.exclusive_buildings.find(
    (b) => b.id === type,
  );
  if (ex) {
    return {
      base_hp: typeof ex.base_hp === 'number' ? ex.base_hp : null,
      base_dps: 0,
      range: 0,
      is_defense: false,
    };
  }
  return { base_hp: null, base_dps: 0, range: 0, is_defense: false };
}

function hpFallback(config: GameConfig, type: string): number {
  const map = config.combat.building_hp;
  const v = map[type];
  if (typeof v === 'number') return v;
  const def = map.default;
  return typeof def === 'number' ? def : 0;
}

/** Maximal-HP eines Gebäudes auf seiner Stufe inkl. Fraktions-Modifikatoren. */
function buildingMaxHp(
  config: GameConfig,
  type: string,
  level: number,
  faction: FactionId,
): number {
  const stats = buildingBaseStats(config, type, faction);
  const base = stats.base_hp ?? hpFallback(config, type);
  const growth = config.combat.building_hp_growth_per_level_percent;
  const lvl = Math.max(1, level);
  let hp = base * Math.pow(1 + growth / 100, lvl - 1);

  const m = config.factions[faction].modifiers;
  hp *= mod(m, 'building_hp_multiplier');
  if (type === 'wall') hp *= mod(m, 'wall_hp_multiplier');
  return Math.max(1, Math.round(hp));
}

function buildingDps(config: GameConfig, type: string, level: number, faction: FactionId): number {
  const stats = buildingBaseStats(config, type, faction);
  if (stats.base_dps <= 0) return 0;
  const growth = config.combat.defense_dps_growth_per_level_percent;
  return stats.base_dps * Math.pow(1 + growth / 100, Math.max(1, level) - 1);
}

// --- Initialisierung ---------------------------------------------------------

export interface DefenderBuildingInput {
  id: string;
  building_type: string;
  level: number;
  grid_x: number;
  grid_y: number;
}

export interface InitBattleParams {
  battleId: string;
  attackerId: string;
  attackerFaction: FactionId;
  defenderId: string | null;
  defenderFaction: FactionId;
  isBot: boolean;
  /** Verteidiger-Layout (nur Gebäude mit Stufe >= 1 zählen — Baustellen ignoriert). */
  defenderBuildings: DefenderBuildingInput[];
  /** Deploybare Angreifer-Armee (unit_type -> Anzahl). */
  army: Record<string, number>;
  /** Aus der Clan-Burg stationierte Verteidiger (unit_type -> Anzahl), optional. */
  defenderUnits?: Record<string, number>;
  /** Erforschte Truppen-Level des Angreifers (Roadmap P3; fehlt → Level 1 für alle). */
  attackerUnitLevels?: Record<string, number>;
  /** Einsatzbereiter Held des Angreifers (Roadmap P6); fehlt/null → kein Held im Kampf. */
  hero?: BattleHeroStats | null;
}

/** Spawn-Mittelpunkt der Verteidiger: Clan-Burg, sonst Gebäude-Schwerpunkt, sonst Grid-Mitte. */
function defenderSpawnCenter(buildings: BattleBuilding[]): { x: number; y: number } {
  const castle = buildings.find((b) => b.building_type === 'clan_castle');
  if (castle) return { x: castle.gx + 0.5, y: castle.gy + 0.5 };
  if (buildings.length > 0) {
    const sx = buildings.reduce((s, b) => s + b.gx + 0.5, 0) / buildings.length;
    const sy = buildings.reduce((s, b) => s + b.gy + 0.5, 0) / buildings.length;
    return { x: sx, y: sy };
  }
  return { x: 15, y: 15 };
}

/** Erzeugt die mobilen Verteidiger-Einheiten um den Spawn-Mittelpunkt (deterministisch). */
function spawnDefenders(
  config: GameConfig,
  defenderUnits: Record<string, number>,
  faction: FactionId,
  center: { x: number; y: number },
): BattleUnit[] {
  const out: BattleUnit[] = [];
  let i = 0;
  for (const [type, qty] of Object.entries(defenderUnits)) {
    const stats = getUnitCombatStats(config, type, faction);
    if (!stats || qty <= 0) continue;
    for (let k = 0; k < qty; k++) {
      const angle = i * 2.399963; // goldener Winkel → gleichmäßige Streuung
      const r = 0.6 + 0.22 * Math.floor(i / 8);
      out.push({
        id: `d${i}`,
        unit_type: type,
        side: 'defender',
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
        hp: Math.round(stats.hp),
        max_hp: Math.round(stats.hp),
        dps: stats.dps,
        hps: stats.hps,
        range: stats.range,
        speed: stats.speed,
        splash: stats.splash,
        target_id: null,
        alive: true,
        target_priority: 'nearest',
      });
      i++;
    }
  }
  return out;
}

export function initBattleState(config: GameConfig, p: InitBattleParams): BattleState {
  const buildings: BattleBuilding[] = [];
  for (const b of p.defenderBuildings) {
    if (b.level < 1) continue; // im Bau: zählt nicht zur Verteidigung/Zerstörung
    const maxHp = buildingMaxHp(config, b.building_type, b.level, p.defenderFaction);
    const stats = buildingBaseStats(config, b.building_type, p.defenderFaction);
    buildings.push({
      id: b.id,
      building_type: b.building_type,
      level: b.level,
      gx: b.grid_x,
      gy: b.grid_y,
      hp: maxHp,
      max_hp: maxHp,
      is_defense: stats.is_defense,
      category: getBuildingCategory(config, b.building_type),
      dps: buildingDps(config, b.building_type, b.level, p.defenderFaction),
      range: stats.range,
      alive: true,
    });
  }

  const totalHp = buildings.reduce((s, b) => s + b.max_hp, 0);
  const defenders = p.defenderUnits
    ? spawnDefenders(config, p.defenderUnits, p.defenderFaction, defenderSpawnCenter(buildings))
    : [];

  // Reserve = deploybare Armee; einsatzbereiter Held kommt als 1 zusätzliche
  // Einheit hinzu (eigener Schlüssel, wird beim Deploy aus state.hero aufgelöst).
  const hero = p.hero ?? null;
  const reserve: Record<string, number> = { ...p.army };
  if (hero) reserve[hero.unit_type] = (reserve[hero.unit_type] ?? 0) + 1;

  return {
    battle_id: p.battleId,
    mode: 'solo',
    attacker_id: p.attackerId,
    attacker_faction: p.attackerFaction,
    defender_id: p.defenderId,
    defender_faction: p.defenderFaction,
    is_bot: p.isBot,
    units: [],
    defenders,
    buildings,
    reserve,
    attacker_unit_levels: { ...p.attackerUnitLevels },
    hero,
    total_building_hp: totalHp,
    destroyed_building_hp: 0,
    destruction_pct: 0,
    elapsed_seconds: 0,
    duration_seconds: config.pvp.match_duration_seconds,
    finished: false,
    result: null,
  };
}

// --- Deploy ------------------------------------------------------------------

let unitCounterFallback = 0;

export interface DeployResult {
  ok: boolean;
  reason?: string;
  unit?: BattleUnit;
}

/** Setzt eine Einheit der Reserve aufs Feld. Verbraucht 1 aus reserve[unit_type]. */
export function deployUnit(
  config: GameConfig,
  state: BattleState,
  input: { unit_type: string; x: number; y: number },
  makeId: () => string = () => `u${Date.now()}_${(unitCounterFallback += 1)}`,
): DeployResult {
  if (state.finished) return { ok: false, reason: 'Kampf beendet' };
  const remaining = state.reserve[input.unit_type] ?? 0;
  if (remaining <= 0) return { ok: false, reason: 'Keine Einheit dieses Typs mehr verfügbar' };

  // Held (Roadmap P6): eigene Stats aus state.hero statt aus der units-Config.
  let stats: { hp: number; dps: number; hps: number; range: number; speed: number; splash: boolean };
  if (state.hero && input.unit_type === state.hero.unit_type) {
    const h = state.hero;
    stats = { hp: h.hp, dps: h.dps, hps: h.hps, range: h.range, speed: h.speed, splash: h.splash };
  } else {
    const unitLevel = state.attacker_unit_levels?.[input.unit_type] ?? 1;
    const s = getUnitCombatStats(config, input.unit_type, state.attacker_faction, unitLevel);
    if (!s) return { ok: false, reason: 'Unbekannte Einheit' };
    stats = s;
  }

  const unit: BattleUnit = {
    id: makeId(),
    unit_type: input.unit_type,
    side: 'attacker',
    x: input.x,
    y: input.y,
    hp: Math.round(stats.hp),
    max_hp: Math.round(stats.hp),
    dps: stats.dps,
    hps: stats.hps,
    range: stats.range,
    speed: stats.speed,
    splash: stats.splash,
    target_id: null,
    alive: true,
    target_priority: getTargetPriority(config, input.unit_type),
    breach_id: null,
  };
  state.units.push(unit);
  state.reserve[input.unit_type] = remaining - 1;
  return { ok: true, unit };
}

// --- Simulation pro Tick -----------------------------------------------------

function nearestBuilding(state: BattleState, x: number, y: number): BattleBuilding | null {
  let best: BattleBuilding | null = null;
  let bestD = Infinity;
  for (const b of state.buildings) {
    if (!b.alive) continue;
    const d = dist(x, y, b.gx + 0.5, b.gy + 0.5);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * Wählt das Zielgebäude gemäß Ziel-Priorität (Roadmap P5).
 * Zeigt zuerst auf das nächste lebende Gebäude der bevorzugten Kategorie;
 * gibt es kein solches mehr, Fallback auf das nächste beliebige Gebäude.
 */
function priorityTarget(
  state: BattleState,
  x: number,
  y: number,
  priority: TargetPriority,
): BattleBuilding | null {
  if (priority !== 'nearest') {
    let best: BattleBuilding | null = null;
    let bestD = Infinity;
    for (const b of state.buildings) {
      if (!b.alive || b.category !== priority) continue;
      const d = dist(x, y, b.gx + 0.5, b.gy + 0.5);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) return best;
  }
  return nearestBuilding(state, x, y);
}

function nearestInList(
  list: BattleUnit[],
  x: number,
  y: number,
  maxRange: number,
): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestD = Infinity;
  for (const u of list) {
    if (!u.alive) continue;
    const d = dist(x, y, u.x, u.y);
    if (d <= maxRange + 0.5 && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/** Nächste lebende Angreifer-Einheit (für Verteidigungsgebäude + Verteidiger-Einheiten). */
function nearestUnit(state: BattleState, x: number, y: number, maxRange: number): BattleUnit | null {
  return nearestInList(state.units, x, y, maxRange);
}

/** Nächster lebender Clan-Burg-Verteidiger in Reichweite (für Angreifer-Zielwahl). */
function nearestDefender(state: BattleState, x: number, y: number, maxRange: number): BattleUnit | null {
  return nearestInList(state.defenders, x, y, maxRange);
}

/** Bewegt eine Einheit Richtung (tx,ty); greift an, sobald in Reichweite. Liefert true bei Angriff. */
function moveAndStrike(u: BattleUnit, tx: number, ty: number, dt: number): boolean {
  const d = dist(u.x, u.y, tx, ty);
  // EPS-Toleranz: ohne sie bleibt eine Einheit, die exakt auf Reichweite heranrückt,
  // durch Float-Rundung dauerhaft minimal "außer Reichweite" (d ≈ range + 1e-15) hängen
  // und greift nie an. Mit + EPS gilt sie als in Reichweite und schlägt zu.
  if (d > u.range + EPS) {
    const step = u.speed * dt;
    if (step >= d - u.range) {
      const ratio = (d - u.range) / (d || 1);
      u.x += (tx - u.x) * ratio;
      u.y += (ty - u.y) * ratio;
    } else {
      u.x += ((tx - u.x) / (d || 1)) * step;
      u.y += ((ty - u.y) / (d || 1)) * step;
    }
    return false;
  }
  return true;
}

/** Wendet Schaden auf eine Einheit an und markiert sie ggf. als gefallen. */
function damageUnit(u: BattleUnit, amount: number): void {
  if (!u.alive) return;
  u.hp -= amount;
  if (u.hp <= EPS) {
    u.hp = 0;
    u.alive = false;
  }
}

function damageBuilding(b: BattleBuilding, amount: number): void {
  if (!b.alive) return;
  b.hp -= Math.min(b.hp, amount);
  if (b.hp <= EPS) {
    b.hp = 0;
    b.alive = false;
  }
}

// --- Bresche-Ansteuern (Option A) --------------------------------------------
// Einheiten laufen nicht mehr stur ins jeweils nächste (Mauer-)Segment: Endziel ist
// bevorzugt ein Nicht-Mauer-Gebäude; blockiert eine lebende Mauer den direkten Weg,
// steuert die Einheit die beste Durchbruchsstelle bzw. eine bereits offene Lücke an.
// Bewusst KEIN vollwertiges Pathfinding / kein Belegungs-Grid für alle Gebäude /
// keine Line-of-Sight — nur Mauern zählen als Hindernis. Deterministisch: feste
// Array-Reihenfolge, strikt-kleinerer Score gewinnt, keine Set-Iteration.

/** Nächstes lebendes Gebäude, das ein Prädikat erfüllt (Distanz zum Mittelpunkt). */
function nearestWhere(
  state: BattleState,
  x: number,
  y: number,
  pred: (b: BattleBuilding) => boolean,
): BattleBuilding | null {
  let best: BattleBuilding | null = null;
  let bestD = Infinity;
  for (const b of state.buildings) {
    if (!b.alive || !pred(b)) continue;
    const d = dist(x, y, b.gx + 0.5, b.gy + 0.5);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * Endziel einer Angreifer-Einheit. Bevorzugt ein Nicht-Mauer-Gebäude (nach
 * Ziel-Priorität), damit die Mauer nur Hindernis auf dem Weg ist, kein Dauerziel.
 * Rammbock (priority 'wall') zielt weiter auf Mauern; sind nur noch Mauern übrig,
 * ebenfalls (sonst könnte der Kampf nicht enden).
 */
function pickEndTarget(state: BattleState, u: BattleUnit): BattleBuilding | null {
  if (u.target_priority === 'wall') return priorityTarget(state, u.x, u.y, 'wall');
  if (u.target_priority === 'defense' || u.target_priority === 'resource') {
    const pref = nearestWhere(state, u.x, u.y, (b) => b.category === u.target_priority);
    if (pref) return pref;
  }
  return nearestWhere(state, u.x, u.y, (b) => b.category !== 'wall') ?? nearestBuilding(state, u.x, u.y);
}

/**
 * Lebende Mauer-Tiles dieses Ticks als Lookup-Set (`"gx,gy"`). Bewusst 1× pro Tick
 * gebaut und über den Tick konstant (früh im Tick gefallene Segmente zählen erst
 * nächsten Tick als Lücke) — das ist deterministisch und reihenfolgeunabhängig.
 * Rückgabe null, wenn es keine lebende Mauer gibt → Bresche-Logik entfällt ganz.
 */
function buildLiveWallTiles(state: BattleState): Set<string> | null {
  let tiles: Set<string> | null = null;
  for (const b of state.buildings) {
    if (b.alive && b.category === 'wall') {
      (tiles ??= new Set<string>()).add(`${b.gx},${b.gy}`);
    }
  }
  return tiles;
}

/**
 * Supercover-Linien-Scan: true, wenn die Strecke (x0,y0)→(x1,y1) ein Tile berührt,
 * auf dem ein lebendes Mauersegment liegt. Deterministisch (feste Schrittzahl,
 * nur Set-Lookups — keine Iteration über das Set). Das Start-Tile der Einheit wird
 * ausgenommen, damit eine Einheit, die selbst in/an einem Mauer-Tile steht, nicht
 * fälschlich als „blockiert" gilt.
 */
function lineHitsLiveWall(
  wallTiles: Set<string>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < EPS) return false;
  const startKey = `${Math.floor(x0)},${Math.floor(y0)}`;
  const steps = Math.max(1, Math.ceil(len * 3)); // 3 Samples/Tile → lückenlos genug
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const key = `${Math.floor(x0 + dx * t)},${Math.floor(y0 + dy * t)}`;
    if (key !== startKey && wallTiles.has(key)) return true;
  }
  return false;
}

/**
 * Kosten einer Durchgangsstelle: Umweg (Einheit→Segment→Endziel) plus — falls das
 * Segment noch lebt — die als Weg-Äquivalent gerechnete Durchbruchszeit
 * (HP/DPS × Tempo). Eine bereits offene Lücke (totes Segment) kostet 0 Durchbruch
 * und wird daher bevorzugt.
 */
function passageScore(u: BattleUnit, w: BattleBuilding, ex: number, ey: number): number {
  const wx = w.gx + 0.5;
  const wy = w.gy + 0.5;
  const detour = dist(u.x, u.y, wx, wy) + dist(wx, wy, ex, ey);
  const breach = w.alive ? (w.hp / Math.max(u.dps, EPS)) * u.speed : 0;
  return detour + breach;
}

/** Beste Durchgangsstelle über alle Mauersegmente (min Score; Tie-Break = Array-Reihenfolge). */
function pickPassage(state: BattleState, u: BattleUnit, ex: number, ey: number): BattleBuilding | null {
  let best: BattleBuilding | null = null;
  let bestScore = Infinity;
  for (const b of state.buildings) {
    if (b.category !== 'wall') continue;
    const s = passageScore(u, b, ex, ey);
    if (s < bestScore) {
      bestScore = s;
      best = b;
    }
  }
  return best;
}

/**
 * Wie pickPassage, aber stabil (Anti-Zappel): eine committete Bresche
 * (`u.breach_id`) wird gehalten — ein lebendes Segment, bis es durchbrochen ist;
 * eine durchbrochene Lücke, bis die Einheit sie passiert hat. Erst dann wird neu
 * gewählt. Verhindert das Springen des Zwischenziels in konkaven Ecken.
 */
function resolvePassage(state: BattleState, u: BattleUnit, ex: number, ey: number): BattleBuilding | null {
  if (u.breach_id) {
    const cur = state.buildings.find((b) => b.id === u.breach_id);
    if (cur && cur.category === 'wall') {
      if (cur.alive) return cur; // noch am Durchbrechen → halten
      if (dist(u.x, u.y, cur.gx + 0.5, cur.gy + 0.5) > GAP_PASS_DIST) return cur; // Lücke noch nicht passiert
    }
    u.breach_id = null; // ungültig / passiert → neu bewerten
  }
  const w = pickPassage(state, u, ex, ey);
  u.breach_id = w ? w.id : null;
  return w;
}

/**
 * Bewegt die Einheit auf ein Zielgebäude zu und schlägt es in Reichweite (inkl.
 * Splash). Kapselt die bisherige Inline-Bewegungslogik, damit sie sowohl fürs
 * Endziel als auch fürs Durchbrechen einer Bresche gilt.
 */
function attackMoveBuilding(
  config: GameConfig,
  state: BattleState,
  u: BattleUnit,
  target: BattleBuilding,
  dt: number,
): void {
  u.target_id = target.id;
  const tx = target.gx + 0.5;
  const ty = target.gy + 0.5;
  const d = dist(u.x, u.y, tx, ty);
  if (d > u.range + EPS) {
    // Auf das Ziel zubewegen. (+ EPS: sonst bleibt die Einheit durch Float-Rundung
    // exakt auf Reichweite hängen und greift nie an — siehe moveAndStrike.)
    const step = u.speed * dt;
    if (step >= d - u.range) {
      const ratio = (d - u.range) / (d || 1);
      u.x += (tx - u.x) * ratio;
      u.y += (ty - u.y) * ratio;
    } else {
      u.x += ((tx - u.x) / (d || 1)) * step;
      u.y += ((ty - u.y) / (d || 1)) * step;
    }
  } else if (u.dps > 0) {
    damageBuilding(target, u.dps * dt);
    if (u.splash) {
      const r = config.combat.splash_radius_tiles;
      for (const b of state.buildings) {
        if (!b.alive || b.id === target.id) continue;
        if (dist(tx, ty, b.gx + 0.5, b.gy + 0.5) <= r) {
          damageBuilding(b, u.dps * dt * 0.5);
        }
      }
    }
  }
}

/**
 * Läuft als Wegpunkt zur offenen Lücke (kein Angriff) — der eigentliche Durchtritt
 * zum Endziel erfolgt, sobald die direkte Linie frei ist (spätestens, wenn die
 * Einheit die Lücke erreicht hat und resolvePassage die Bresche freigibt).
 */
function moveThroughGap(u: BattleUnit, gap: BattleBuilding, dt: number): void {
  u.target_id = null;
  const tx = gap.gx + 0.5;
  const ty = gap.gy + 0.5;
  const d = dist(u.x, u.y, tx, ty);
  if (d <= EPS) return;
  const step = u.speed * dt;
  const f = step >= d ? 1 : step / d;
  u.x += (tx - u.x) * f;
  u.y += (ty - u.y) * f;
}

/** Ein Simulationsschritt um dt Sekunden. Mutiert und liefert den State zurück. */
export function stepBattle(config: GameConfig, state: BattleState, dt: number): BattleState {
  if (state.finished) return state;
  state.elapsed_seconds += dt;

  // Lebende Mauer-Tiles einmal pro Tick (für das Bresche-Ansteuern der Angreifer).
  const liveWallTiles = buildLiveWallTiles(state);

  // 1) Einheiten: Ziel wählen, bewegen, angreifen / heilen.
  for (const u of state.units) {
    if (!u.alive) continue;

    // Heiler: heilt nächste verbündete, beschädigte Einheit in Reichweite.
    if (u.hps > 0) {
      const healRange = config.combat.healer_range_tiles;
      let ally: BattleUnit | null = null;
      let bestD = Infinity;
      for (const o of state.units) {
        if (!o.alive || o.id === u.id || o.hp >= o.max_hp) continue;
        const d = dist(u.x, u.y, o.x, o.y);
        if (d <= healRange && d < bestD) {
          bestD = d;
          ally = o;
        }
      }
      if (ally) ally.hp = Math.min(ally.max_hp, ally.hp + u.hps * dt);
    }

    // Clan-Burg-Verteidiger zuerst: kämpfende Einheiten greifen einen nahen
    // Verteidiger an, bevor sie sich um Gebäude kümmern (CoC-artig).
    if (u.dps > 0) {
      const foe = nearestDefender(state, u.x, u.y, config.combat.defender_aggro_radius_tiles);
      if (foe) {
        u.target_id = foe.id;
        if (moveAndStrike(u, foe.x, foe.y, dt)) {
          damageUnit(foe, u.dps * dt);
          if (u.splash) {
            const r = config.combat.splash_radius_tiles;
            for (const o of state.defenders) {
              if (!o.alive || o.id === foe.id) continue;
              if (dist(foe.x, foe.y, o.x, o.y) <= r) damageUnit(o, u.dps * dt * 0.5);
            }
          }
        }
        continue; // dieser Tick galt dem Verteidiger
      }
    }

    // Ziel + Bewegung mit Bresche-Ansteuern (Option A): Endziel bevorzugt ein
    // Nicht-Mauer-Gebäude; blockiert eine lebende Mauer den direkten Weg, wird die
    // beste Durchbruchsstelle bzw. eine bereits offene Lücke angesteuert, statt die
    // intakte Mauerlinie seitwärts abzuklopfen.
    const end = pickEndTarget(state, u);
    if (!end) {
      u.target_id = null;
      u.breach_id = null;
      continue;
    }
    if (end.category === 'wall') {
      // Endziel ist selbst eine Mauer (Rammbock oder nur noch Mauern übrig): direkt.
      u.breach_id = null;
      attackMoveBuilding(config, state, u, end, dt);
      continue;
    }
    const ex = end.gx + 0.5;
    const ey = end.gy + 0.5;
    if (!liveWallTiles || !lineHitsLiveWall(liveWallTiles, u.x, u.y, ex, ey)) {
      // Freie Bahn zum Endziel (keine Mauern oder direkte Linie ungehindert).
      u.breach_id = null;
      attackMoveBuilding(config, state, u, end, dt);
      continue;
    }
    // Mauer blockiert den direkten Weg: stabile Durchgangsstelle wählen/halten.
    const passage = resolvePassage(state, u, ex, ey);
    if (!passage) {
      attackMoveBuilding(config, state, u, end, dt); // Fallback (sollte nicht eintreten)
    } else if (passage.alive) {
      attackMoveBuilding(config, state, u, passage, dt); // schwächste Stelle durchbrechen
    } else {
      moveThroughGap(u, passage, dt); // offene Lücke durchlaufen → nächster Tick aufs Endziel
    }
  }

  // 1b) Clan-Burg-Verteidiger: nächsten Angreifer verfolgen, heilen, angreifen.
  for (const d of state.defenders) {
    if (!d.alive) continue;

    // Verteidiger-Heiler: heilt nächste beschädigte verbündete Verteidiger-Einheit.
    if (d.hps > 0) {
      const healRange = config.combat.healer_range_tiles;
      let ally: BattleUnit | null = null;
      let bestD = Infinity;
      for (const o of state.defenders) {
        if (!o.alive || o.id === d.id || o.hp >= o.max_hp) continue;
        const dd = dist(d.x, d.y, o.x, o.y);
        if (dd <= healRange && dd < bestD) {
          bestD = dd;
          ally = o;
        }
      }
      if (ally) ally.hp = Math.min(ally.max_hp, ally.hp + d.hps * dt);
    }

    const foe = nearestUnit(state, d.x, d.y, Infinity);
    if (!foe) {
      d.target_id = null;
      continue; // keine Angreifer auf dem Feld → abwarten
    }
    d.target_id = foe.id;
    if (moveAndStrike(d, foe.x, foe.y, dt) && d.dps > 0) {
      damageUnit(foe, d.dps * dt);
      if (d.splash) {
        const r = config.combat.splash_radius_tiles;
        for (const o of state.units) {
          if (!o.alive || o.id === foe.id) continue;
          if (dist(foe.x, foe.y, o.x, o.y) <= r) damageUnit(o, d.dps * dt * 0.5);
        }
      }
    }
  }

  // 2) Verteidigungsgebäude feuern auf die nächste Einheit in Reichweite.
  for (const b of state.buildings) {
    if (!b.alive || !b.is_defense || b.dps <= 0) continue;
    const u = nearestUnit(state, b.gx + 0.5, b.gy + 0.5, b.range);
    if (u) damageUnit(u, b.dps * dt);
  }

  // 3) Zerstörungs-Prozent aus dem Gebäude-Wahrheitszustand ableiten. Bewusst NICHT
  //    aus einem Schadens-Akkumulator (der durch Float-Summierung minimal driftet und
  //    eine volle Zerstörung als 99 % statt 100 % anzeigte): zerstörte Gebäude haben
  //    hp=0 und tragen damit exakt ihre max_hp bei → komplette Zerstörung = genau 100 %.
  let destroyed = 0;
  for (const b of state.buildings) destroyed += b.max_hp - b.hp;
  state.destroyed_building_hp = destroyed;
  state.destruction_pct =
    state.total_building_hp > 0
      ? Math.floor((Math.min(destroyed, state.total_building_hp) / state.total_building_hp) * 100)
      : 100;

  maybeFinish(config, state);
  return state;
}

function townHallDestroyed(state: BattleState): boolean {
  const th = state.buildings.find((b) => b.building_type === 'town_hall');
  return th ? !th.alive : false;
}

function allBuildingsDestroyed(state: BattleState): boolean {
  return state.buildings.every((b) => !b.alive);
}

function noOffenseLeft(state: BattleState): boolean {
  const liveUnits = state.units.some((u) => u.alive);
  const reserveLeft = Object.values(state.reserve).some((n) => n > 0);
  return !liveUnits && !reserveLeft;
}

/** Setzt finished/result, wenn eine Endbedingung erfüllt ist. */
export function maybeFinish(config: GameConfig, state: BattleState): void {
  if (state.finished) return;
  const timeUp = state.elapsed_seconds >= state.duration_seconds;
  const wiped = allBuildingsDestroyed(state) || state.total_building_hp === 0;
  const stuck = noOffenseLeft(state) && state.units.length > 0;

  if (wiped || timeUp || stuck) {
    state.finished = true;
    state.result = determineResult(config, state);
  }
}

/** Ergebnis aus Zerstörungs-Prozent (asymmetrisches Solo-PvP). */
export function determineResult(config: GameConfig, state: BattleState): BattleResult {
  const threshold = config.pvp.win_destruction_threshold_pct;
  if (state.destruction_pct >= threshold || townHallDestroyed(state)) {
    return 'attacker_win';
  }
  return 'defender_win';
}

// --- Loot & Trophäen ---------------------------------------------------------

export function computeLoot(
  config: GameConfig,
  defenderWood: number,
  defenderStone: number,
): { wood: number; stone: number } {
  const l = config.pvp.loot_on_victory;
  return {
    wood: Math.floor(defenderWood * (l.wood_percentage / 100)),
    stone: Math.floor(defenderStone * (l.stone_percentage / 100)),
  };
}

/**
 * Trophäen-Delta für den Angreifer (Elo-ähnlich, Abschnitt 8). diff =
 * Verteidiger - Angreifer (positiv: Gegner stärker). Geklemmt auf die in der
 * Config definierten min/max-Grenzen.
 */
export function computeTrophyDelta(
  config: GameConfig,
  result: BattleResult,
  attackerTrophies: number,
  defenderTrophies: number,
): number {
  if (result === 'draw') return 0;
  const t = config.pvp.trophy_change;
  const diff = defenderTrophies - attackerTrophies;
  const ratio = Math.max(-1, Math.min(1, diff / t.diff_scale_trophies));

  if (result === 'attacker_win') {
    const delta = ratio >= 0
      ? t.win_base + ratio * (t.win_max - t.win_base)
      : t.win_base + ratio * (t.win_base - t.win_min);
    return Math.round(delta);
  }
  // Niederlage: Magnitude zwischen loss_min (vs. Stärkere) und loss_max (vs. Schwächere).
  const baseMag = Math.abs(t.loss_base);
  const mag = ratio >= 0
    ? baseMag - ratio * (baseMag - t.loss_min_magnitude)
    : baseMag + -ratio * (t.loss_max_magnitude - baseMag);
  return -Math.round(mag);
}

/** Trophäen-Delta für den Verteidiger (gegenläufig, ohne unter 0 zu fallen). */
export function defenderTrophyDelta(attackerDelta: number, defenderTrophies: number): number {
  if (attackerDelta > 0) {
    // Angreifer gewann -> Verteidiger verliert (gespiegelt, aber gedämpft).
    return -Math.min(defenderTrophies, Math.round(attackerDelta * 0.75));
  }
  if (attackerDelta < 0) {
    // Angreifer verlor -> Verteidiger gewinnt etwas.
    return Math.round(-attackerDelta * 0.5);
  }
  return 0;
}

// --- Anim-Zustand + Blickrichtung (rein visuell, für die Client-Sprite-Wahl) --
// Deterministisch aus dem BESTEHENDEN Kampf-State abgeleitet (Ziel, Position,
// Reichweite, committete Bresche) — KEINE neue Kampf-Logik, keine State-Historie.
// Läuft im selben Tick wie toStateUpdate und spiegelt das Verhalten dieses Ticks.

/** Ruhende Einheit blickt zur Kamera (vorn-rechts). */
const DEFAULT_FACING: UnitFacing = 'az315';

/**
 * Quantisiert einen Grid-Bewegungsvektor auf die 4 vorhandenen Sprite-Facings.
 * Iso-Konvention (render.ts/gridToScreen, manifest _unit_poses_note): dominante
 * Achse gewinnt; +x→az315, -x→az225, +y→az45, -y→az135. Achsen-Gleichstand →
 * x-Achse (stabil/deterministisch, keine Set-Iteration).
 */
function quantizeFacing(dx: number, dy: number): UnitFacing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'az315' : 'az225';
  return dy >= 0 ? 'az45' : 'az135';
}

/** Weltposition des aktuell anvisierten Ziels (lebendes Gebäude ODER Einheit), sonst null. */
function targetPos(state: BattleState, u: BattleUnit): { x: number; y: number } | null {
  if (!u.target_id) return null;
  const b = state.buildings.find((o) => o.id === u.target_id);
  if (b) return b.alive ? { x: b.gx + 0.5, y: b.gy + 0.5 } : null;
  for (const list of [state.units, state.defenders]) {
    const eu = list.find((o) => o.id === u.target_id);
    if (eu) return eu.alive ? { x: eu.x, y: eu.y } : null;
  }
  return null;
}

/**
 * Leitet Anim-Zustand + Blickrichtung einer Einheit ab. Greift sie ein Ziel in
 * Reichweite an → attack (Blick zum Ziel); läuft sie auf ein Ziel bzw. eine offene
 * Mauerbresche zu → walk (Blick in Laufrichtung); sonst idle (Default-Blick). Die
 * Reichweiten-Schwelle ist exakt die der Simulation (moveAndStrike/attackMove).
 */
export function deriveUnitVisual(
  state: BattleState,
  u: BattleUnit,
): { state: UnitVisualState; facing: UnitFacing } {
  const tp = targetPos(state, u);
  if (tp) {
    const dx = tp.x - u.x;
    const dy = tp.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const facing = d > EPS ? quantizeFacing(dx, dy) : DEFAULT_FACING;
    return { state: d <= u.range + EPS ? 'attack' : 'walk', facing };
  }
  // Kein aktives Ziel, aber auf dem Weg durch eine committete (offene) Bresche →
  // die Einheit läuft (moveThroughGap setzt target_id=null, hält aber breach_id).
  if (u.breach_id) {
    const w = state.buildings.find((o) => o.id === u.breach_id);
    if (w) {
      const dx = w.gx + 0.5 - u.x;
      const dy = w.gy + 0.5 - u.y;
      if (Math.abs(dx) > EPS || Math.abs(dy) > EPS) {
        return { state: 'walk', facing: quantizeFacing(dx, dy) };
      }
    }
  }
  // ANTI-FLACKER: In dem Tick, in dem die Einheit ihr Ziel ZERSTÖRT (target_id
  // zeigt kurz auf ein totes Gebäude) oder frisch deployt ist (noch kein Ziel),
  // liefert targetPos null. Ohne diesen Fallback blitzte die Einheit für genau
  // einen Frame auf idle+Default-Blick (az315) auf — eine feuernde Einheit
  // (Rücken) sprang sichtbar auf die lockere Vorderansicht, während die
  // Schadenszahl lief. Die Einheit steuert aber im nächsten Tick sofort das
  // nächste lebende Gebäude an; das nehmen wir hier visuell vorweg (attack, wenn
  // es schon in Reichweite ist, sonst walk). Rein visuell, deterministisch aus
  // dem State — keine neue Kampf-Logik (die echte Zielwahl trifft stepBattle).
  const nb = nearestBuilding(state, u.x, u.y);
  if (nb) {
    const dx = nb.gx + 0.5 - u.x;
    const dy = nb.gy + 0.5 - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const facing = d > EPS ? quantizeFacing(dx, dy) : DEFAULT_FACING;
    return { state: d <= u.range + EPS ? 'attack' : 'walk', facing };
  }
  // Wirklich nichts mehr anzusteuern (keine lebenden Gebäude) → Ruhehaltung.
  return { state: 'idle', facing: DEFAULT_FACING };
}

// --- Client-Übertragung ------------------------------------------------------

/** Kompakter State für battle:state_update (nur das, was der Client rendert). */
export function toStateUpdate(state: BattleState): BattleStateUpdate {
  const mapUnit = (u: BattleUnit) => {
    const vis = deriveUnitVisual(state, u);
    return {
      id: u.id,
      unit_type: u.unit_type,
      side: u.side,
      x: Math.round(u.x * 100) / 100,
      y: Math.round(u.y * 100) / 100,
      hp: Math.round(u.hp),
      max_hp: u.max_hp,
      state: vis.state,
      facing: vis.facing,
    };
  };
  return {
    timer: Math.max(0, Math.ceil(state.duration_seconds - state.elapsed_seconds)),
    destruction_pct: state.destruction_pct,
    units: [
      ...state.units.filter((u) => u.alive).map(mapUnit),
      ...state.defenders.filter((u) => u.alive).map(mapUnit),
    ],
    buildings: state.buildings.map((b) => ({
      id: b.id,
      hp: Math.round(b.hp),
      max_hp: b.max_hp,
      alive: b.alive,
    })),
  };
}
