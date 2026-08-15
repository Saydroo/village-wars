import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FactionId, GameConfig, Player, UpgradeCost } from '@village-wars/shared';
import { getPlacementCost } from '@village-wars/shared';

interface Props {
  config: GameConfig;
  player: Player;
  placementType: string | null;
  onSelect: (type: string | null) => void;
}

interface Placeable {
  id: string;
  name: string;
  unlock: number;
  cost: UpgradeCost | null;
}

/** Liste platzierbarer Gebäude (gemeinsam + fraktionsexklusiv), nach TH-Level freigeschaltet. */
function placeables(config: GameConfig, faction: FactionId): Placeable[] {
  const out: Placeable[] = [];
  for (const [id, def] of Object.entries(config.buildings_common)) {
    if (id === 'description' || typeof def !== 'object') continue;
    const d = def as { display_name?: string; unlock_town_hall_level?: number };
    if (id === 'town_hall') continue; // Rathaus existiert bereits
    out.push({
      id,
      name: d.display_name ?? id,
      unlock: d.unlock_town_hall_level ?? 1,
      cost: getPlacementCost(config, id, faction),
    });
  }
  for (const b of config.factions_exclusive_content[faction]?.exclusive_buildings ?? []) {
    out.push({
      id: b.id,
      name: b.display_name,
      unlock: b.unlock_town_hall_level,
      cost: getPlacementCost(config, b.id, faction),
    });
  }
  return out.sort((a, b) => a.unlock - b.unlock);
}

function shortNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

/** Kompakte Kostenanzeige, z.B. „250 🪵", „1.5k 🪵 800 🪨" oder „Gratis". */
function formatCost(cost: UpgradeCost | null): string {
  if (!cost) return 'platzieren';
  const parts = [
    cost.wood ? `${shortNum(cost.wood)} 🪵` : '',
    cost.stone ? `${shortNum(cost.stone)} 🪨` : '',
    cost.gold ? `${shortNum(cost.gold)} 🪙` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('  ') : 'Gratis';
}

export function PlacementBar({ config, player, placementType, onSelect }: Props): React.ReactElement {
  const items = useMemo(() => placeables(config, player.faction), [config, player.faction]);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {items.map((it) => {
          const locked = player.village_level < it.unlock;
          const active = placementType === it.id;
          return (
            <Pressable
              key={it.id}
              disabled={locked}
              onPress={() => onSelect(active ? null : it.id)}
              style={[styles.item, active && styles.itemActive, locked && styles.itemLocked]}
            >
              <Text style={[styles.name, locked && styles.lockedText]} numberOfLines={1}>
                {it.name}
              </Text>
              <Text style={styles.unlock} numberOfLines={1}>
                {locked ? `🔒 TH${it.unlock}` : formatCost(it.cost)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {placementType ? (
        <Text style={styles.hint}>Tippe auf ein freies Feld, um „{placementType}" zu platzieren · nochmal tippen zum Abbrechen</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d' },
  content: { padding: 8, gap: 8 },
  item: {
    minWidth: 92,
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  itemActive: { borderColor: '#f0c040', backgroundColor: '#2b2410' },
  itemLocked: { opacity: 0.5 },
  name: { color: '#fff', fontSize: 13, fontWeight: '700' },
  unlock: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  lockedText: { color: '#8b949e' },
  hint: { color: '#f0c040', fontSize: 11, paddingHorizontal: 10, paddingBottom: 8 },
});
