/**
 * DEPLOY-SPERRZONE (Clash-Stil) — GETEILTE, REINE LOGIK für Server UND Client.
 *
 * Spiegelbild zu wallConnect.ts + footprints.ts: optik-unabhängige Spiellogik in
 * shared, die der server-autoritative Deploy-Check UND das Client-Overlay teilen.
 *
 * ANSATZ „INNENRAUM GESPERRT" (ersetzt die löcher-anfällige Radius-pro-Gebäude-
 * Logik im Inneren): Flood-Fill vom KARTENRAND über NICHT-Mauer-Kacheln. Alles,
 * was vom Rand aus NICHT erreichbar ist (weil ein geschlossener Mauerring den Weg
 * sperrt), gilt als „innen" und ist gesperrt — lückenlos, egal wo die Türme
 * stehen. Die Mauer-Kacheln selbst zählen ebenfalls als nicht-erreichbar (man
 * deployt neben die Mauer von AUSSEN, nicht auf sie).
 *
 * KOMBINIERT mit einem KLEINEN Radius um freistehende Gebäude AUSSERHALB der
 * Mauer (z. B. die äußere Produktion), damit man auch dort nicht direkt drauf
 * setzt, das Vorfeld aber bespielbar bleibt.
 *
 *  • Deterministisch: feste Nachbar-Reihenfolge, kein RNG; das Ergebnis ist die
 *    Randkomponente (reihenfolge-unabhängig).
 *  • Dynamisch: es zählen nur LEBENDE Mauern — fällt ein Segment (Bresche), leckt
 *    der Flood-Fill dort hindurch und der Innenraum dahinter öffnet sich (wie in
 *    Clash). Ist gar kein geschlossener Ring da (frischer Spieler / offene Base),
 *    gibt es keinen Innenraum → es bleibt allein der Außen-Radius (sauberer
 *    Rückfall auf das frühere Verhalten, ohne Ecken-Gebastel).
 *
 * `isDeployBlocked` ist die EINE Autorität: der Server prüft damit in
 * deployIntoBattle (nicht umgehbar), der Client lehnt den Tap damit vorab ab und
 * zeichnet die rote Zone über `deployBlockedTiles`. Kein zweiter Regelsatz.
 */

import { footprintBounds } from './footprints';
import type { GridPoint } from './render';

/**
 * Kleiner Puffer (Kacheln) um freistehende Gebäude AUSSERHALB der Mauer — reine
 * BALANCE-Zahl. Klein halten: verhindert das Setzen direkt auf Außen-Gebäuden,
 * lässt aber das Vorfeld bespielbar. (Der Innenraum wird topologisch gesperrt,
 * nicht per Radius — daher braucht es hier keinen großen Wert mehr.)
 */
export const DEPLOY_OUTSIDE_RADIUS = 1;

/** Minimale Gebäude-Form, die die Zone braucht (BattleBuilding erfüllt sie). */
export interface DeployZoneBuilding {
  building_type: string;
  gx: number;
  gy: number;
  /** Zerstörte Gebäude/Mauern zählen nicht mehr. Fehlt das Feld → als lebend gewertet. */
  alive?: boolean;
}

/** Feste Nachbar-Reihenfolge (E, W, S, N) → deterministischer Flood-Fill. */
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Flood-Fill von ALLEN Randkacheln über NICHT-Mauer-Kacheln (feste Reihenfolge).
 * Ergebnis: die Menge der vom Kartenrand erreichbaren Kacheln (= „außen").
 */
function reachableFromEdge(walls: ReadonlySet<string>, W: number, H: number): Set<string> {
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [];
  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = key(x, y);
    if (seen.has(k) || walls.has(k)) return;
    seen.add(k);
    stack.push([x, y]);
  };
  for (let x = 0; x < W; x++) {
    visit(x, 0);
    visit(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    visit(0, y);
    visit(W - 1, y);
  }
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of NEIGHBORS) visit(x + dx, y + dy);
  }
  return seen;
}

/** Ist das Gebäude „außerhalb der Mauer" (Ursprung vom Rand erreichbar)? */
function isOutside(b: DeployZoneBuilding, outside: ReadonlySet<string>): boolean {
  return outside.has(key(b.gx, b.gy));
}

/**
 * Berechnet EINMAL die Menge aller gesperrten Kacheln:
 *  (1) Innenraum + Mauer: alle Kacheln, die vom Rand NICHT erreichbar sind.
 *  (2) kleiner Radius um freistehende Gebäude AUSSERHALB der Mauer.
 * Nur LEBENDE Gebäude/Mauern zählen (Bresche öffnet den Innenraum).
 */
function computeBlocked(
  buildings: ReadonlyArray<DeployZoneBuilding>,
  W: number,
  H: number,
  outsideRadius: number,
): Set<string> {
  const walls = new Set<string>();
  for (const b of buildings) {
    if (b.alive !== false && b.building_type === 'wall') walls.add(key(b.gx, b.gy));
  }
  const outside = reachableFromEdge(walls, W, H);

  const blocked = new Set<string>();
  // (1) Innenraum + Mauer = alles, was NICHT vom Rand erreichbar ist.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (!outside.has(k)) blocked.add(k);
    }
  }
  // (2) kleiner Puffer um freistehende AUSSEN-Gebäude (Mauern erzeugen keinen Radius).
  for (const b of buildings) {
    if (b.alive === false || b.building_type === 'wall') continue;
    if (!isOutside(b, outside)) continue; // innen → bereits durch (1) gedeckt
    const f = footprintBounds(b.building_type, b.gx, b.gy);
    const x0 = Math.max(0, f.minX - outsideRadius);
    const x1 = Math.min(W, f.maxX + outsideRadius);
    const y0 = Math.max(0, f.minY - outsideRadius);
    const y1 = Math.min(H, f.maxY + outsideRadius);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) blocked.add(key(x, y));
    }
  }
  return blocked;
}

/**
 * Ist die Kachel (gx,gy) zum Deployen gesperrt? Autoritativ auf Server UND
 * Client. Braucht die Grid-Maße für den Flood-Fill.
 */
export function isDeployBlocked(
  buildings: ReadonlyArray<DeployZoneBuilding>,
  gx: number,
  gy: number,
  gridWidth: number,
  gridHeight: number,
  outsideRadius: number = DEPLOY_OUTSIDE_RADIUS,
): boolean {
  // Auf die Kachel abbilden: ein Deploy-Punkt kann als Float (z. B. Kachelmitte
  // gx+0.5) ankommen; die gesperrte Menge ist kachel-indiziert.
  return computeBlocked(buildings, gridWidth, gridHeight, outsideRadius).has(
    key(Math.floor(gx), Math.floor(gy)),
  );
}

/**
 * Alle gesperrten Kacheln (für das rote Client-Overlay) — dieselbe Rechnung wie
 * `isDeployBlocked`, nur als vollständige Liste. Overlay und Server-Regel bleiben
 * damit kachelgenau deckungsgleich.
 */
export function deployBlockedTiles(
  buildings: ReadonlyArray<DeployZoneBuilding>,
  gridWidth: number,
  gridHeight: number,
  outsideRadius: number = DEPLOY_OUTSIDE_RADIUS,
): GridPoint[] {
  const out: GridPoint[] = [];
  for (const k of computeBlocked(buildings, gridWidth, gridHeight, outsideRadius)) {
    const comma = k.indexOf(',');
    out.push({ gx: Number(k.slice(0, comma)), gy: Number(k.slice(comma + 1)) });
  }
  return out;
}
