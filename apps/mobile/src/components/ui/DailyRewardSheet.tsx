import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../../store';
import type { DailyRewardView } from '@village-wars/shared';

/**
 * Tägliche Login-Belohnung + Streak (Roadmap P1, Retention). Erscheint nach dem
 * Login, solange die heutige Belohnung abholbar ist. Zeigt die 7-Tage-Leiter mit
 * hervorgehobenem heutigem Tag; nach dem Abholen die erhaltene Belohnung. Goldbarren
 * am Streak-Höhepunkt = verdienbare Premium-Währung (fair statt P2W).
 */
export function DailyRewardSheet(): React.ReactElement | null {
  const showDailyReward = useAppStore((s) => s.showDailyReward);
  const dailyStatus = useAppStore((s) => s.dailyStatus);
  const dailyClaimed = useAppStore((s) => s.dailyClaimed);
  const claimDaily = useAppStore((s) => s.claimDaily);
  const dismissDailyReward = useAppStore((s) => s.dismissDailyReward);

  if (!showDailyReward || !dailyStatus) return null;

  const ladder = dailyStatus.ladder;
  const todayIndex = (dailyStatus.next_streak_day - 1) % ladder.length;
  const claimed = dailyClaimed !== null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissDailyReward}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>🎁 Tägliche Belohnung</Text>
          <Text style={styles.streak}>
            {claimed
              ? `🔥 Streak: ${dailyStatus.streak} ${dailyStatus.streak === 1 ? 'Tag' : 'Tage'}`
              : dailyStatus.streak_reset && dailyStatus.streak > 0
                ? '🔥 Streak zurückgesetzt — willkommen zurück!'
                : `🔥 Streak: ${dailyStatus.streak} → ${dailyStatus.next_streak_day}`}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ladder}>
            {ladder.map((tier, i) => {
              const isToday = i === todayIndex;
              return (
                <View key={tier.day} style={[styles.tier, isToday && styles.tierToday, tier.gold_bars > 0 && styles.tierBonus]}>
                  <Text style={[styles.tierDay, isToday && styles.tierDayToday]}>
                    {isToday ? (claimed ? '✓' : 'HEUTE') : `Tag ${tier.day}`}
                  </Text>
                  <RewardLines tier={tier} />
                </View>
              );
            })}
          </ScrollView>

          {claimed && dailyClaimed ? (
            <>
              <View style={styles.claimedBox}>
                <Text style={styles.claimedTitle}>✓ Abgeholt!</Text>
                <RewardLines tier={dailyClaimed} big />
              </View>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={dismissDailyReward}>
                <Text style={[styles.btnText, styles.btnTextSecondary]}>Weiter</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.btn} onPress={() => void claimDaily()}>
              <Text style={styles.btnText}>Belohnung abholen</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Kompakte Belohnungs-Zeilen (nur Werte > 0). */
function RewardLines({ tier, big }: { tier: DailyRewardView; big?: boolean }): React.ReactElement {
  const items: Array<[string, number]> = [
    ['🪵', tier.wood],
    ['🪨', tier.stone],
    ['🪙', tier.gold],
    ['💎', tier.gems],
    ['🥇', tier.gold_bars],
  ];
  return (
    <View style={styles.rewards}>
      {items
        .filter(([, v]) => v > 0)
        .map(([icon, v]) => (
          <Text key={icon} style={[styles.reward, big && styles.rewardBig]}>
            {icon} {v}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0c040',
    padding: 20,
    gap: 14,
    width: '100%',
    maxWidth: 460,
  },
  title: { color: '#f0c040', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  streak: { color: '#c9d1d9', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  ladder: { gap: 8, paddingVertical: 4 },
  tier: {
    backgroundColor: '#0d1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 8,
    minWidth: 64,
    alignItems: 'center',
    gap: 4,
  },
  tierToday: { borderColor: '#f0c040', borderWidth: 2, backgroundColor: '#1c1a10' },
  tierBonus: { backgroundColor: '#1a1326' },
  tierDay: { color: '#8b949e', fontSize: 10, fontWeight: '800' },
  tierDayToday: { color: '#f0c040' },
  rewards: { alignItems: 'center', gap: 1 },
  reward: { color: '#c9d1d9', fontSize: 10, fontWeight: '700' },
  rewardBig: { fontSize: 16 },
  claimedBox: { alignItems: 'center', gap: 6, backgroundColor: '#0d1117', borderRadius: 10, padding: 12 },
  claimedTitle: { color: '#3fb950', fontSize: 16, fontWeight: '800' },
  btn: { backgroundColor: '#f0c040', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#30363d' },
  btnText: { color: '#0d1117', fontSize: 16, fontWeight: '900' },
  btnTextSecondary: { color: '#c9d1d9' },
});
