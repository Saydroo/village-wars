import type { EffectsConfig, ParticlePreset } from '@village-wars/shared';

/**
 * Ein einziges, wiederverwendbares Partikelsystem für alle Effekte
 * (Game-Juice-Spec, Abschnitt 4). Partikel sind einfache Kreise/Ellipsen —
 * keine teuren Pfade. Globale Obergrenze: `particle_cap` (ältester wird
 * verdrängt). Bei „Effekte reduzieren" gilt `particle_cap_reduced` und die
 * Preset-Anzahl wird halbiert.
 */

export type ParticleType = 'spark' | 'coin' | 'smoke' | 'star' | 'rune';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1.0 → 0.0
  decay: number; // Abnahme pro Frame
  size: number;
  color: string;
  gravity: number; // vy += gravity pro Frame
  type: ParticleType;
  spin: number;
}

const TYPE_FOR_PRESET: Record<string, ParticleType> = {
  upgradeBurst: 'spark',
  levelUpAura: 'star',
  coinRain: 'coin',
  hitSpark: 'spark',
  deploySpawn: 'spark',
  destroyBurst: 'smoke',
  magicAmbient: 'rune',
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Baut die Partikel eines Presets an Position (x, y). Reine Funktion —
 * das Verhalten (radial/Regen/Ring/…) lebt hier, die Zahlen im Config-Preset.
 */
export function buildPreset(
  name: string,
  preset: ParticlePreset,
  x: number,
  y: number,
  reduce: boolean,
): Particle[] {
  const type = TYPE_FOR_PRESET[name] ?? 'spark';
  const count = Math.max(1, Math.round(reduce ? preset.count / 2 : preset.count));
  const out: Particle[] = [];

  for (let i = 0; i < count; i += 1) {
    const size = rand(preset.size_min, preset.size_max);
    const color = pick(preset.colors);
    let vx = 0;
    let vy = 0;
    let px = x;
    let py = y;

    switch (name) {
      case 'coinRain': {
        // Münzen fallen von oben über der Quelle, leichte Streuung.
        px = x + rand(-26, 26);
        py = y - rand(20, 70);
        vx = rand(-0.4, 0.4);
        vy = rand(0.4, 1.2) * preset.speed;
        break;
      }
      case 'levelUpAura': {
        // Ring, der nach außen wandert.
        const a = (i / count) * Math.PI * 2;
        vx = Math.cos(a) * preset.speed;
        vy = Math.sin(a) * preset.speed;
        break;
      }
      case 'deploySpawn': {
        // Aufwärts, dann fallend (Gravitation).
        const a = -Math.PI / 2 + rand(-0.8, 0.8);
        const s = rand(0.5, 1) * preset.speed;
        vx = Math.cos(a) * s;
        vy = Math.sin(a) * s;
        break;
      }
      case 'magicAmbient': {
        // Schweben langsam auf, leichte Seitwärtsdrift.
        px = x + rand(-16, 16);
        py = y + rand(-6, 6);
        vx = rand(-0.2, 0.2);
        vy = -rand(0.3, 0.8) * preset.speed;
        break;
      }
      default: {
        // Radialer Spritzer (upgradeBurst, hitSpark, destroyBurst).
        const a = rand(0, Math.PI * 2);
        const s = rand(0.35, 1) * preset.speed;
        vx = Math.cos(a) * s;
        vy = Math.sin(a) * s;
      }
    }

    out.push({
      x: px,
      y: py,
      vx,
      vy,
      life: 1,
      decay: preset.decay * rand(0.8, 1.2),
      size,
      color,
      gravity: preset.gravity,
      type,
      spin: rand(0, Math.PI * 2),
    });
  }
  return out;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private cap: number;
  private reduce: boolean;

  constructor(
    private config: EffectsConfig,
    reduce = false,
  ) {
    this.reduce = reduce;
    this.cap = reduce ? config.particle_cap_reduced : config.particle_cap;
  }

  setReduce(reduce: boolean): void {
    this.reduce = reduce;
    this.cap = reduce ? this.config.particle_cap_reduced : this.config.particle_cap;
    this.enforceCap();
  }

  /** Löst ein benanntes Preset an (x, y) aus. Unbekannte Presets werden ignoriert. */
  emit(name: string, x: number, y: number): void {
    const preset = this.config.presets[name];
    if (!preset) return;
    this.add(buildPreset(name, preset, x, y, this.reduce));
  }

  /** Fügt fertige Partikel ein (für Sonderfälle). */
  add(parts: Particle[]): void {
    this.particles.push(...parts);
    this.enforceCap();
  }

  private enforceCap(): void {
    if (this.particles.length > this.cap) {
      // Ältester wird verdrängt.
      this.particles.splice(0, this.particles.length - this.cap);
    }
  }

  /** Ein Simulationsschritt (pro Frame). */
  step(): void {
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.2;
      p.life -= p.decay;
      if (p.life > 0) next.push(p);
    }
    this.particles = next;
  }

  isActive(): boolean {
    return this.particles.length > 0;
  }

  count(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
  }

  /** Aktueller Partikel-Snapshot fürs Rendern (nicht mutieren). */
  snapshot(): readonly Particle[] {
    return this.particles;
  }
}
