import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store';
import type { EventReward, EventChallengeView } from '@village-wars/shared';

/**
 * Limited-Time-Event (Roadmap P7-Folge). Zeigt das aktuelle Event mit Countdown
 * und Aufgaben-Liste (Fortschritt seit Event-Start, Belohnung, Claim). Erscheint
 * leer, wenn gerade kein Event aktiv ist.
 */
function rewardText(reward: EventReward): string {
  const parts = [
    reward.wood ? `${reward.wood} 🪵` : '',
    reward.stone ? `${reward.stone} 🪨` : '',
    reward.gold ? `${reward.gold} 🟡` : '',
    reward.gems ? `${reward.gems} 💎` : '',
    reward.gold_bars ? `${reward.gold_bars} 🥇` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('  ') : '–';
}

/** Verbleibende Zeit bis `endsAt` als „Xd Yh" / „Yh Zm". */
function remaining(endsAt: string): string {
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return 'beendet';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function EventScreen(): React.ReactElement {
  const event = useAppStore((s) => s.event);
  const loadEvents = useAppStore((s) => s.loadEvents);
  const claim = useAppStore((s) => s.claimEventAction);
  const setScreen = useAppStore((s) => s.setScreen);
  const [, force] = useState(0);

  useEffect(() => {
    void loadEvents();
    // Countdown jede Minute aktualisieren.
    const id = setInterval(() => force((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (!event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5852a" />
      </View>
    );
  }

  const ev = event.event;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.back}>
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
        <Text style={styles.title}>🔥 Event</Text>
      </View>

      {!ev ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Gerade läuft kein Event. Schau bald wieder vorbei! ⏳</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>{ev.icon ?? '🔥'}</Text>
            <Text style={styles.bannerName}>{ev.name}</Text>
            {ev.description ? <Text style={styles.bannerDesc}>{ev.description}</Text> : null}
            <Text style={styles.countdown}>⏳ Noch {remaining(ev.ends_at)}</Text>
          </View>

          {ev.challenges.map((c: EventChallengeView) => {
            const pct = Math.min(c.value / c.target, 1);
            return (
              <View key={c.id} style={[styles.card, c.claimed && styles.cardClaimed]}>
                <Text style={styles.cName}>{c.name}</Text>
                {c.description ? <Text style={styles.cDesc}>{c.description}</Text> : null}
                <Text style={styles.reward}>Belohnung: {rewardText(c.reward)}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progress}>
                  {Math.min(c.value, c.target)} / {c.target}
                </Text>
                {c.claimed ? (
                  <Text style={styles.claimedLabel}>✓ Abgeholt</Text>
                ) : c.complete ? (
                  <Pressable style={styles.claimBtn} onPress={() => void claim(c.id)}>
                    <Text style={styles.claimBtnText}>Belohnung abholen</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.pendingLabel}>Noch nicht erfüllt</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#333' },
  back: { marginBottom: 8 },
  backText: { color: '#f5852a', fontSize: 14 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  muted: { color: '#888', fontSize: 14, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  banner: {
    backgroundColor: '#3a1d10',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#f5852a',
  },
  bannerIcon: { fontSize: 40 },
  bannerName: { color: '#ffb070', fontSize: 20, fontWeight: '900' },
  bannerDesc: { color: '#e8cab5', fontSize: 13, textAlign: 'center' },
  countdown: { color: '#ffd9b8', fontSize: 13, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#0f3460' },
  cardClaimed: { opacity: 0.55 },
  cName: { color: '#f5852a', fontSize: 16, fontWeight: 'bold' },
  cDesc: { color: '#ccc', fontSize: 13, marginTop: 2 },
  reward: { color: '#7ec8e3', fontSize: 12, marginTop: 4, marginBottom: 6 },
  barBg: { height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', backgroundColor: '#f5852a', borderRadius: 5 },
  progress: { color: '#aaa', fontSize: 12, textAlign: 'right', marginBottom: 8 },
  claimedLabel: { color: '#4caf50', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  pendingLabel: { color: '#e0a030', fontSize: 12, textAlign: 'center' },
  claimBtn: { backgroundColor: '#f5852a', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  claimBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 14 },
});
