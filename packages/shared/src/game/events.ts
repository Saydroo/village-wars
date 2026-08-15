import type { GameConfig, EventDef, EventChallengeDef } from '../types/gameConfig';
import type { EventChallengeView } from '../types/api';

/**
 * Reine Logik für Limited-Time-Events (Roadmap P7-Folge). Bestimmt das aktuell
 * aktive Event-Fenster und wertet Aufgaben aus. Die Metrik-WERTE (gewonnene
 * Kämpfe/Dungeons SEIT Event-Start) liefert der Server aus dem Spielstand; hier
 * ist nur die plattformunabhängige, testbare Auswertung. Events/Belohnungen
 * stammen aus der GameConfig (events.definitions).
 */

/** Alle konfigurierten Events (leer, falls nicht konfiguriert). */
export function getEventDefinitions(config: GameConfig): EventDef[] {
  return config.events?.definitions ?? [];
}

/** true, wenn `now` im Aktiv-Fenster [starts_at, ends_at) des Events liegt. */
export function isEventActive(event: EventDef, now: Date): boolean {
  const start = Date.parse(event.starts_at);
  const end = Date.parse(event.ends_at);
  const t = now.getTime();
  return t >= start && t < end;
}

/**
 * Das aktuell aktive Event (erstes passendes Fenster), oder null. Bei mehreren
 * überlappenden Events gewinnt das zuerst definierte.
 */
export function getActiveEvent(config: GameConfig, now: Date): EventDef | null {
  for (const ev of getEventDefinitions(config)) {
    if (isEventActive(ev, now)) return ev;
  }
  return null;
}

/** Aufgaben-Definition nach ID innerhalb eines Events. */
export function getEventChallenge(
  event: EventDef,
  challengeId: string,
): EventChallengeDef | undefined {
  return event.challenges.find((c) => c.id === challengeId);
}

/** Eine Aufgabe gilt als erfüllt, sobald ihr Live-Wert das Ziel erreicht. */
export function isChallengeComplete(value: number, target: number): boolean {
  return value >= target;
}

/** Anzeige-Sicht einer Aufgabe aus Definition + Live-Wert + Abhol-Status. */
export function buildEventChallengeView(
  def: EventChallengeDef,
  value: number,
  claimed: boolean,
): EventChallengeView {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    metric: def.metric,
    target: def.target,
    value,
    complete: isChallengeComplete(value, def.target),
    claimed,
    reward: def.reward,
  };
}
