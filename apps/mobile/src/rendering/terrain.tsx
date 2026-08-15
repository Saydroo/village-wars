import React, { useMemo } from 'react';
import { Group, Path, Circle, LinearGradient, Shader, vec } from '@shopify/react-native-skia';
import { gridToScreen } from '@village-wars/shared';
import { groundEffect } from './shaders';

/**
 * Hübscher isometrischer Untergrund (Phase-6-Politur, CoC-Anmutung):
 * erhöhtes Gras-/Schlachtfeld-Plateau mit weichem Rand, gekacheltes Schachbrett
 * (subtile Schattierung) und ein paar Dekorationen (Bäume/Felsen). Performance:
 * Die vielen Kacheln werden zu EINEM kombinierten Pfad zusammengefasst (ein
 * Skia-Node), nicht als Hunderte Einzelobjekte — bleibt auch bei 30×30 günstig.
 */
interface Props {
  gridWidth: number;
  gridHeight: number;
  variant: 'grass' | 'battle';
  /** Animations-Uhr (ms) für den Boden-Shader (Wind-Schimmer). */
  clock?: number;
  /** Boden-Tönung eines aktiven Dorf-Theme-Skins (z. B. Frostlande). Rein kosmetisch. */
  tint?: string;
}

const PALETTE = {
  grass: { top: '#5a9f49', bottom: '#3f7d35', tile: '#0c2a0c', outer: '#2f5a27', edge: '#1f3d1a' },
  battle: { top: '#925046', bottom: '#6f3a33', tile: '#1a0805', outer: '#5a302c', edge: '#3a201c' },
} as const;

function diamond(gx: number, gy: number): string {
  const t = gridToScreen(gx + 0.5, gy);
  const r = gridToScreen(gx + 1, gy + 0.5);
  const b = gridToScreen(gx + 0.5, gy + 1);
  const l = gridToScreen(gx, gy + 0.5);
  return `M ${t.x} ${t.y} L ${r.x} ${r.y} L ${b.x} ${b.y} L ${l.x} ${l.y} Z`;
}

