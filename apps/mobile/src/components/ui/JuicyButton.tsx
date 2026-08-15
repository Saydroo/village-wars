import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useAppStore } from '../../store';
import { playCue, type SoundCue } from '../../rendering/effects';

/**
 * Knopf-Druck-Feedback (Game-Juice-Spec 3.2, Priorität 1): der Knopf staucht
 * beim Antippen kurz (auf `button_press_scale`) und federt mit easeOutElastic
 * zurück. Plus optionaler Sound-Cue. Nutzt RN `Animated` (kein natives Modul →
 * kein Rebuild). Drop-in-Ersatz für `Pressable` mit identischer API.
 */
interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Sound-Cue beim Drücken (Standard: „button"). */
  cue?: SoundCue;
}

export function JuicyButton({ style, children, cue = 'button', onPressIn, onPressOut, onPress, ...rest }: Props): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;
  const pressScale = useAppStore((s) => s.config?.effects?.squash.button_press_scale ?? 0.94);

  return (
    <Pressable
      onPressIn={(e) => {
        Animated.timing(scale, { toValue: pressScale, duration: 70, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start();
        onPressOut?.(e);
      }}
      onPress={(e) => {
        playCue(cue);
        onPress?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
