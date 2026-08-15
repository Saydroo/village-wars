import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '../store';
import type { OnboardingReward, OnboardingStepView } from '@village-wars/shared';

/**
 * Onboarding / Tutorial (Roadmap P8). Quest-geführter Erststart: zeigt die geordnete
 * Schrittfolge mit Fortschritt. Der aktuell offene Schritt ist hervorgehoben; ist seine
 * Bedingung erfüllt, lässt er sich abholen. Spätere Schritte sind gesperrt, abgeholte
 * abgehakt. Nach dem letzten Schritt erscheint eine Abschluss-Karte.
 */
function rewardText(reward: OnboardingReward): string {
  const parts = [
    reward.wood ? `${reward.wood} 🪵` : '',
    reward.stone ? `${reward.stone} 🪨` : '',
    reward.gold ? `${reward.gold} 🟡` : '',
    reward.gems ? `${reward.gems} 💎` : '',
    reward.gold_bars ? `${reward.gold_bars} 🥇` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('  ') : '–';
}

export function OnboardingScreen(): React.ReactElement {
  const onboarding = useAppStore((s) => s.onboarding);
  const loadOnboarding = useAppStore((s) => s.loadOnboarding);
  const claimStep = useAppStore((s) => s.claimOnboardingStepAction);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    void loadOnboarding();
  }, []);

  if (!onboarding) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  const total = onboarding.steps.length;
  const done = onboarding.claimed_steps;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.back}>
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
        <Text style={styles.title}>🎓 Erste Schritte</Text>
        <Text style={styles.sub}>
          {done} / {total} abgeschlossen
        </Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.round((done / total) * 100)}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {onboarding.all_complete && (
          <View style={styles.doneCard}>
            <Text style={styles.doneIcon}>🎉</Text>
            <Text style={styles.doneTitle}>Tutorial abgeschlossen!</Text>
            <Text style={styles.doneText}>
              Du kennst jetzt die Grundlagen. Viel Erfolg, Häuptling!
            </Text>
          </View>
        )}

        {onboarding.steps.map((step: OnboardingStepView, i: number) => {
          const locked = !step.claimed && !step.active;
          const claimable = step.active && step.complete;
          return (
            <View
              key={step.id}
              style={[
                styles.card,
                step.claimed && styles.cardClaimed,
                step.active && styles.cardActive,
                locked && styles.cardLocked,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={styles.icon}>{step.icon ?? '🎯'}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.description ? (
                    <Text style={styles.stepDesc}>{step.description}</Text>
                  ) : null}
                  <Text style={styles.reward}>Belohnung: {rewardText(step.reward)}</Text>
                </View>
              </View>

              {step.claimed ? (
                <Text style={styles.claimedLabel}>✓ Abgeschlossen</Text>
              ) : claimable ? (
                <Pressable style={styles.claimBtn} onPress={() => void claimStep(step.id)}>
                  <Text style={styles.claimBtnText}>Belohnung abholen</Text>
                </Pressable>
              ) : step.active ? (
                <Text style={styles.pendingLabel}>Noch nicht erfüllt — leg los!</Text>
              ) : (
                <Text style={styles.lockedLabel}>🔒 Gesperrt</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },
  header: { padding: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#333' },
  back: { marginBottom: 8 },
  backText: { color: '#f5c518', fontSize: 14 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sub: { color: '#888', fontSize: 12, marginTop: 2, marginBottom: 8 },
  barBg: { height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#f5c518', borderRadius: 5 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  cardActive: { borderColor: '#f5c518', borderWidth: 2 },
  cardClaimed: { opacity: 0.55 },
  cardLocked: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  stepNo: {
    color: '#1a1a2e',
    backgroundColor: '#7ec8e3',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    fontSize: 13,
  },
  icon: { fontSize: 30 },
  cardInfo: { flex: 1 },
  stepTitle: { color: '#f5c518', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  stepDesc: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  reward: { color: '#7ec8e3', fontSize: 12 },
  claimedLabel: { color: '#4caf50', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  pendingLabel: { color: '#e0a030', fontSize: 12, textAlign: 'center' },
  lockedLabel: { color: '#777', fontSize: 12, textAlign: 'center' },
  claimBtn: { backgroundColor: '#f5c518', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  claimBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 14 },
  doneCard: {
    backgroundColor: '#16332a',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2e7d52',
    alignItems: 'center',
    gap: 6,
  },
  doneIcon: { fontSize: 40 },
  doneTitle: { color: '#7ee3a8', fontSize: 18, fontWeight: 'bold' },
  doneText: { color: '#cde', fontSize: 13, textAlign: 'center' },
});
