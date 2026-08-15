import React from 'react';
import { Group, Path } from '@shopify/react-native-skia';
import type { WallConnection } from '@village-wars/shared';

/**
 * MAUER-RENDERER — PHASE 2 (prozeduraler Vektor-Fallback, NICHT der Endstand).
 *
 * Zeichnet eine 1×1-Mauer connection-aware: zentraler Steinblock + je ein
 * Arm-Block zur Kachel-Kante Richtung jeder VERBUNDENEN Seite. Welche Seiten
 * verbunden sind, kommt ALLEIN aus der Shared-Logik (`WallConnection` aus
 * wallConnect.ts) — hier ist reine Optik. So ergeben sich gerade/Ecke/T/
 * Kreuzung/Ende/isoliert von selbst.
 *
 * Phase 3 ersetzt NUR diese Zeichnung durch die Blender-Sprite-Stücke
 * (Basisstück + Drehung nach `connection.type`/`.rotation`); die Nachbar-/
 * Verbindungslogik bleibt unangetastet.
 */

export interface WallSpriteProps {
  /** Screen-Fußpunkt = gridToScreen(Footprint-Zentrum), wie bei BuildingSprite. */
  cx: number;
  cy: number;
  connection: WallConnection;
  selected?: boolean;
}

type P = [number, number];

// Kanten-Mitten-Versatz (Screen) vom Kachel-Zentrum, halbe Kachel je Richtung.
// N=oben-rechts, E=unten-rechts, S=unten-links, W=oben-links (Iso-Diagonalen).
const EDGE: Record<'n' | 'e' | 's' | 'w', P> = {
  n: [16, -8],
  e: [16, 8],
  s: [-16, 8],
  w: [-16, -8],
};

const STONE = '#96917d';
const STONE_TOP = '#a8a389';
const STONE_LEFT = '#726e5e';
const STONE_RIGHT = '#565343';

function poly(points: P[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

/** Ein niedriger Iso-Steinblock (Top + linke/rechte Wand) um (x,y). */
function IsoBlock({ x, y, hw, hh, h, top, left, right }: {
  x: number; y: number; hw: number; hh: number; h: number;
  top: string; left: string; right: string;
}): React.ReactElement {
  const topFace: P[] = [[x, y - hh - h], [x + hw, y - h], [x, y + hh - h], [x - hw, y - h]];
  const leftFace: P[] = [[x - hw, y - h], [x, y + hh - h], [x, y + hh], [x - hw, y]];
  const rightFace: P[] = [[x, y + hh - h], [x + hw, y - h], [x + hw, y], [x, y + hh]];
  return (
    <Group>
      <Path path={poly(leftFace)} color={left} />
      <Path path={poly(rightFace)} color={right} />
      <Path path={poly(topFace)} color={top} />
    </Group>
  );
}

export function WallSprite({ cx, cy, connection }: WallSpriteProps): React.ReactElement {
  const arms: Array<'n' | 'e' | 's' | 'w'> = [];
  if (connection.n) arms.push('n');
  if (connection.e) arms.push('e');
  if (connection.s) arms.push('s');
  if (connection.w) arms.push('w');
  return (
    <Group>
      {arms.map((dir) => {
        const [dx, dy] = EDGE[dir];
        return (
          <IsoBlock key={dir} x={cx + dx} y={cy + dy} hw={17} hh={8.5} h={16}
            top={STONE_TOP} left={STONE_LEFT} right={STONE_RIGHT} />
        );
      })}
      {/* Zentraler Block zuletzt (etwas höher/größer → Ecke/Kreuzung sauber). */}
      <IsoBlock x={cx} y={cy} hw={18} hh={9} h={20}
        top={STONE_TOP} left={STONE} right={STONE_RIGHT} />
    </Group>
  );
}
