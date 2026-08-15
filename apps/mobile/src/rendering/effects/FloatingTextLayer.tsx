import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FloatingText } from './floatingText';

/**
 * Rendert aufsteigende Zahlen als absolut positionierte RN-Texte über dem
 * Canvas (Bildschirm-Koordinaten). Leichter Schatten für Lesbarkeit auf jedem
 * Hintergrund. Liegt als `pointerEvents="none"`-Overlay über dem Canvas, damit
 * Taps weiter den Canvas treffen.
 */
interface Props {
  items: readonly FloatingText[];
  shadow: boolean;
}

export function FloatingTextLayer({ items, shadow }: Props): React.ReactElement {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((f) => (
        <Text
          key={f.id}
          style={[
            styles.text,
            shadow && styles.shadow,
            {
              left: f.x,
              top: f.y,
              color: f.color,
              fontSize: f.size,
              opacity: Math.max(0, Math.min(1, f.life)),
            },
          ]}
        >
          {f.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    fontWeight: '900',
    // Per transform um die eigene Mitte zentrieren (left/top = Ereignisort).
    transform: [{ translateX: -20 }],
  },
  shadow: {
    textShadowColor: '#000000cc',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
