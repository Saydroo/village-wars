import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

/**
 * Bildschirmübergang (Game-Juice-Spec 6): keine harten Schnitte. Beim Wechsel
 * des `screenKey` blendet der Inhalt kurz aus/ein und schiebt leicht hoch
 * (Fade + Slide, 200–300 ms). Bei „Effekte reduzieren" ohne Animation.
 */
interface Props {
  screenKey: string;
  durationMs: number;
  reduceEffects: boolean;
  children: React.ReactNode;
}

export function ScreenFade({ screenKey, durationMs, reduceEffects, children }: Props): React.ReactElement {
  const opacity = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceEffects) {
      opacity.setValue(1);
      slide.setValue(0);
      return;
    }
    opacity.setValue(0);
    slide.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: durationMs, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: durationMs, useNativeDriver: true }),
    ]).start();
  }, [screenKey, durationMs, reduceEffects, opacity, slide]);

  return (
    <Animated.View style={[styles.fill, { opacity, transform: [{ translateY: slide }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
