/**
 * Easing-Kurven (Game-Juice-Spec, Abschnitt 2). Lineare Bewegung wirkt
 * mechanisch — alle Animationen nutzen diese Kurven.
 *
 * Regel: Pop-Ins nutzen easeOutBack, anhaltende Bewegungen easeOutCubic,
 * Belohnungen easeOutElastic.
 */
export const EASING = {
  /** Überschwingen, für Pop-Ins (Dialoge, neue Gebäude, Belohnungs-Icons). */
  easeOutBack: (t: number): number => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  /** Weiches Auslaufen, für Bewegungen die anhalten. */
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  /** Sanft hin und zurück. */
  easeInOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  /** Federnd, für Belohnungen die Aufmerksamkeit wollen. */
  easeOutElastic: (t: number): number => {
    const c = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
} as const;

/** Lineare Interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Begrenzt t auf [0, 1]. */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
