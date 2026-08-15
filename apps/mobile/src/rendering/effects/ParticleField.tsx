import React from 'react';
import { Circle, Group, vec } from '@shopify/react-native-skia';
import type { Particle } from './particles';

/**
 * Rendert einen Partikel-Snapshot als einfache Skia-Primitive (Kreise/gestauchte
 * Ellipsen) — GPU-günstig, keine teuren Pfade. Wird INNERHALB der bestehenden
 * Canvas-Group (Welt-Koordinaten) gerendert, damit Partikel die Kamera-Transform
 * teilen. Münzen wirken durch horizontale Stauchung 3D (Spec 4).
 */
interface Props {
  particles: readonly Particle[];
  /** Zeit (ms) für die Münz-Rotation. */
  clock: number;
}

export function ParticleField({ particles, clock }: Props): React.ReactElement {
  return (
    <Group>
      {particles.map((p, i) => {
        const opacity = Math.max(0, Math.min(1, p.life));
        if (p.type === 'coin') {
          const squash = Math.abs(Math.sin(clock / 100 + p.spin));
          return (
            <Group key={i} transform={[{ scaleX: Math.max(0.15, squash) }]} origin={vec(p.x, p.y)}>
              <Circle cx={p.x} cy={p.y} r={p.size} color={p.color} opacity={opacity} />
              {/* Kleine weiße Glanzstelle oben links. */}
              <Circle cx={p.x - p.size * 0.3} cy={p.y - p.size * 0.3} r={p.size * 0.3} color="#ffffff" opacity={opacity * 0.7} />
            </Group>
          );
        }
        if (p.type === 'smoke') {
          // Rauch: weicher, größer werdend, schneller verblassend.
          return <Circle key={i} cx={p.x} cy={p.y} r={p.size * (1.6 - p.life * 0.6)} color={p.color} opacity={opacity * 0.5} />;
        }
        return <Circle key={i} cx={p.x} cy={p.y} r={p.size} color={p.color} opacity={opacity} />;
      })}
    </Group>
  );
}