function fieldDiamond(gw: number, gh: number, margin: number): string {
  const a = gridToScreen(-margin, -margin);
  const b = gridToScreen(gw + margin, -margin);
  const c = gridToScreen(gw + margin, gh + margin);
  const d = gridToScreen(-margin, gh + margin);
  return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`;
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }): React.ReactElement {
  return (
    <Group>
      <Group transform={[{ scaleY: 0.34 }]} origin={vec(x, y)}>
        <Circle cx={x} cy={y} r={12 * s} color="#00000033" />
      </Group>
      <Path path={`M ${x - 2.5 * s} ${y} L ${x + 2.5 * s} ${y} L ${x + 2 * s} ${y - 14 * s} L ${x - 2 * s} ${y - 14 * s} Z`} color="#5a3d23" />
      <Circle cx={x} cy={y - 22 * s} r={12 * s} color="#2f6e2a" />
      <Circle cx={x - 7 * s} cy={y - 16 * s} r={8 * s} color="#357f31" />
      <Circle cx={x + 7 * s} cy={y - 16 * s} r={8 * s} color="#296324" />
      <Circle cx={x - 3 * s} cy={y - 27 * s} r={7 * s} color="#3f8f39" />
    </Group>
  );
}

function Rock({ x, y, s = 1 }: { x: number; y: number; s?: number }): React.ReactElement {
  return (
    <Group>
      <Group transform={[{ scaleY: 0.34 }]} origin={vec(x, y)}>
        <Circle cx={x} cy={y} r={10 * s} color="#00000030" />
      </Group>
      <Path path={`M ${x - 10 * s} ${y} L ${x - 4 * s} ${y - 9 * s} L ${x + 6 * s} ${y - 8 * s} L ${x + 11 * s} ${y} Z`} color="#7c828a" />
      <Path path={`M ${x - 4 * s} ${y - 9 * s} L ${x + 6 * s} ${y - 8 * s} L ${x + 2 * s} ${y - 3 * s} L ${x - 2 * s} ${y - 3 * s} Z`} color="#9aa0a8" />
      <Path path={`M ${x - 10 * s} ${y} L ${x - 4 * s} ${y - 9 * s} L ${x + 6 * s} ${y - 8 * s} L ${x + 11 * s} ${y} Z`} style="stroke" color="#454a50" strokeWidth={1.2} opacity={0.7} />
    </Group>
  );
}

function Tuft({ x, y, c }: { x: number; y: number; c: string }): React.ReactElement {
  return (
    <Group>
      <Path path={`M ${x} ${y} Q ${x - 3} ${y - 5} ${x - 4} ${y - 8}`} color={c} style="stroke" strokeWidth={1.6} strokeCap="round" />
      <Path path={`M ${x} ${y} Q ${x} ${y - 6} ${x + 0.5} ${y - 9}`} color={c} style="stroke" strokeWidth={1.6} strokeCap="round" />
      <Path path={`M ${x} ${y} Q ${x + 3} ${y - 5} ${x + 4} ${y - 8}`} color={c} style="stroke" strokeWidth={1.6} strokeCap="round" />
    </Group>
  );
}

function Flower({ x, y, c }: { x: number; y: number; c: string }): React.ReactElement {
  return (
    <Group>
      <Path path={`M ${x} ${y} L ${x} ${y - 5}`} color="#2f6e2a" style="stroke" strokeWidth={1.3} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + 0.4;
        return <Circle key={i} cx={x + Math.cos(a) * 2.4} cy={y - 6 + Math.sin(a) * 2.4} r={1.8} color={c} />;
      })}
      <Circle cx={x} cy={y - 6} r={1.5} color="#ffe08a" />
    </Group>
  );
}

function Pebble({ x, y, c }: { x: number; y: number; c: string }): React.ReactElement {
  return (
    <Group transform={[{ scaleY: 0.5 }]} origin={vec(x, y)}>
      <Circle cx={x} cy={y} r={3} color={c} />
      <Circle cx={x - 0.8} cy={y - 0.8} r={1} color={lighten(c, 0.25)} />
    </Group>
  );
}

function lighten(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (n: number) => Math.round(n + (255 - n) * a).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
}

/** Deterministischer PRNG (mulberry32) für reproduzierbare Streuung. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Terrain({ gridWidth, gridHeight, variant, clock = 0, tint }: Props): React.ReactElement {
  const pal = PALETTE[variant];

  const outer = useMemo(() => fieldDiamond(gridWidth, gridHeight, 2.2), [gridWidth, gridHeight]);
  const edge = useMemo(() => fieldDiamond(gridWidth, gridHeight, 0.55), [gridWidth, gridHeight]);
  const field = useMemo(() => fieldDiamond(gridWidth, gridHeight, 0), [gridWidth, gridHeight]);

  // Alle „dunklen" Schachbrett-Kacheln zu EINEM Pfad zusammenfassen.
  const darkTiles = useMemo(() => {
    let p = '';
    for (let gx = 0; gx < gridWidth; gx += 1) {
      for (let gy = 0; gy < gridHeight; gy += 1) {
        if ((gx + gy) % 2 === 0) p += diamond(gx, gy) + ' ';
      }
    }
    return p;
  }, [gridWidth, gridHeight]);

  const top = gridToScreen(gridWidth / 2, 0);
  const bottom = gridToScreen(gridWidth / 2, gridHeight);

  // Dekorationen auf dem Rand-Saum (feste, gleichmäßig gestreute Positionen).
  const decos = useMemo(() => {
    if (variant !== 'grass') return [];
    const m = 1.1;
    const spots: Array<{ x: number; y: number; kind: 'tree' | 'rock'; s: number }> = [];
    const push = (gx: number, gy: number, kind: 'tree' | 'rock', s: number) => {
      const c = gridToScreen(gx, gy);
      spots.push({ x: c.x, y: c.y, kind, s });
    };
    push(-m, gridHeight * 0.3, 'tree', 1.1);
    push(-m, gridHeight * 0.7, 'rock', 1);
    push(gridWidth + m, gridHeight * 0.25, 'tree', 0.9);
    push(gridWidth + m, gridHeight * 0.6, 'tree', 1.15);
    push(gridWidth * 0.3, -m, 'tree', 1);
    push(gridWidth * 0.7, -m, 'rock', 1.1);
    push(gridWidth * 0.35, gridHeight + m, 'rock', 0.9);
    push(gridWidth * 0.65, gridHeight + m, 'tree', 1.05);
    return spots;
  }, [gridWidth, gridHeight, variant]);

  // Streudeko über das Feld (Grasbüschel/Blumen/Kiesel) — deterministisch.
  const scatter = useMemo(() => {
    const rng = mulberry32(1337 + gridWidth * 31 + gridHeight);
    const items: Array<{ x: number; y: number; kind: 'tuft' | 'flower' | 'pebble'; c: string }> = [];
    const count = Math.min(70, Math.round(gridWidth * gridHeight * 0.09));
    const tuftCols = variant === 'grass' ? ['#3f8f39', '#347f31', '#54a84a'] : ['#7a4a40', '#6a3a32'];
    const flowerCols = ['#ff7eb6', '#ffd24a', '#9b7bff', '#ff8a5a'];
    for (let i = 0; i < count; i += 1) {
      const gx = rng() * gridWidth;
      const gy = rng() * gridHeight;
      const c = gridToScreen(gx, gy);
      const r = rng();
      const kind = variant === 'battle' ? 'pebble' : r < 0.62 ? 'tuft' : r < 0.84 ? 'flower' : 'pebble';
      const col =
        kind === 'tuft' ? tuftCols[Math.floor(rng() * tuftCols.length)]!
          : kind === 'flower' ? flowerCols[Math.floor(rng() * flowerCols.length)]!
            : variant === 'battle' ? '#3a2420' : '#8a8f86';
      items.push({ x: c.x, y: c.y, kind, c: col });
    }
    return items;
  }, [gridWidth, gridHeight, variant]);

  return (
    <Group>
      {/* Tiefer Rand (erhöhtes Plateau). */}
      <Path path={outer} color={pal.edge} />
      <Path path={edge} color={pal.outer} />
      {/* Hauptfläche: prozeduraler Boden-Shader (Fallback: Vertikal-Verlauf). */}
      <Path path={field}>
        {groundEffect ? (
          <Shader source={groundEffect} uniforms={{ u_time: clock / 1000, u_grass: variant === 'grass' ? 1 : 0 }} />
        ) : (
          <LinearGradient start={vec(top.x, top.y)} end={vec(bottom.x, bottom.y)} colors={[pal.top, pal.bottom]} />
        )}
      </Path>
      {/* Dorf-Theme-Skin: Boden-Tönung über die Hauptfläche (über Shader UND Verlauf). */}
      {tint ? <Path path={field} color={tint} opacity={0.34} /> : null}
      {/* Ohne Shader: Schachbrett-Kacheln als Iso-Hinweis. */}
      {!groundEffect && <Path path={darkTiles} color={pal.tile} opacity={variant === 'grass' ? 0.1 : 0.12} />}
      {/* Streudeko (Gras/Blumen/Kiesel). */}
      {scatter.map((d, i) =>
        d.kind === 'tuft' ? <Tuft key={`s${i}`} x={d.x} y={d.y} c={d.c} />
          : d.kind === 'flower' ? <Flower key={`s${i}`} x={d.x} y={d.y} c={d.c} />
            : <Pebble key={`s${i}`} x={d.x} y={d.y} c={d.c} />,
      )}
      {/* Rand-Dekoration (Bäume/Felsen). */}
      {decos.map((d, i) => (d.kind === 'tree' ? <Tree key={`d${i}`} x={d.x} y={d.y} s={d.s} /> : <Rock key={`d${i}`} x={d.x} y={d.y} s={d.s} />))}
    </Group>
  );
}
