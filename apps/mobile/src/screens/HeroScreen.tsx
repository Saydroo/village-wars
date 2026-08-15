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
import { useAppStore } from '../store';

/**
 * Helden-Screen (Roadmap P6). Zeigt den Fraktions-Helden mit Level,
 * HP/DPS-Werten, Regen-Timer, Level-Up-Button und Fähigkeitsbeschreibung.
 */
export function HeroScreen(): React.ReactElement {
  const hero = useAppStore((s) => s.hero);
  const player = useAppStore((s) => s.player);
  const loadHero = useAppStore((s) => s.loadHero);
  const startLevelUp = useAppStore((s) => s.startHeroLevelUpAction);
  const cancelLevelUp = useAppStore((s) => s.cancelHeroLevelUpAction);
  const setScreen = useAppStore((s) => s.setScreen);
  const config = useAppStore((s) => s.config);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void loadHero();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!hero) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  const faction = player?.faction ?? 'humans';
  const heroDef = config?.heroes?.faction_heroes?.[faction as keyof typeof config.heroes.faction_heroes];

  const isLeveling = !!(hero.leveling_until && new Date(hero.leveling_until).getTime() > now);
  const isRegen = !!(hero.regenerates_until && new Date(hero.regenerates_until).getTime() > now);
  const isReady = !isLeveling && !isRegen;

  function secondsLeft(iso: string | null): number {
    if (!iso) return 0;
    return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  }

  function fmtTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const nextLevelCost = config?.heroes?.level_costs?.find(
    (c) => c.to_level === hero.level + 1,
  );
  const maxLevel = config?.heroes?.max_level ?? 10;

  const handleLevelUp = () => {
    if (!nextLevelCost) return;
    Alert.alert(
      'Held aufwerten',
      `Level ${hero.level} → ${hero.level + 1}\nKosten: ${nextLevelCost.gold} Gold · ${nextLevelCost.minutes >= 60 ? `${Math.round(nextLevelCost.minutes / 60)}h` : `${nextLevelCost.minutes}m`}`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Aufwerten', onPress: () => void startLevelUp() },
      ],
    );
  };

  const handleCancelLevelUp = () => {
    Alert.alert('Upgrade abbrechen', 'Gold wird NICHT erstattet.', [
      { text: 'Nein', style: 'cancel' },
      { text: 'Abbrechen', onPress: () => void cancelLevelUp() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.back}>
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
        <Text style={styles.title}>🦸 Heldenhalle</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {hero.no_hall ? (
          <View style={styles.gateCard}>
            <Text style={styles.gateIcon}>🏛️</Text>
            <Text style={styles.gateText}>Baue die Heldenhalle (TH5), um deinen Helden zu aktivieren.</Text>
          </View>
        ) : (
          <>
            {/* Helden-Karte */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroIcon}>🦸</Text>
                <View style={styles.heroInfo}>
                  <Text style={styles.heroName}>{hero.display_name ?? '—'}</Text>
                  <Text style={styles.heroLevel}>Level {hero.level}</Text>
                  <View style={styles.statRow}>
                    <Text style={styles.stat}>❤️ {hero.base_hp} HP</Text>
                    <Text style={styles.stat}>⚔️ {hero.base_dps} DPS</Text>
                  </View>
                </View>
              </View>

              {/* Status-Anzeige */}
              {isLeveling && (
                <View style={styles.statusBox}>
                  <Text style={styles.statusLabel}>⬆️ Upgrade läuft…</Text>
                  <Text style={styles.statusTime}>{fmtTime(secondsLeft(hero.leveling_until))}</Text>
                  <Pressable style={styles.cancelBtn} onPress={handleCancelLevelUp}>
                    <Text style={styles.cancelBtnText}>Abbrechen</Text>
                  </Pressable>
                </View>
              )}

              {isRegen && !isLeveling && (
                <View style={[styles.statusBox, styles.regenBox]}>
                  <Text style={styles.statusLabel}>💤 Regeneriert…</Text>
                  <Text style={styles.statusTime}>{fmtTime(secondsLeft(hero.regenerates_until))}</Text>
                </View>
              )}

              {isReady && (
                <View style={[styles.statusBox, styles.readyBox]}>
                  <Text style={styles.readyLabel}>✅ Bereit für den Kampf</Text>
                </View>
              )}
            </View>

            {/* Fähigkeit */}
            {heroDef?.ability && (
              <View style={styles.abilityCard}>
                <Text style={styles.abilityTitle}>Fähigkeit</Text>
                <Text style={styles.abilityText}>{heroDef.ability}</Text>
              </View>
            )}

            {/* Level-Up */}
            {hero.level < maxLevel ? (
              <View style={styles.levelupCard}>
                <Text style={styles.levelupTitle}>Nächstes Level ({hero.level + 1})</Text>
                {nextLevelCost ? (
                  <>
                    <Text style={styles.levelupCost}>
                      {nextLevelCost.gold.toLocaleString()} Gold · {nextLevelCost.minutes >= 60 ? `${Math.round(nextLevelCost.minutes / 60)}h` : `${nextLevelCost.minutes}m`}
                    </Text>
                    <Pressable
                      style={[styles.levelupBtn, (!isReady || !!isLeveling) && styles.btnDisabled]}
                      disabled={!isReady || isLeveling}
                      onPress={handleLevelUp}
                    >
                      <Text style={styles.levelupBtnText}>Aufwerten</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.levelupCost}>—</Text>
                )}
              </View>
            ) : (
              <View style={styles.levelupCard}>
                <Text style={styles.maxLabel}>🏆 Maximales Level erreicht!</Text>
              </View>
            )}
          </>
        )}
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  gateCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 20, alignItems: 'center', gap: 12 },
  gateIcon: { fontSize: 40 },
  gateText: { color: '#aaa', textAlign: 'center', fontSize: 14 },
  heroCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f5c518' },
  heroTop: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  heroIcon: { fontSize: 48 },
  heroInfo: { flex: 1, justifyContent: 'center' },
  heroName: { color: '#f5c518', fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  heroLevel: { color: '#ccc', fontSize: 14, marginBottom: 6 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { color: '#7ec8e3', fontSize: 13 },
  statusBox: { backgroundColor: '#0f3460', borderRadius: 8, padding: 12, alignItems: 'center', gap: 4 },
  regenBox: { backgroundColor: '#1a3a2a' },
  readyBox: { backgroundColor: '#1a3a1a' },
  statusLabel: { color: '#ccc', fontSize: 13 },
  statusTime: { color: '#f5c518', fontSize: 20, fontWeight: 'bold' },
  readyLabel: { color: '#4caf50', fontSize: 14, fontWeight: 'bold' },
  cancelBtn: { marginTop: 6, backgroundColor: '#c0392b', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  cancelBtnText: { color: '#fff', fontSize: 12 },
  abilityCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#7ec8e3' },
  abilityTitle: { color: '#7ec8e3', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  abilityText: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  levelupCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#555' },
  levelupTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  levelupCost: { color: '#aaa', fontSize: 13, marginBottom: 10 },
  levelupBtn: { backgroundColor: '#f5c518', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  levelupBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 14 },
  maxLabel: { color: '#f5c518', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
