import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Player, ResourceCapacities } from '@village-wars/shared';

interface Props {
  player: Player;
  capacities: ResourceCapacities | null;
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

/** Ressourcen-Kopfzeile als Chip-Leiste (Phase-6-Politur). */
export function ResourceHeader({ player, capacities }: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      <Chip icon="🪵" value={fmt(player.wood)} cap={capacities?.wood} accent="#a9743a" />
      <Chip icon="🪨" value={fmt(player.stone)} cap={capacities?.stone} accent="#8a9098" />
      <Chip icon="🪙" value={fmt(player.gold)} cap={capacities?.gold} accent="#e0a800" />
      <Chip icon="💎" value={fmt(player.gems)} accent="#3fc7d4" />
      <Chip icon="🟡" value={fmt(player.gold_bars)} accent="#f0c040" highlight />
    </View>
  );
}

function Chip({
  icon,
  value,
  cap,
  accent,
  highlight,
}: {
  icon: string;
  value: string;
  cap?: number;
  accent: string;
  highlight?: boolean;
}): React.ReactElement {
  const atCap = cap !== undefined && Number(value.replace(/\./g, '')) >= cap;
  return (
    <View style={[styles.chip, highlight && styles.chipHi, { borderColor: accent + '66' }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, atCap && styles.valueCap]} numberOfLines={1}>
        {value}
        {cap !== undefined ? <Text style={styles.cap}>/{cap.toLocaleString('de-DE')}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#0d1117',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#161b22',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  chipHi: { backgroundColor: '#2b2410' },
  icon: { fontSize: 13 },
  value: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  valueCap: { color: '#ffb454' },
  cap: { color: '#8b949e', fontSize: 9.5, fontWeight: '500' },
});
