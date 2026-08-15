import type { FloatingTextConfig } from '@village-wars/shared';

/**
 * Aufsteigende Zahlen (Floating Combat Text, Game-Juice-Spec 3.4).
 * Schadenszahlen, Ressourcengewinne und Trophäen steigen vom Ereignisort auf
 * und verblassen. Wird als RN-Text-Overlay in BILDSCHIRM-Koordinaten gerendert
 * (Skia-Text bräuchte Font-Loading); die Position wird beim Spawn aus der
 * aktuellen Kamera-Transform berechnet.
 */
export type FloatingKind = 'damage' | 'resource' | 'trophy_gain' | 'trophy_loss' | 'crit';

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: FloatingKind;
  color: string;
  size: number;
  life: number; // 1.0 → 0.0
}

let seq = 0;

export class FloatingTextSystem {
  private items: FloatingText[] = [];
  private cap = 40;

  constructor(private config: FloatingTextConfig) {}

  spawn(text: string, x: number, y: number, kind: FloatingKind = 'damage'): void {
    const color = this.config.colors[kind] ?? '#ffffff';
    const size = kind === 'crit' ? 22 : 15;
    seq += 1;
    this.items.push({ id: seq, x, y, text, kind, color, size, life: 1 });
    if (this.items.length > this.cap) this.items.splice(0, this.items.length - this.cap);
  }

  step(): void {
    const rise = this.config.rise_px_per_frame;
    const decay = this.config.life_decay_per_frame;
    const next: FloatingText[] = [];
    for (const f of this.items) {
      f.y -= rise;
      f.life -= decay;
      if (f.life > 0) next.push(f);
    }
    this.items = next;
  }

  isActive(): boolean {
    return this.items.length > 0;
  }

  clear(): void {
    this.items = [];
  }

  snapshot(): readonly FloatingText[] {
    return this.items;
  }
}
