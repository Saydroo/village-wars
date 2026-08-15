import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ArmyResponse, GameConfig, Player } from '@village-wars/shared';
import { getTrainCost, unitsForFaction } from '@village-wars/shared';

interface Props {
  config: GameConfig;
  player: Player;
  army: ArmyResponse | null;
  onTrain: (unitType: string, quantity: number) => void;
  onClose: () => void;
}

function shortNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

/** Vollflächiges Panel zum Rekrutieren von Einheiten + Armeebestand (Phase 3). */
export function ArmyPanel({ config, player, army, onTrain, onClose }: Props): React.ReactElement {
  const units = useMemo(() => unitsForFaction(config, player.faction), [config, player.faction]);
  const readyByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of army?.units ?? []) m[u.unit_type] = u.quantity;
    return m;
  }, [army]);
  const trainingByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of army?.training ?? []) m[t.unit_type] = (m[t.unit_type] ?? 0) + t.quantity;
    return m;
  }, [army]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🛡 Armee &amp; Kaserne</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Verfügbar: {player.wood} 🪵 · {player.stone} 🪨 · {player.gold} 🪙
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {units.map((u) => {
          const locked = player.village_level < u.unlock_town_hall_level;
          const cost = getTrainCost(config, u.id, 1, player.faction);
          const ready = readyByType[u.id] ?? 0;
          const inTraining = trainingByType[u.id] ?? 0;
          const costStr = cost
            ? [
                cost.wood ? `${shortNum(cost.wood)} 🪵` : '',
                cost.stone ? `${shortNum(cost.stone)} 🪨` : '',
                cost.gold ? `${shortNum(cost.gold)} 🪙` : '',
              ]
                .filter(Boolean)
                .join('  ')
            : '—';
          return (
            <View key={u.id} style={[styles.row, locked && styles.rowLocked]}>
              <View style={styles.rowInfo}>
                <Text style={styles.name}>
                  {u.display_name}
                  {u.exclusive ? ' ★' : ''}
                </Text>
                <Text style={styles.meta}>
                  {locked ? `🔒 ab Rathaus ${u.unlock_town_hall_level}` : costStr}
                  {`  ·  ⏱ ${u.train_time_seconds}s  ·  ⌂${u.housing_space}`}
                </Text>
                <Text style={styles.stock}>
                  Bereit: {ready}
                  {inTraining > 0 ? `   ·   im Training: ${inTraining}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  disabled={locked}
                  onPress={() => onTrain(u.id, 1)}
                  style={[styles.trainBtn, locked && styles.btnDisabled]}
                >
                  <Text style={styles.trainText}>+1</Text>
                </Pressable>
                <Pressable
                  disabled={locked}
                  onPress={() => onTrain(u.id, 5)}
                  style={[styles.trainBtnAlt, locked && styles.btnDisabled]}
                >
                  <Text style={styles.trainTextAlt}>+5</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0d1117', zIndex: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#30363d' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 6, paddingHorizontal: 12, backgroundColor: '#21262d', borderRadius: 8 },
  closeText: { color: '#c9d1d9', fontSize: 16, fontWeight: '800' },
  sub: { color: '#9ecbff', fontSize: 12, paddingHorizontal: 14, paddingTop: 10 },
  list: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#30363d' },
  rowLocked: { opacity: 0.55 },
  rowInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  meta: { color: '#8b949e', fontSize: 11, marginTop: 3 },
  stock: { color: '#c9d1d9', fontSize: 12, marginTop: 4, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  trainBtn: { backgroundColor: '#f0c040', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  trainText: { color: '#1a1a1a', fontWeight: '800' },
  trainBtnAlt: { backgroundColor: '#21262d', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#f0c040' },
  trainTextAlt: { color: '#f0c040', fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
});
