import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { unitsForFaction, getResearchCost, researchHpMultiplier, researchDpsMultiplier } from '@village-wars/shared';
import { useAppStore } from '../store';

/**
 * Forschungslabor-Screen (Roadmap P3). Zeigt alle Einheiten der Fraktion mit
 * ihrem aktuellen Level, dem HP/DPS-Bonus und dem Forschungs-Button.
 * Voraussetzung: research_lab im Dorf gebaut.
 */
export function ResearchScreen(): React.ReactElement {
  const config = useAppStore((s) => s.config);
  const player = useAppStore((s) => s.player);
  const buildings = useAppStore((s) => s.buildings);
  const research = useAppStore((s) => s.research);
  const loadResearch = useAppStore((s) => s.loadResearch);
  const startResearch = useAppStore((s) => s.startResearchAction);
  const cancelResearch = useAppStore((s) => s.cancelResearchAction);
  const setScreen = useAppStore((s) => s.setScreen);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  if (!config || !player) return <View style={s.container} />;

  const faction = player.faction as Parameters<typeof unitsForFaction>[1];
  const units = unitsForFaction(config, faction);
  const unitLevels = research?.unit_levels ?? {};
  const active = research?.active ?? null;
  const maxLevel = config.unit_research.max_level;

  const hasLab = buildings.some((b) => b.building_type === 'research_lab' && b.level >= 1);

  async function onStart(unitType: string): Promise<void> {
    setBusy(true);
    try {
      await startResearch(unitType);
    } catch {
      Alert.alert('Fehler', 'Forschung konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(): Promise<void> {
    Alert.alert('Forschung abbrechen', 'Das investierte Gold wird nicht erstattet.', [
      { text: 'Weiter forschen', style: 'cancel' },
      {
        text: 'Abbrechen',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          cancelResearch().finally(() => setBusy(false));
        },
      },
    ]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => setScreen('village')} style={s.backBtn}>
          <Text style={s.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={s.title}>🔬 Forschungslabor</Text>
        <View style={{ width: 56 }} />
      </View>

      {!hasLab && (
        <View style={s.noLab}>
          <Text style={s.noLabText}>🏗️ Baue zuerst ein Forschungslabor (RH 3).</Text>
        </View>
      )}

      {active && (
        <View style={s.activeCard}>
          <View style={s.activeRow}>
            <Text style={s.activeLabel}>⚗️ Aktive Forschung</Text>
            <Pressable onPress={() => void onCancel()} disabled={busy}>
              <Text style={s.cancelBtn}>✕</Text>
            </Pressable>
          </View>
          <Text style={s.activeName}>
            {units.find((u) => u.id === active.unit_type)?.display_name ?? active.unit_type}
            {' → '}Lvl {active.target_level}
          </Text>
          <Text style={s.activeTimer}>
            Fertig: {new Date(active.finishes_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list}>
        {units.map((unit) => {
          const level = unitLevels[unit.id] ?? 1;
          const maxed = level >= maxLevel;
          const isResearching = active?.unit_type === unit.id;
          const nextLevel = level + 1;
          const cost = !maxed ? getResearchCost(config, nextLevel) : null;
          const hpBonus = Math.round((researchHpMultiplier(config, level) - 1) * 100);
          const dpsBonus = Math.round((researchDpsMultiplier(config, level) - 1) * 100);

          return (
            <View key={unit.id} style={[s.card, isResearching && s.cardActive]}>
              <View style={s.cardTop}>
                <View style={s.cardInfo}>
                  <Text style={s.unitName}>{unit.display_name}</Text>
                  <Text style={s.unitSub}>
                    {unit.role.replace(/_/g, ' ')} · RH {unit.unlock_town_hall_level}
                  </Text>
                </View>
                <View style={s.levelBadge}>
                  <Text style={s.levelText}>Lvl {level}</Text>
                  {maxed && <Text style={s.maxText}>MAX</Text>}
                </View>
              </View>

              {level > 1 && (
                <Text style={s.bonusText}>
                  +{hpBonus}% HP · +{dpsBonus}% DPS
                </Text>
              )}

              {!maxed && !isResearching && hasLab && cost && !active && (
                <Pressable
                  style={[s.researchBtn, busy && s.btnDisabled]}
                  disabled={busy}
                  onPress={() => void onStart(unit.id)}
                >
                  {busy ? (
                    <ActivityIndicator color="#0d1117" size="small" />
                  ) : (
                    <Text style={s.researchBtnText}>
                      Lvl {nextLevel} erforschen · 🪙 {cost.gold.toLocaleString('de-DE')} · {cost.minutes >= 60 ? `${cost.minutes / 60}h` : `${cost.minutes}min`}
                    </Text>
                  )}
                </Pressable>
              )}

              {isResearching && (
                <Text style={s.researchingText}>⚗️ Wird erforscht …</Text>
              )}

              {!hasLab && !maxed && (
                <Text style={s.lockedText}>🔒 Labor benötigt</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: '#58a6ff', fontSize: 16, fontWeight: '700' },
  title: { color: '#58a6ff', fontSize: 17, fontWeight: '900' },
  noLab: {
    margin: 12,
    padding: 14,
    backgroundColor: '#161b22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0c040',
  },
  noLabText: { color: '#f0c040', fontSize: 13, textAlign: 'center', fontWeight: '700' },
  activeCard: {
    margin: 12,
    marginBottom: 0,
    padding: 12,
    backgroundColor: '#1c2128',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#58a6ff',
    gap: 4,
  },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeLabel: { color: '#58a6ff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  cancelBtn: { color: '#f85149', fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  activeName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  activeTimer: { color: '#8b949e', fontSize: 12 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 12,
    gap: 8,
  },
  cardActive: { borderColor: '#58a6ff' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardInfo: { flex: 1 },
  unitName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  unitSub: { color: '#8b949e', fontSize: 11, marginTop: 1 },
  levelBadge: { alignItems: 'center' },
  levelText: { color: '#f0c040', fontSize: 16, fontWeight: '900' },
  maxText: { color: '#3fb950', fontSize: 10, fontWeight: '900' },
  bonusText: { color: '#3fb950', fontSize: 12, fontWeight: '700' },
  researchBtn: {
    backgroundColor: '#58a6ff',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  researchBtnText: { color: '#0d1117', fontSize: 13, fontWeight: '900' },
  researchingText: { color: '#58a6ff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  lockedText: { color: '#8b949e', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
