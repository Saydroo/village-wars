import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { getBuildingMaxLevel } from '@village-wars/shared';
import { useAppStore } from '../store';
import { BattleCanvas } from '../components/battle/BattleCanvas';
import { BattleResultOverlay } from '../components/battle/BattleResultOverlay';
import { DeployBar } from '../components/battle/DeployBar';
import { JuicyButton } from '../components/ui/JuicyButton';

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function BattleScreen(): React.ReactElement {
  const {
    config,
    player,
    battlePhase,
    battleSetup,
    battleUpdate,
    battleEnded,
    deployReserve,
    selectedDeployType,
    battleError,
    cancelMatchmaking,
    startBattle,
    setDeployType,
    deployAt,
    surrenderBattle,
    leaveBattle,
    reduceEffects,
    activeSkins,
  } = useAppStore();

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  if (!config || !player) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Lade …</Text>
      </View>
    );
  }

  // --- Suche ---
  if (battlePhase === 'searching') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f0c040" />
        <Text style={styles.title}>Suche Gegner …</Text>
        <Text style={styles.muted}>Online-Gegner in deiner Trophäen-Spanne · Bot nach 90s</Text>
        {battleError ? <Text style={styles.err}>{battleError}</Text> : null}
        <Pressable style={styles.btnGhost} onPress={cancelMatchmaking}>
          <Text style={styles.btnGhostText}>Abbrechen</Text>
        </Pressable>
      </View>
    );
  }

  if (!battleSetup) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Bereite Kampf vor …</Text>
        {battleError ? <Text style={styles.err}>{battleError}</Text> : null}
        <Pressable style={styles.btnGhost} onPress={leaveBattle}>
          <Text style={styles.btnGhostText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const timer = battleUpdate?.timer ?? battleSetup.duration_seconds;
  const destruction = battleUpdate?.destruction_pct ?? 0;
  const maxLevelFor = (type: string) => getBuildingMaxLevel(config, type) ?? 10;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.vs}>
          ⚔️ {player.username} → {battleSetup.defender_username}
          {battleSetup.is_bot ? ' 🤖' : ''}
        </Text>
        <View style={styles.statRow}>
          <Text style={styles.timer}>⏱ {fmtTime(timer)}</Text>
          <Text style={styles.dest}>💥 {destruction}%</Text>
        </View>
      </View>
      <View style={styles.destTrack}>
        <View style={[styles.destFill, { width: `${Math.min(100, destruction)}%` }]} />
      </View>

      <View style={styles.canvasWrap} onLayout={onLayout}>
        {size ? (
          <BattleCanvas
            width={size.w}
            height={size.h}
            gridWidth={battleSetup.grid_width}
            gridHeight={battleSetup.grid_height}
            buildings={battleSetup.buildings}
            update={battleUpdate}
            effects={config.effects}
            reduceEffects={reduceEffects}
            maxLevelFor={maxLevelFor}
            unitSkins={activeSkins.units}
            faction={battleSetup.defender_faction}
            onTapTile={(gx, gy) => deployAt(gx, gy)}
          />
        ) : null}

        {battlePhase === 'setup' ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.overlayCard}>
              <Text style={styles.title}>Gegnerisches Dorf</Text>
              <Text style={styles.muted}>
                {battleSetup.defender_faction} · {battleSetup.buildings.length} Gebäude
              </Text>
              <JuicyButton style={styles.btnPrimary} onPress={startBattle}>
                <Text style={styles.btnPrimaryText}>Kampf starten</Text>
              </JuicyButton>
              <JuicyButton style={styles.btnGhost} cue="button" onPress={leaveBattle}>
                <Text style={styles.btnGhostText}>Zurückziehen</Text>
              </JuicyButton>
            </View>
          </View>
        ) : null}

        {battlePhase === 'ended' && battleEnded ? (
          <BattleResultOverlay ended={battleEnded} reduceEffects={reduceEffects} onClose={leaveBattle} />
        ) : null}
      </View>

      {battleError ? (
        <Pressable onPress={() => useAppStore.setState({ battleError: null })} style={styles.errBar}>
          <Text style={styles.errBarText}>{battleError} (tippen zum Schließen)</Text>
        </Pressable>
      ) : null}

      {battlePhase === 'fighting' ? (
        <>
          <Pressable style={styles.surrender} onPress={surrenderBattle}>
            <Text style={styles.surrenderText}>🏳 Aufgeben</Text>
          </Pressable>
          <DeployBar
            config={config}
            faction={player.faction}
            reserve={deployReserve}
            selectedType={selectedDeployType}
            onSelect={setDeployType}
            hero={battleSetup.hero}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', gap: 12, padding: 24 },
  muted: { color: '#8b949e', textAlign: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  err: { color: '#ff6b6b', fontSize: 13 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#161b22' },
  vs: { color: '#c9d1d9', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  statRow: { flexDirection: 'row', gap: 12 },
  timer: { color: '#9ecbff', fontSize: 14, fontWeight: '800' },
  dest: { color: '#ffb454', fontSize: 14, fontWeight: '800' },
  destTrack: { height: 6, backgroundColor: '#21262d' },
  destFill: { height: 6, backgroundColor: '#ffb454' },
  canvasWrap: { flex: 1, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117aa' },
  overlayCard: { backgroundColor: '#161b22', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#30363d', minWidth: 260 },
  btnPrimary: { backgroundColor: '#f0c040', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  btnPrimaryText: { color: '#1a1a1a', fontWeight: '800', fontSize: 15 },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 20 },
  btnGhostText: { color: '#8b949e', fontWeight: '700' },
  surrender: { position: 'absolute', right: 12, bottom: 96, backgroundColor: '#5a1d1d', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#7a2b2b' },
  surrenderText: { color: '#ffd7d7', fontWeight: '700', fontSize: 13 },
  errBar: { backgroundColor: '#5a1d1d', paddingVertical: 8, paddingHorizontal: 12 },
  errBarText: { color: '#ffd7d7', fontSize: 12 },
});
