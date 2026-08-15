import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FactionId, GameConfig } from '@village-wars/shared';
import { useAppStore } from '../store';
import { DungeonBattleView } from '../components/battle/DungeonBattleView';

/** Anzeigename einer Einheit (gemeinsam oder fraktionsexklusiv). */
function unitName(config: GameConfig, type: string, faction: FactionId): string {
  const common = config.units_common[type];
  if (common && typeof common === 'object' && common.display_name) return common.display_name;
  const ex = config.factions_exclusive_content[faction]?.exclusive_units.find((u) => u.id === type);
  return ex?.display_name ?? type;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '–';
  try {
    return (
      new Date(iso).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' Uhr'
    );
  } catch {
    return iso;
  }
}

function unitMapLine(config: GameConfig, faction: FactionId, m: Record<string, number>): string {
  const parts = Object.entries(m)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${unitName(config, t, faction)} ×${n}`);
  return parts.length > 0 ? parts.join(' · ') : 'keine';
}

/**
 * Dungeon (PvE, Phase 5). Schwierigkeit wählen, Lauf starten, Wellen nacheinander
 * bestreiten. Die Gegner sind VORHER verborgen (Spannung); jede Welle wird als
 * animierter Kampf abgespielt (DungeonBattleView), danach werden Ergebnis +
 * Gegner enthüllt. Belohnung skaliert mit der Schwierigkeit.
 */
export function DungeonScreen(): React.ReactElement {
  const {
    config,
    player,
    dungeonStatus,
    dungeonArmy,
    dungeonLastWave,
    dungeonDifficulty,
    dungeonBattlePlaying,
    p5Loading,
    p5Error,
    loadDungeon,
    setDungeonDifficulty,
    startDungeonRun,
    doDungeonWave,
    finishDungeonBattle,
    resetDungeonResult,
    setScreen,
    activeSkins,
  } = useAppStore();

  const [bodySize, setBodySize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    void loadDungeon();
  }, [loadDungeon]);

  if (!config || !player) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  const faction = player.faction;
  const run = dungeonStatus?.run ?? null;
  const totalWaves = dungeonStatus?.total_waves ?? config.dungeon.structure.waves;
  const inProgress = run?.status === 'in_progress';
  const result = dungeonLastWave;
  const difficulties = config.dungeon.difficulties;
  const curDiff = difficulties.find((d) => d.id === (run?.difficulty ?? dungeonDifficulty));

  const onBodyLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBodySize({ w: width, h: height });
  };

  // --- Kampf-Animation läuft: Vollbild-Replay ---
  if (dungeonBattlePlaying && result?.replay) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗝️ Dungeon — Kampf</Text>
        </View>
        <View style={styles.body} onLayout={onBodyLayout}>
          {bodySize ? (
            <DungeonBattleView
              width={bodySize.w}
              height={bodySize.h}
              replay={result.replay}
              isBoss={result.is_boss}
              waveLabel={result.is_boss ? '☠️ Endboss' : `Welle ${result.wave}`}
              unitSkins={activeSkins.units}
              onDone={finishDungeonBattle}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={styles.title}>🗝️ Dungeon</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={[styles.statusBar, dungeonStatus?.open ? styles.statusOpen : styles.statusClosed]}>
        <Text style={styles.statusText}>
          {dungeonStatus?.open
            ? `Geöffnet · schließt ${fmtDate(dungeonStatus.closes_at)}`
            : `Geschlossen · öffnet ${fmtDate(dungeonStatus?.opens_at ?? null)}`}
        </Text>
      </View>

      {p5Error ? <Text style={styles.error}>{p5Error}</Text> : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Run-Ende-Ergebnis */}
        {result?.finished ? (
          <View style={[styles.card, result.run.status === 'won' ? styles.cardWin : styles.cardLose]}>
            <Text style={styles.cardTitle}>
              {result.run.status === 'won' ? '🏆 Dungeon bezwungen!' : '💀 Dungeon-Lauf beendet'}
            </Text>
            <Text style={styles.cardLine}>
              {result.run.waves_completed}/{totalWaves} Wellen
              {result.run.boss_defeated ? ' + Boss' : ''} geschafft ·{' '}
              {curDiff?.display_name ?? result.run.difficulty}
            </Text>
            <Text style={styles.enemyLine}>
              Letzte Gegner: {unitMapLine(config, faction, result.enemies_faced)}
            </Text>
            {result.rewards ? (
              <Text style={styles.rewardLine}>
                Belohnung ({result.rewards.tier_label ?? '–'}): +{result.rewards.gold} Gold ·
                +{result.rewards.gems} 💎
              </Text>
            ) : null}
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                resetDungeonResult();
                void loadDungeon();
              }}
            >
              <Text style={styles.primaryText}>OK</Text>
            </Pressable>
          </View>
        ) : result ? (
          <View style={[styles.card, result.cleared ? styles.cardWin : styles.cardLose]}>
            <Text style={styles.cardTitle}>
              {result.cleared
                ? `✅ ${result.is_boss ? 'Boss' : `Welle ${result.wave}`} bezwungen!`
                : `❌ ${result.is_boss ? 'Boss' : `Welle ${result.wave}`} nicht geschafft`}
            </Text>
            <Text style={styles.enemyLine}>
              Gegner: {unitMapLine(config, faction, result.enemies_faced)}
            </Text>
            <Text style={styles.cardLine}>
              Verbleibende Armee: {unitMapLine(config, faction, result.army_remaining)}
            </Text>
          </View>
        ) : null}

        {/* Laufender Lauf */}
        {inProgress ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lauf läuft · {curDiff?.display_name ?? run?.difficulty}</Text>
            <Text style={styles.cardLine}>
              Fortschritt: {run?.waves_completed ?? 0}/{totalWaves} Wellen
              {dungeonStatus?.has_boss ? ' + Boss' : ''}
            </Text>
            <Text style={styles.cardLine}>Deine Armee: {unitMapLine(config, faction, dungeonArmy)}</Text>
            <Pressable
              style={[styles.primaryBtn, p5Loading && styles.btnDisabled]}
              disabled={p5Loading}
              onPress={() => void doDungeonWave()}
            >
              <Text style={styles.primaryText}>
                {p5Loading
                  ? 'Kämpft …'
                  : (run?.waves_completed ?? 0) >= totalWaves
                    ? '☠️ Boss angreifen'
                    : '⚔️ Nächste Welle'}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Kein Lauf aktiv: Schwierigkeit wählen + starten */
          <View style={styles.card}>
            {!dungeonStatus?.open ? (
              <Text style={styles.cardLine}>Der Dungeon ist gerade geschlossen. Öffnet samstags 05:00 Uhr.</Text>
            ) : dungeonStatus?.completed_this_week ? (
              <Text style={styles.cardLine}>Du hast den Dungeon dieses Wochenende bereits abgeschlossen. Bis nächste Woche!</Text>
            ) : (
              <>
                <Text style={styles.cardTitle}>Schwierigkeit wählen</Text>
                <View style={styles.diffRow}>
                  {difficulties.map((d) => {
                    const active = d.id === dungeonDifficulty;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => setDungeonDifficulty(d.id)}
                        style={[styles.diffBtn, active && styles.diffBtnActive]}
                      >
                        <Text style={[styles.diffName, active && styles.diffNameActive]}>{d.display_name}</Text>
                        <Text style={[styles.diffSub, active && styles.diffSubActive]}>
                          ×{d.reward_multiplier} Beute
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.cardLine}>
                  Deine gesamte Armee zieht in {totalWaves} Wellen{dungeonStatus?.has_boss ? ' + Endboss' : ''}.
                  Welche Gegner warten, siehst du erst im Kampf. Gefallene Einheiten gehen verloren.
                </Text>
                <Pressable
                  style={[styles.primaryBtn, p5Loading && styles.btnDisabled]}
                  disabled={p5Loading}
                  onPress={() => void startDungeonRun()}
                >
                  <Text style={styles.primaryText}>{p5Loading ? 'Starte …' : '🗝️ Lauf starten'}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Wellen-Übersicht — Gegner VERBORGEN */}
        <Text style={styles.sectionTitle}>Wellen (Gegner verborgen)</Text>
        {Array.from({ length: totalWaves }, (_, i) => i + 1).map((w) => {
          const done = (run?.waves_completed ?? 0) >= w;
          return (
            <View key={w} style={[styles.waveRow, done && styles.waveDone]}>
              <Text style={styles.waveNum}>{done ? '✓' : w}</Text>
              <Text style={styles.waveText}>{done ? 'bezwungen' : 'Welle ' + w + ' · ❓ unbekannt'}</Text>
            </View>
          );
        })}
        {config.dungeon.structure.final_boss ? (
          <View style={[styles.waveRow, styles.bossRow, run?.boss_defeated && styles.waveDone]}>
            <Text style={styles.waveNum}>{run?.boss_defeated ? '✓' : '☠️'}</Text>
            <Text style={styles.waveText}>Endboss · ❓ unbekannt</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backText: { color: '#9ecbff', fontSize: 14, fontWeight: '700' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statusBar: { paddingVertical: 8, paddingHorizontal: 12 },
  statusOpen: { backgroundColor: '#16361f' },
  statusClosed: { backgroundColor: '#2a2030' },
  statusText: { color: '#c9d1d9', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  error: { color: '#ffd7d7', backgroundColor: '#5a1d1d', padding: 8, fontSize: 12 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    gap: 8,
  },
  cardWin: { borderColor: '#2ea043', backgroundColor: '#102818' },
  cardLose: { borderColor: '#b5443f', backgroundColor: '#2a1414' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardLine: { color: '#c9d1d9', fontSize: 13, lineHeight: 18 },
  enemyLine: { color: '#ff9f9f', fontSize: 13, lineHeight: 18 },
  rewardLine: { color: '#f0c040', fontSize: 14, fontWeight: '800' },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diffBtn: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  diffBtnActive: { backgroundColor: '#2b2410', borderColor: '#f0c040' },
  diffName: { color: '#c9d1d9', fontSize: 14, fontWeight: '800' },
  diffNameActive: { color: '#f0c040' },
  diffSub: { color: '#8b949e', fontSize: 11, marginTop: 2 },
  diffSubActive: { color: '#d8b85a' },
  primaryBtn: {
    backgroundColor: '#7a2b2b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b5443f',
    marginTop: 4,
  },
  primaryText: { color: '#ffd7d7', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  sectionTitle: { color: '#8b949e', fontSize: 12, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    gap: 10,
  },
  bossRow: { borderColor: '#7a2b2b' },
  waveDone: { opacity: 0.55, borderColor: '#2ea043' },
  waveNum: { color: '#f0c040', fontSize: 14, fontWeight: '800', width: 28, textAlign: 'center' },
  waveText: { color: '#c9d1d9', fontSize: 13, flex: 1 },
});
