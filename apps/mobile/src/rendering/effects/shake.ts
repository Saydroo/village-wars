import type { ScreenshakeConfig } from '@village-wars/shared';

/**
 * Screenshake (Game-Juice-Spec 3.1). Bei Einschlägen/Zerstörung wird die
 * gesamte Kamera-Transform kurz versetzt und klingt schnell aus. Bei „Effekte
 * reduzieren" ist der Shake deaktiviert (trigger wird zur No-Op).
 */
export type ShakeEvent = keyof Omit<ScreenshakeConfig, 'decay_per_frame' | 'min_intensity'>;

export class ScreenShake {
  private intensity = 0;
  private enabled = true;

  constructor(private config: ScreenshakeConfig) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.intensity = 0;
  }

  /** Löst einen Shake mit der Intensität des Ereignisses aus (max. gewinnt). */
  trigger(event: ShakeEvent): void {
    if (!this.enabled) return;
    const start = this.config[event] ?? 0;
    if (start > this.intensity) this.intensity = start;
  }

  /** Direkter Auslöser mit roher Intensität. */
  triggerRaw(value: number): void {
    if (!this.enabled) return;
    if (value > this.intensity) this.intensity = value;
  }

  step(): void {
    if (this.intensity <= 0) return;
    this.intensity *= this.config.decay_per_frame;
    if (this.intensity < this.config.min_intensity) this.intensity = 0;
  }

  /** Aktueller Kamera-Versatz (zufällig pro Frame). */
  offset(): { x: number; y: number } {
    if (this.intensity <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.intensity,
      y: (Math.random() * 2 - 1) * this.intensity,
    };
  }

  isActive(): boolean {
    return this.intensity > 0;
  }
}
