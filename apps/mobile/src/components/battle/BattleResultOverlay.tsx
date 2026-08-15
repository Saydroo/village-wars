import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { BattleEndedPayload } from '@village-wars/shared';
import { JuicyButton } from '../ui/JuicyButton';
import { playCue } from '../../rendering/effects';

/**
 * Sieg-/Niederlage-Sequenz (Game-Juice-Spec 5.2). Sieg: goldener Glow, „SIEG!"
 * federt mit easeOutElastic ein, Trophäen-Zähler tickt hoch. Niederlage:
 * sachlich, leicht entsättigt (nicht entmutigend). Bei „Effekte reduzieren"
 * erscheint das Ergebnis ohne Animation.
 */
interface Props {
  ended: BattleEndedPayload;
  reduceEffects: boolean;
  onClose: () => void;
}

export function BattleResultOverlay({ ended, reduceEffects, onClose }: Props): React.ReactElement {
  const win = ended.result === 'attacker_win';
  const draw = ended.result === 'draw';
  const isFriendly = ended.mode === 'friendly';
  const cardScale = useRef(new Animated.Value(reduceEffects ? 1 : 0.6)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [trophyShown, setTrophyShown] = useState(reduceEffects ? ended.trophies_change : 0);

  useEffect(() => {
    playCue(win ? 'victory' : draw ? 'reward' : 'defeat');
    if (reduceEffects) return;
    // Karte federt ein.
    Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
    // Goldener Glow nur bei Sieg.
    if (win) {
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 600, useNativeDriver: true }),
      ]).start();
    }
    // Trophäen-Zähler hochticken.
    const target = ended.trophies_change;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value }) => setTrophyShown(Math.round(value)));
    Animated.timing(anim, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [cardScale, glow, win, draw, reduceEffects, ended.trophies_change]);

  return (
    <View style={styles.overlay}>
      {win ? (
        <Animated.View style={[styles.glow, { opacity: glow }]} pointerEvents="none" />
      ) : null}
      <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }, !win && !draw && styles.cardLoss]}>
        {isFriendly ? (
          <Text style={styles.friendlyTag}>🤝 Übungskampf</Text>
        ) : null}
        <Text style={[styles.result, win ? styles.win : draw ? styles.draw : styles.loss]}>
          {win ? '🏆 SIEG!' : draw ? '🤝 Unentschieden' : 'Niederlage'}
        </Text>
        <Text style={styles.line}>Zerstörung: {ended.destruction_pct}%</Text>
        {isFriendly ? null : (
          <>
            <Text style={styles.line}>
              Beute: {ended.loot.wood} 🪵 · {ended.loot.stone} 🪨
            </Text>
            <Text style={[styles.line, ended.trophies_change >= 0 ? styles.win : styles.loss]}>
              Trophäen: {trophyShown >= 0 ? '+' : ''}
              {trophyShown} 🏆
            </Text>
          </>
        )}
        {isFriendly ? (
          <Text style={styles.friendlyNote}>Übung — keine Beute, keine Trophäen, keine Truppenverluste.</Text>
        ) : null}
        <JuicyButton style={styles.btn} cue="button" onPress={onClose}>
          <Text style={styles.btnText}>Zurück zum Dorf</Text>
        </JuicyButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117aa' },
  glow: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f0c040' },
  card: { backgroundColor: '#161b22', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#f0c040', minWidth: 260 },
  cardLoss: { borderColor: '#30363d' },
  result: { fontSize: 28, fontWeight: '900' },
  line: { color: '#c9d1d9', fontSize: 15 },
  win: { color: '#4ade80' },
  draw: { color: '#9ecbff' },
  loss: { color: '#ff6b6b' },
  btn: { backgroundColor: '#f0c040', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  btnText: { color: '#1a1a1a', fontWeight: '800', fontSize: 15 },
  friendlyTag: { color: '#bcd9ff', fontSize: 13, fontWeight: '800' },
  friendlyNote: { color: '#8b949e', fontSize: 12, textAlign: 'center', maxWidth: 240 },
});
