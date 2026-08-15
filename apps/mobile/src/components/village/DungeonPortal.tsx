import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Group, Path, vec } from '@shopify/react-native-skia';

/**
 * Mystisches Dungeon-Portal als schwebendes Welt-Element am Kartenrand. Erscheint
 * nur, wenn der Dungeon geöffnet ist (Wochenend-Phase); ein Tap öffnet den
 * Dungeon-Screen. Eigener kleiner Skia-Canvas mit sanfter Pulsier-/Wirbel-Animation
 * (rendert unabhängig vom Dorf-Canvas → keine Mehrlast dort). Vertikale Ellipsen
 * werden über einen skalierten Group aus Kreisen gebaut (kein `Oval` nötig).
 */
interface Props {
  onPress: () => void;
}

const W = 116;
const H = 150;
const CX = W / 2;
const CY = 64;
const SQUASH = 0.64; // horizontale Stauchung → aufrechtes Portal

export function DungeonPortal({ onPress }: Props): React.ReactElement {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 0.18), 90);
    return () => clearInterval(id);
  }, []);

  const pulse = 0.5 + 0.5 * Math.sin(phase);
  // Iso-Steinplattform unter dem Portal.
  const plat = `M ${CX} ${CY + 30} L ${CX + 30} ${CY + 46} L ${CX} ${CY + 62} L ${CX - 30} ${CY + 46} Z`;
  const swirl = [0, 1, 2, 3, 4];

  return (
    <Pressable onPress={onPress} style={styles.wrap} hitSlop={10}>
      <Canvas style={{ width: W, height: H }}>
        {/* Plattform */}
        <Path path={plat} color="#241f3a" />
        <Path path={plat} style="stroke" color="#4a3f6b" strokeWidth={2} />
        {/* Portal-Ringe als gestauchte Kreise (vertikale Ellipsen) */}
        <Group transform={[{ scaleX: SQUASH }]} origin={vec(CX, CY)}>
          <Circle cx={CX} cy={CY} r={48} color={`rgba(170,68,255,${0.14 + 0.16 * pulse})`} />
          <Circle cx={CX} cy={CY} r={40} color={`rgba(0,204,255,${0.5 + 0.35 * pulse})`} />
          <Circle cx={CX} cy={CY} r={35} color="rgba(140,60,230,0.9)" />
          <Circle cx={CX} cy={CY} r={28} color="#160a2c" />
          {/* Wirbel-Funken (werden mitgestaucht → elliptische Bahn) */}
          {swirl.map((i) => {
            const a = phase * 1.7 + (i * Math.PI * 2) / 5;
            const rr = 8 + i * 4;
            return (
              <Circle
                key={i}
                cx={CX + Math.cos(a) * rr}
                cy={CY + Math.sin(a) * rr}
                r={2.2 + (i % 2)}
                color={`rgba(0,229,255,${0.55 + 0.35 * pulse})`}
              />
            );
          })}
        </Group>
        {/* Funke oben */}
        <Circle cx={CX} cy={CY - 32} r={2 + pulse * 2} color="#dcc4ff" />
      </Canvas>
      <Text style={styles.label}>🗝️ Dungeon</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  label: {
    color: '#d9bcff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -28,
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
});
