import type { GameConfig, OnboardingStepDef } from '../types/gameConfig';
import type { OnboardingStepView } from '../types/api';

/**
 * Reine Onboarding-Logik (Roadmap P8): die geordnete Tutorial-Schrittfolge wird
 * STRIKT der Reihe nach abgeholt. Die Metrik-WERTE (Gebäudezahl, Armeegröße …)
 * liefert der Server live aus dem Spielstand (wie bei Achievements, keine Event-
 * Instrumentierung); hier ist nur die plattformunabhängige, testbare Auswertung.
 * Schritte/Belohnungen stammen aus der GameConfig (onboarding.steps).
 */

/** Geordnete Schrittfolge aus der Config (leer, falls nicht konfiguriert). */
export function getOnboardingSteps(config: GameConfig): OnboardingStepDef[] {
  return config.onboarding?.steps ?? [];
}

/** Schritt-Definition nach ID, oder undefined. */
export function getOnboardingStep(
  config: GameConfig,
  id: string,
): OnboardingStepDef | undefined {
  return getOnboardingSteps(config).find((s) => s.id === id);
}

/** Ein Schritt gilt als erfüllt, sobald sein Live-Wert das Ziel erreicht. */
export function isStepComplete(value: number, target: number): boolean {
  return value >= target;
}

/**
 * Index des aktuell offenen (nächsten abzuholenden) Schritts = Anzahl bereits
 * abgeholter Schritte. null, wenn alle Schritte abgeholt sind.
 */
export function activeStepIndex(steps: OnboardingStepDef[], claimedSteps: number): number | null {
  const clamped = Math.max(0, Math.min(claimedSteps, steps.length));
  return clamped >= steps.length ? null : clamped;
}

/** Anzeige-Sicht eines Schritts aus Definition + Live-Wert + Position + Abhol-Stand. */
export function buildOnboardingStepView(
  step: OnboardingStepDef,
  index: number,
  value: number,
  claimedSteps: number,
): OnboardingStepView {
  return {
    id: step.id,
    title: step.title,
    icon: step.icon,
    description: step.description,
    metric: step.metric,
    target: step.target,
    value,
    complete: isStepComplete(value, step.target),
    claimed: index < claimedSteps,
    active: index === claimedSteps,
    reward: step.reward,
  };
}
