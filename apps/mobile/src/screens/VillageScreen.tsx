import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { FactionId, GameConfig, InventoryItem } from '@village-wars/shared';
import { getBuildingMaxLevel } from '@village-wars/shared';
import { useAppStore } from '../store';
import { VillageCanvas } from '../components/village/VillageCanvas';
import { ResourceHeader } from '../components/village/ResourceHeader';
import { PlacementBar } from '../components/village/PlacementBar';
import { BuildingInfoSheet } from '../components/village/BuildingInfoSheet';
import { DungeonPortal } from '../components/village/DungeonPortal';
import { ArmyPanel } from '../components/units/ArmyPanel';
import { SettingsSheet } from '../components/ui/SettingsSheet';
import { JuicyButton } from '../components/ui/JuicyButton';
import { MenuSheet, type MenuItem } from '../components/ui/MenuSheet';

/** Anzeigename eines Gebäudetyps (gemeinsam oder fraktionsexklusiv). */
function buildingName(config: GameConfig, type: string, faction: FactionId): string {
  const common = config.buildings_common[type];
  if (common && typeof common === 'object' && common.display_name) return common.display_name;
  const ex = config.factions_exclusive_content[faction]?.exclusive_buildings.find((b) => b.id === type);
  return ex?.display_name ?? type;
}

export function VillageScreen(): React.ReactElement {
  const {
    config,
    player,
    capacities,
    village,
    buildings,
    inventory,
    army,
    error,
    placementType,
    selectedBuildingId,
    moveBuildingId,
    inventoryPlaceId,
    refreshAll,
    setPlacementType,
    selectBuilding,
    cancelModes,
    placeAt,
    startUpgrade,
    skipUpgrade,
    removeBuilding,
    beginMove,
    commitMoveAt,
    storeToInventory,
    beginInventoryPlace,
    commitInventoryPlaceAt,
    trainUnit,
    startMatchmaking,
    setScreen,
    dungeonStatus,
    loadDungeon,
    reduceEffects,
    activeSkins,
    achievements,
    onboarding,
    event,
  } = useAppStore();
  const achievementsClaimable = achievements.filter((a) => a.claimable).length;
  // Badge: 1, wenn der aktuell offene Onboarding-Schritt abholbar ist (active + erfüllt).
  const onboardingClaimable = onboarding
    ? onboarding.steps.filter((s) => s.active && s.complete).length
    : 0;
  // Event aktiv? Badge = Anzahl abholbarer Aufgaben (erfüllt + nicht abgeholt).
  const eventActive = !!event?.event;
  const eventClaimable = event?.event
    ? event.event.challenges.filter((c) => c.complete && !c.claimed).length
    : 0;

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [armyOpen, setArmyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void refreshAll();
    void loadDungeon(); // Dungeon-Status für das Welt-Portal
  }, [refreshAll, loadDungeon]);

  // Auto-Refresh alle 30s für Upgrade-Timer/Produktion (+ Portal-Status)
  useEffect(() => {
    const id = setInterval(() => {
      void refreshAll();
      void loadDungeon();
    }, 30_000);
    return () => clearInterval(id);
  }, [refreshAll, loadDungeon]);

  if (!config || !player) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Lade …</Text>
      </View>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const selected = buildings.find((b) => b.id === selectedBuildingId) ?? null;
  const maxLevelFor = (type: string) => getBuildingMaxLevel(config, type) ?? 10;
  const placing = Boolean(placementType || moveBuildingId || inventoryPlaceId);

  const onTapTile = (gx: number, gy: number) => {
    if (moveBuildingId) void commitMoveAt(gx, gy);
    else if (inventoryPlaceId) void commitInventoryPlaceAt(gx, gy);
    else if (placementType) void placeAt(gx, gy);
    else selectBuilding(null);
  };

  const modeHint = moveBuildingId
    ? '↔ Verschieben: tippe das Zielfeld an'
    : inventoryPlaceId
      ? '📦 Aus Inventar platzieren: tippe das Zielfeld an'
      : null;

  return (
    <View style={styles.container}>
      <ResourceHeader player={player} capacities={capacities} />
      <View style={styles.thCol}>
        <Text style={styles.thText} numberOfLines={1}>
          {player.username} · Rathaus {player.village_level} · {config.factions[player.faction].display_name}
        </Text>
        <View style={styles.actionRow}>
          <JuicyButton onPress={() => startMatchmaking()} style={styles.attackBtn} cue="button">
            <Text style={styles.attackText}>⚔️ Angreifen</Text>
          </JuicyButton>
          <JuicyButton
            cue="button"
            onPress={() => {
              cancelModes();
              setArmyOpen(true);
            }}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>🛡 {army?.units.reduce((s, u) => s + u.quantity, 0) ?? 0}</Text>
          </JuicyButton>
          <JuicyButton
            cue="button"
            onPress={() => {
              cancelModes();
              setMenuOpen(true);
            }}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>☰ Menü</Text>
          </JuicyButton>
        </View>
      </View>

      {modeHint ? (
        <Pressable onPress={cancelModes} style={styles.modeBar}>
          <Text style={styles.modeText}>{modeHint} · tippen zum Abbrechen</Text>
        </Pressable>
      ) : null}

      <View style={styles.canvasWrap} onLayout={onLayout}>
        {size && village ? (
          <VillageCanvas
            width={size.w}
            height={size.h}
            gridWidth={village.grid_width}
            gridHeight={village.grid_height}
            buildings={buildings}
            selectedId={selectedBuildingId}
            placing={placing}
            effects={config.effects}
            reduceEffects={reduceEffects}
            activeSkins={activeSkins}
            faction={player.faction}
            maxLevelFor={maxLevelFor}
            onTapBuilding={(id) => selectBuilding(id)}
            onTapTile={onTapTile}
          />
        ) : null}
        {/* Dungeon-Portal: erscheint nur während der offenen Dungeon-Phase (Wochenende),
            verschwindet automatisch beim Schließen. Tippen öffnet den Dungeon. */}
        {dungeonStatus?.open === true && !placing ? (
          <DungeonPortal onPress={() => setScreen('dungeon')} />
        ) : null}
      </View>

      {error ? (
        <Pressable onPress={() => useAppStore.setState({ error: null })} style={styles.errorBar}>
          <Text style={styles.errorText}>{error} (tippen zum Schließen)</Text>
        </Pressable>
      ) : null}

      {selected ? (
        <BuildingInfoSheet
          config={config}
          player={player}
          building={selected}
          onUpgrade={() => void startUpgrade(selected.id)}
          onSkip={() => void skipUpgrade(selected.id)}
          onMove={() => beginMove(selected.id)}
          onStore={() => void storeToInventory(selected.id)}
          onDelete={() => void removeBuilding(selected.id)}
          onClose={() => selectBuilding(null)}
        />
      ) : inventoryOpen ? (
        <InventoryBar
          config={config}
          faction={player.faction}
          inventory={inventory}
          onSelect={(item) => {
            setInventoryOpen(false);
            beginInventoryPlace(item.id);
          }}
        />
      ) : (
        <PlacementBar config={config} player={player} placementType={placementType} onSelect={setPlacementType} />
      )}

      {armyOpen ? (
        <ArmyPanel
          config={config}
          player={player}
          army={army}
          onTrain={(type, qty) => void trainUnit(type, qty)}
          onClose={() => setArmyOpen(false)}
        />
      ) : null}

      {settingsOpen ? <SettingsSheet onClose={() => setSettingsOpen(false)} /> : null}

      {menuOpen ? (
        <MenuSheet
          onClose={() => setMenuOpen(false)}
          items={
            [
              ...(eventActive ? [{ icon: '🔥', label: 'Event', badge: eventClaimable, onPress: () => setScreen('event') }] : []),
              { icon: '🎓', label: 'Erste Schritte', badge: onboardingClaimable, onPress: () => setScreen('onboarding') },
              { icon: '🏰', label: 'Clan', onPress: () => setScreen('clan') },
              { icon: '🏆', label: 'Rangliste', onPress: () => setScreen('leaderboard') },
              { icon: '🏅', label: 'Erfolge', badge: achievementsClaimable, onPress: () => setScreen('achievements') },
              { icon: '🔬', label: 'Labor', onPress: () => setScreen('research') },
              { icon: '📋', label: 'Quests', onPress: () => setScreen('quests') },
              { icon: '🦸', label: 'Held', onPress: () => setScreen('hero') },
              { icon: '🎟️', label: 'Season-Pass', onPress: () => setScreen('season_pass') },
              { icon: '🗝️', label: 'Dungeon', onPress: () => setScreen('dungeon') },
              { icon: '🛒', label: 'Shop', onPress: () => setScreen('shop') },
              { icon: '📦', label: 'Inventar', badge: inventory.length, onPress: () => { cancelModes(); setInventoryOpen(true); } },
              { icon: '⚙️', label: 'Einstellungen', onPress: () => setSettingsOpen(true) },
            ] satisfies MenuItem[]
          }
        />
      ) : null}
    </View>
  );
}

