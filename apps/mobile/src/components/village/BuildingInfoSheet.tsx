import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Building, FactionId, GameConfig, Player } from '@village-wars/shared';
import {
  buildingProductionPerHour,
  getBuildingMaxLevel,
  getUpgradeCost,
  skipCostBars,
  tierName,
} from '@village-wars/shared';

interface Props {
  config: GameConfig;
  player: Player;
  building: Building;
  onUpgrade: () => void;
  onSkip: () => void;
  onMove: () => void;
  onStore: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function buildingName(config: GameConfig, type: string, faction: FactionId): string {
  const common = config.buildings_common[type];
  if (common && typeof common === 'object' && common.display_name) return common.display_name;
  const ex = config.factions_exclusive_content[faction]?.exclusive_buildings.find((b) => b.id === type);
  return ex?.display_name ?? type;
}

export function BuildingInfoSheet({
  config,
  player,
  building,
  onUpgrade,
  onSkip,
  onMove,
  onStore,
  onDelete,
  onClose,
}: Props): React.ReactElement {
  const underConstruction = building.level < 1;
  const name = buildingName(config, building.building_type, player.faction);
  const tier = tierName(building.building_type, building.level);
  const maxLevel = getBuildingMaxLevel(config, building.building_type);
  const atMax = maxLevel !== null && building.level >= maxLevel;
  const nextCost = atMax
    ? null
    : getUpgradeCost(config, building.building_type, building.level + 1, player.faction);

  const prod = buildingProductionPerHour(config, building.building_type, building.level, player.faction);
  const prodLine =
    prod.wood > 0
      ? `${Math.round(prod.wood)} Holz/h`
      : prod.stone > 0
        ? `${Math.round(prod.stone)} Stein/h`
        : prod.gold > 0
          ? `${Math.round(prod.gold)} Gold/h`
          : null;

  let remainingMin = 0;
  if (building.is_upgrading && building.upgrade_finish_at) {
    remainingMin = Math.max(0, (new Date(building.upgrade_finish_at).getTime() - Date.now()) / 60000);
  }
  const skipCost = skipCostBars(config, remainingMin);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.sub}>
            {underConstruction ? 'Im Bau' : `Level ${building.level}${maxLevel ? `/${maxLevel}` : ''}`}
            {!underConstruction && tier ? ` · ${tier}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {prodLine ? <Text style={styles.info}>Produktion: {prodLine}</Text> : null}

      {building.is_upgrading ? (
        <View>
          <Text style={styles.upgradingText}>
            {underConstruction ? '🏗️ Im Bau' : '⏳ Upgrade läuft'} · noch ~{Math.ceil(remainingMin)} Min
          </Text>
          <Pressable style={[styles.btn, styles.skipBtn]} onPress={onSkip}>
            <Text style={styles.btnText}>Sofort fertig · {skipCost} 🟡</Text>
          </Pressable>
        </View>
      ) : atMax ? (
        <Text style={styles.info}>Maximalstufe erreicht.</Text>
      ) : nextCost ? (
        <Pressable style={[styles.btn, styles.upBtn]} onPress={onUpgrade}>
          <Text style={styles.btnText}>
            Upgrade → Lvl {building.level + 1} ·{' '}
            {[
              nextCost.wood ? `${nextCost.wood} 🪵` : '',
              nextCost.stone ? `${nextCost.stone} 🪨` : '',
              nextCost.gold ? `${nextCost.gold} 🪙` : '',
            ]
              .filter(Boolean)
              .join('  ')}{' '}
            · {nextCost.build_time_minutes} Min
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.info}>Für diesen Typ sind keine Upgrade-Kosten konfiguriert.</Text>
      )}

      {!building.is_upgrading ? (
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.actionBtn]} onPress={onMove}>
            <Text style={styles.actionText}>↔ Verschieben</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.actionBtn]} onPress={onStore}>
            <Text style={styles.actionText}>📦 Einlagern</Text>
          </Pressable>
          {building.building_type !== 'town_hall' ? (
            <Pressable style={[styles.btn, styles.delBtn]} onPress={onDelete}>
              <Text style={styles.delText}>Entfernen</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: '#30363d',
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: '#8b949e', fontSize: 13, marginTop: 2 },
  close: { color: '#8b949e', fontSize: 18, paddingHorizontal: 6 },
  info: { color: '#c9d1d9', fontSize: 13 },
  upgradingText: { color: '#f0c040', fontSize: 13, marginBottom: 8 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  upBtn: { backgroundColor: '#2563eb' },
  skipBtn: { backgroundColor: '#b8860b' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 4,
  },
  actionText: { color: '#c9d1d9', fontSize: 12, fontWeight: '700' },
  delBtn: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#5a2222' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  delText: { color: '#ff6b6b', fontSize: 12, fontWeight: '700' },
});
