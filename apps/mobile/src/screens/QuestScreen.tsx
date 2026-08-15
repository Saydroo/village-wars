import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '../store';
import type { DailyQuestProgress } from '@village-wars/shared';

/**
 * Tägliche Quests (Roadmap P4). Zeigt alle 4 Quest-Karten mit Fortschrittsbalken,
 * Belohnungstext und Claim-Button. Resets täglich um Mitternacht UTC.
 */
export function QuestScreen(): React.ReactElement {
  const quests = useAppStore((s) => s.quests);
  const loadQuests = useAppStore((s) => s.loadQuests);
  const claimQuest = useAppStore((s) => s.claimQuestAction);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    void loadQuests();
  }, []);

  if (!quests) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  const handleClaim = (q: DailyQuestProgress) => {
    Alert.alert(
      'Belohnung einsammeln',
      `${q.name}: ${[q.reward_gold > 0 ? `${q.reward_gold} Gold` : '', q.reward_gems > 0 ? `${q.reward_gems} 💎` : ''].filter(Boolean).join(' + ')}`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Einsammeln', onPress: () => void claimQuest(q.id) },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.back}>
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
        <Text style={styles.title}>📋 Tägliche Quests</Text>
        <Text style={styles.date}>{quests.quest_date}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {quests.quests.map((q) => {
          const complete = q.progress >= q.target;
          const pct = Math.min(q.progress / q.target, 1);
          const rewardText = [
            q.reward_gold > 0 ? `${q.reward_gold} Gold` : '',
            q.reward_gems > 0 ? `${q.reward_gems} 💎` : '',
          ]
            .filter(Boolean)
            .join(' + ');

          return (
            <View
              key={q.id}
              style={[styles.card, q.claimed && styles.cardClaimed]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.icon}>{q.icon ?? '🎯'}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.questName}>{q.name}</Text>
                  <Text style={styles.questDesc}>{q.description}</Text>
                  <Text style={styles.reward}>Belohnung: {rewardText || '–'}</Text>
                </View>
              </View>

              {/* Fortschrittsbalken */}
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.progress}>
                {q.progress} / {q.target}
              </Text>

              {q.claimed ? (
                <Text style={styles.claimedLabel}>✓ Eingesammelt</Text>
              ) : complete ? (
                <Pressable style={styles.claimBtn} onPress={() => handleClaim(q)}>
                  <Text style={styles.claimBtnText}>Belohnung abholen</Text>
                </Pressable>
              ) : null}
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
  date: { color: '#888', fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  cardClaimed: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  icon: { fontSize: 32 },
  cardInfo: { flex: 1 },
  questName: { color: '#f5c518', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  questDesc: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  reward: { color: '#7ec8e3', fontSize: 12 },
  barBg: { height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', backgroundColor: '#f5c518', borderRadius: 5 },
  progress: { color: '#aaa', fontSize: 12, textAlign: 'right', marginBottom: 8 },
  claimedLabel: { color: '#4caf50', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  claimBtn: {
    backgroundColor: '#f5c518',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  claimBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 14 },
});