/** Untere Leiste mit eingelagerten Gebäuden; Auswahl startet das Platzieren. */
function InventoryBar({
  config,
  faction,
  inventory,
  onSelect,
}: {
  config: GameConfig;
  faction: FactionId;
  inventory: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
}): React.ReactElement {
  return (
    <View style={styles.invWrap}>
      {inventory.length === 0 ? (
        <Text style={styles.invEmpty}>Inventar leer — „Einlagern" beim Gebäude legt es hier ab.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.invContent}>
          {inventory.map((it) => (
            <Pressable key={it.id} style={styles.invItem} onPress={() => onSelect(it)}>
              <Text style={styles.invName} numberOfLines={1}>
                {buildingName(config, it.building_type, faction)}
              </Text>
              <Text style={styles.invSub}>Lvl {it.level} · platzieren</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117' },
  muted: { color: '#8b949e' },
  thCol: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0d1117',
    gap: 6,
  },
  thText: { color: '#c9d1d9', fontSize: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  attackBtn: {
    flex: 1,
    backgroundColor: '#8a2f2f',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#c75450',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackText: { color: '#ffe3e3', fontSize: 15, fontWeight: '900' },
  iconBtn: {
    backgroundColor: '#21262d',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#c9d1d9', fontSize: 13, fontWeight: '800' },
  modeBar: { backgroundColor: '#1d3a5a', paddingVertical: 8, paddingHorizontal: 12 },
  modeText: { color: '#9ecbff', fontSize: 12, fontWeight: '600' },
  canvasWrap: { flex: 1, overflow: 'hidden' },
  errorBar: { backgroundColor: '#5a1d1d', paddingVertical: 8, paddingHorizontal: 12 },
  errorText: { color: '#ffd7d7', fontSize: 12 },
  invWrap: { backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d' },
  invContent: { padding: 8, gap: 8 },
  invEmpty: { color: '#8b949e', fontSize: 12, padding: 14 },
  invItem: {
    minWidth: 92,
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  invName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  invSub: { color: '#8b949e', fontSize: 11, marginTop: 2 },
});
