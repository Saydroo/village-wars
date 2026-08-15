import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AchievementView } from '@village-wars/shared';
import { useAppStore } from '../store';

/**
 * Achievements (Roadmap P2, Retention/Ziele). Zeigt jeden Erfolg mit Live-Fortschritt,
 * Stufen und Abhol-Button (verdienbare Gems/Goldbarren = faire Premium-Währung).
 */
export function AchievementsScreen(): React.ReactElement {
  const achievements = useAppStore((s) => s.achievements);
  const loadAchievements = useAppStore((s) => s.loadAchievements);
  const claim = useAppStore((s) => s.claimAchievementAction);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const claimableCount = achievements.filter((a) => a.claimable).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={styles.title}>🏅 Erfolge{claimableCount > 0 ? ` (${claimableCount})` : ''}</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {achievements.map((a) => (
          <AchievementCard key={a.id} a={a} onClaim={() => void claim(a.id)} />
        ))}
        {achievements.length === 0 ? <Text style={styles.empty}>Lade Erfolge …</Text> : null}
      </ScrollView>
    </View>
  );
}

function AchievementCard({ a, onClaim }: { a: AchievementView; onClaim: () => void }): React.ReactElement {
  // Offene Belohnung = Summe der Stufen [claimed_tier, reached_tier).
  let gems = 0;
  let bars = 0;
  for (let i = a.claimed_tier; i < a.reached_tier; i++) {
    const t = a.tiers[i];
    if (t) {
      gems += t.gems;
      bars += t.gold_bars;
    }
  }
  const maxed = a.next_threshold === null;
  const progress = maxed ? 1 : Math.min(1, a.value / (a.next_threshold || 1));

  return (
    <View style={[styles.card, a.claimable && styles.cardClaimable]}>
      <View style={styles.cardTop}>
        <Text style={styles.icon}>{a.icon ?? '🏅'}</Text>
        <View style={styles.cardText}>
          <Text style={styles.name}>{a.name}</Text>
          {a.description ? <Text style={styles.desc}>{a.description}</Text> : null}
        </View>
        <Text style={styles.tierBadge}>
          {a.reached_tier}/{a.tiers.length}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {maxed ? 'Alle Stufen erreicht ✓' : `${a.value} / ${a.next_threshold}`}
      </Text>

      {a.claimable ? (
        <Pressable style={styles.claimBtn} onPress={onClaim}>
          <Text style={styles.claimText}>
            Abholen{gems > 0 ? `  💎 ${gems}` : ''}{bars > 0 ? `  🥇 ${bars}` : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: '#58a6ff', fontSize: 16, fontWeight: '700' },
  title: { color: '#f0c040', fontSize: 18, fontWeight: '900' },
  list: { padding: 12, gap: 10 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 12,
    gap: 8,
  },
  cardClaimable: { borderColor: '#f0c040' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 26 },
  cardText: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  desc: { color: '#8b949e', fontSize: 11, marginTop: 1 },
  tierBadge: { color: '#c9d1d9', fontSize: 13, fontWeight: '800' },
  barTrack: { height: 8, backgroundColor: '#0d1117', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#3fb950', borderRadius: 4 },
  progressText: { color: '#8b949e', fontSize: 11, fontWeight: '600' },
  claimBtn: { backgroundColor: '#f0c040', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  claimText: { color: '#0d1117', fontSize: 14, fontWeight: '900' },
});
