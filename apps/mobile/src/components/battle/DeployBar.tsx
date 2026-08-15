import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BattleHeroStats, FactionId, GameConfig } from '@village-wars/shared';
import { findUnitDefinition } from '@village-wars/shared';

interface Props {
  config: GameConfig;
  faction: FactionId;
  /** Verbleibende Einheiten je Typ. */
  reserve: Record<string, number>;
  selectedType: string | null;
  onSelect: (type: string) => void;
  /** Einsatzbereiter Held (Roadmap P6) — eigener Anzeigename in der Leiste. */
  hero?: BattleHeroStats | null;
}

function unitName(config: GameConfig, type: string, faction: FactionId, hero?: BattleHeroStats | null): string {
  if (hero && type === hero.unit_type) return `🦸 ${hero.display_name}`;
  return findUnitDefinition(config, type, faction)?.display_name ?? type;
}

/** Untere Leiste im Kampf: Einheitentyp wählen, dann aufs Feld tippen. */
export function DeployBar({ config, faction, reserve, selectedType, onSelect, hero }: Props): React.ReactElement {
  const types = Object.keys(reserve);
  return (
    <View style={styles.wrap}>
      {types.length === 0 ? (
        <Text style={styles.empty}>Keine Einheiten — trainiere zuerst in der Armee.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
          {types.map((t) => {
            const left = reserve[t] ?? 0;
            const active = selectedType === t;
            const disabled = left <= 0;
            const isHero = !!hero && t === hero.unit_type;
            return (
              <Pressable
                key={t}
                disabled={disabled}
                onPress={() => onSelect(t)}
                style={[styles.item, isHero && styles.itemHero, active && styles.itemActive, disabled && styles.itemEmpty]}
              >
                <Text style={[styles.name, isHero && styles.nameHero]} numberOfLines={1}>
                  {unitName(config, t, faction, hero)}
                </Text>
                <Text style={styles.count}>×{left}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {selectedType ? (
        <Text style={styles.hint}>Tippe auf ein Feld im Dorf, um „{unitName(config, selectedType, faction, hero)}" einzusetzen.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d' },
  content: { padding: 8, gap: 8 },
  empty: { color: '#8b949e', fontSize: 12, padding: 14 },
  item: {
    minWidth: 84,
    alignItems: 'center',
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  itemActive: { borderColor: '#f0c040', backgroundColor: '#2b2410' },
  itemHero: { borderColor: '#d4af37', backgroundColor: '#2a2208' },
  itemEmpty: { opacity: 0.4 },
  name: { color: '#fff', fontSize: 12, fontWeight: '700' },
  nameHero: { color: '#f5d76e' },
  count: { color: '#9ecbff', fontSize: 13, marginTop: 2, fontWeight: '700' },
  hint: { color: '#f0c040', fontSize: 11, paddingHorizontal: 10, paddingBottom: 8 },
});
