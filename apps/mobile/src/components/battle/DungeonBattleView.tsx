import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import type { DungeonReplay, DungeonReplayUnit } from '@village-wars/shared';

/**
 * Spielt die deterministische Kampf-Aufzeichnung einer Dungeon-Welle animiert ab
 * (Skia): Spieler-Einheiten (blau) gegen NPC-Gegner (rot), Bewegung interpoliert,
 * HP-Balken, Sterben. Server-autoritativ — der Client zeigt nur das Replay. Nach
 * dem Abspielen (oder „Überspringen") wird onDone aufgerufen, das Ergebnis erscheint.
 */
interface Props {
  width: number;
  height: number;
  replay: DungeonReplay;
  isBoss: boolean;
  waveLabel: string;
  /** Angewandte Einheiten-Skins (eigene Spieler-Einheiten) je `unit_type`. */
  unitSkins?: Record<string, { primary?: string; accent?: string }>;
  onDone: () => void;
}

function color(side: 'player' | 'enemy', type: string, skinPrimary?: string): string {
  if (side === 'player') return skinPrimary ?? '#5a8dee';
  // Gegner-Töne leicht nach Rolle variieren.
  if (type.includes('archer')) return '#ff9f43';
  if (type.includes('knight')) return '#ee5253';
  if (type.includes('catapult')) return '#c44569';
  return '#e8505b';
}

export function DungeonBattleView({
  width,
  height,
  replay,
  isBoss,
  waveLabel,
  unitSkins,
  onDone,
}: Props): React.ReactElement {
  const frames = replay.frames;
  const [units, setUnits] = useState<DungeonReplayUnit[]>([]);
  const doneRef = useRef(false);

  // Sim-Feld-Grenzen aus allen Frames → Skalierung aufs Canvas.
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of frames) {
      for (const u of f.units) {
        if (u.x < minX) minX = u.x;
        if (u.x > maxX) maxX = u.x;
        if (u.y < minY) minY = u.y;
        if (u.y > maxY) maxY = u.y;
      }
    }
    if (!isFinite(minX)) return { minX: 0, maxX: 24, minY: 0, maxY: 24 };
    // etwas Rand
    return { minX: minX - 1.5, maxX: maxX + 1.5, minY: minY - 1.5, maxY: maxY + 1.5 };
  }, [frames]);

  const pad = 16;
  const fieldW = Math.max(1, bounds.maxX - bounds.minX);
  const fieldH = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width - pad * 2) / fieldW, (height - pad * 2) / fieldH);
  const offX = pad + ((width - pad * 2) - fieldW * scale) / 2;
  const offY = pad + ((height - pad * 2) - fieldH * scale) / 2;
  const sx = (x: number) => offX + (x - bounds.minX) * scale;
  const sy = (y: number) => offY + (y - bounds.minY) * scale;

  // Abspielgeschwindigkeit: immer in einer angenehmen Anzeigedauer abspielen.
  const lastT = frames.length > 0 ? frames[frames.length - 1]!.t : 0;
  const displaySeconds = Math.min(9, Math.max(1.6, lastT));
  const speed = lastT > 0 ? lastT / displaySeconds : 1;

  useEffect(() => {
    if (frames.length === 0) {
      const id = setTimeout(() => onDone(), 200);
      return () => clearTimeout(id);
    }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const realElapsed = (Date.now() - start) / 1000;
      const simT = realElapsed * speed;

      // Frame-Index finden (frames[i].t <= simT < frames[i+1].t).
      let i = 0;
      while (i < frames.length - 1 && frames[i + 1]!.t <= simT) i++;
      const a = frames[i]!;
      const b = frames[Math.min(i + 1, frames.length - 1)]!;
      const span = Math.max(1e-3, b.t - a.t);
      const alpha = Math.min(1, Math.max(0, (simT - a.t) / span));

      const bById = new Map(b.units.map((u) => [u.id, u] as const));
      const out = a.units.map((u) => {
        const nxt = bById.get(u.id);
        const x = nxt ? u.x + (nxt.x - u.x) * alpha : u.x;
        const y = nxt ? u.y + (nxt.y - u.y) * alpha : u.y;
        const hp = nxt ? u.hp + (nxt.hp - u.hp) * alpha : u.hp;
        return { ...u, x, y, hp };
      });
      setUnits(out);

      if (simT >= lastT + 0.15) {
        if (!doneRef.current) {
          doneRef.current = true;
          // kurzes Schlussbild, dann Ergebnis.
          setTimeout(() => onDone(), 450);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, lastT, speed, onDone]);

  const skip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const dotR = isBoss ? undefined : 6;

  return (
    <View style={[styles.overlay, { width, height }]}>
      <View style={styles.topBar}>
        <Text style={styles.waveText}>{waveLabel}</Text>
        <Pressable onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Überspringen ⏩</Text>
        </Pressable>
      </View>
      <Canvas style={{ width, height }}>
        <Group>
          {units.map((u) => {
            const cx = sx(u.x);
            const cy = sy(u.y);
            const isBossUnit = isBoss && u.side === 'enemy';
            const r = isBossUnit ? 13 : dotR ?? 6;
            const ratio = Math.max(0, Math.min(1, u.hp));
            const barW = isBossUnit ? 30 : 14;
            return (
              <Group key={u.id}>
                {u.side === 'enemy' ? (
                  <Circle cx={cx} cy={cy} r={r + 2} color="#00000055" />
                ) : null}
                <Circle cx={cx} cy={cy} r={r} color={color(u.side, u.unit_type, unitSkins?.[u.unit_type]?.primary)} />
                <Rect x={cx - barW / 2} y={cy - r - 6} width={barW} height={3} color="#000000aa" />
                <Rect
                  x={cx - barW / 2}
                  y={cy - r - 6}
                  width={barW * ratio}
                  height={3}
                  color={u.side === 'player' ? '#4ade80' : '#ff5a5a'}
                />
              </Group>
            );
          })}
        </Group>
      </Canvas>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#5a8dee' }]} />
          <Text style={styles.legendText}>Deine Armee</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#e8505b' }]} />
          <Text style={styles.legendText}>Gegner</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: '#0b1a12', borderRadius: 12, overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  waveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  skipBtn: {
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  skipText: { color: '#c9d1d9', fontSize: 12, fontWeight: '700' },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#c9d1d9', fontSize: 11 },
});
