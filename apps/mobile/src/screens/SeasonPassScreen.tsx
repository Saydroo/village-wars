import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SeasonPassReward, SeasonPassTierView } from '@village-wars/shared';
import { useAppStore } from '../store';

/**
 * Season-/Battle-Pass-Screen (Roadmap P7). Zeigt XP-Fortschritt, Premium-Freischaltung
 * (mit Gems) und die Belohnungsleiter mit Gratis-/Premium-Track und Abhol-Buttons.
 */

/** Belohnung als kompakte Zeichenkette (z.B. „500 Gold · 5 💎"). */
function rewardText(r: SeasonPassReward): string {
  const parts: string[] = [];
  if (r.wood) parts.push(`🪵 ${r.wood}`);
  if (r.stone) parts.push(`🪨 ${r.stone}`);
  if (r.gold) parts.push(`🪙 ${r.gold}`);
  if (r.gems) parts.push(`💎 ${r.gems}`);
  if (r.gold_bars) parts.push(`🥇 ${r.gold_bars}`);
  return parts.length ? parts.join(' · ') : '—';
}

export function SeasonPassScreen(): React.ReactElement {
  const pass = useAppStore((s) => s.seasonPass);
  const loadSeasonPass = useAppStore((s) => s.loadSeasonPass);
  const unlock = useAppStore((s) => s.unlockSeasonPassAction);
  const claim = useAppStore((s) => s.claimSeasonPassAction);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    void loadSeasonPass();
  }, []);

  if (!pass) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
      </View>
    );
  }

  const handleUnlock = () => {
    Alert.alert(
      'Premium-Pass freischalten',
      `Schaltet alle Premium-Belohnungen dieser Saison frei.\nKosten: ${pass.premium_cost_gems} 💎`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Freischalten', onPress: () => void unlock() },
      ],
    );
  };

  // Fortschrittsbalken zur nächsten Stufe.
  const nextXp = pass.next_tier_xp;
  const progressPct = nextXp === null ? 100 : Math.min(100, Math.round((pass.xp / nextXp) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.back}>
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
        <Text style={styles.title}>🎟️ Season-Pass</Text>
        <Text style={styles.subtitle}>
          Saison {pass.season_number} · Stufe {pass.current_tier}/{pass.max_tier}
        </Text>
      </View>

      {/* XP-Fortschritt */}
      <View style={styles.xpCard}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>⭐ {pass.xp} XP</Text>
          <Text style={styles.xpNext}>
            {nextXp === null ? 'Maximum erreicht' : `nächste Stufe bei ${nextXp}`}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {/* Premium-Freischaltung */}
      {pass.premium_unlocked ? (
        <View style={styles.premiumActive}>
          <Text style={styles.premiumActiveText}>✨ Premium-Pass aktiv</Text>
        </View>
      ) : (
        <Pressable style={styles.unlockBtn} onPress={handleUnlock}>
          <Text style={styles.unlockText}>✨ Premium freischalten · {pass.premium_cost_gems} 💎</Text>
        </Pressable>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.legendRow}>
          <Text style={styles.legendFree}>GRATIS</Text>
          <Text style={styles.legendPrem}>PREMIUM</Text>
        </View>
        {pass.tiers.map((t) => (
          <TierRow
            key={t.tier}
            tier={t}
            premiumUnlocked={pass.premium_unlocked}
            onClaim={claim}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function TierRow({
  tier,
  premiumUnlocked,
  onClaim,
}: {
  tier: SeasonPassTierView;
  premiumUnlocked: boolean;
  onClaim: (tier: number, track: 'free' | 'premium') => void;
}): React.ReactElement {
  const freeClaimable = tier.reached && !tier.free_claimed;
  const premiumClaimable = tier.reached && premiumUnlocked && !tier.premium_claimed;

  return (
    <View style={[styles.tierRow, !tier.reached && styles.tierLocked]}>
      <View style={styles.tierBadge}>
        <Text style={styles.tierNum}>{tier.tier}</Text>
      </View>

      {/* Gratis-Track */}
      <View style={styles.trackCell}>
        <Text style={styles.rewardLabel}>{rewardText(tier.free)}</Text>
        {tier.free_claimed ? (
          <Text style={styles.claimed}>✓ Abgeholt</Text>
        ) : freeClaimable ? (
          <Pressable style={styles.claimBtn} onPress={() => onClaim(tier.tier, 'free')}>
            <Text style={styles.claimBtnText}>Abholen</Text>
          </Pressable>
        ) : (
          <Text style={styles.locked}>{tier.reached ? '' : '🔒'}</Text>
        )}
      </View>

      {/* Premium-Track */}
      <View style={[styles.trackCell, styles.premCell]}>
        <Text style={styles.rewardLabel}>{rewardText(tier.premium)}</Text>
        {tier.premium_claimed ? (
          <Text style={styles.claimed}>✓ Abgeholt</Text>
        ) : premiumClaimable ? (
          <Pressable style={[styles.claimBtn, styles.claimBtnPrem]} onPress={() => onClaim(tier.tier, 'premium')}>
            <Text style={styles.claimBtnText}>Abholen</Text>
          </Pressable>
        ) : (
          <Text style={styles.locked}>{!premiumUnlocked ? '🔒' : tier.reached ? '' : '🔒'}</Text>
        )}
      </View>
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
  subtitle: { color: '#aaa', fontSize: 13, marginTop: 2 },
  xpCard: { backgroundColor: '#16213e', margin: 12, marginBottom: 8, borderRadius: 12, padding: 14 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  xpLabel: { color: '#f5c518', fontSize: 16, fontWeight: 'bold' },
  xpNext: { color: '#aaa', fontSize: 12 },
  barTrack: { height: 10, backgroundColor: '#0f1626', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#f5c518', borderRadius: 5 },
  premiumActive: { backgroundColor: '#2a2208', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37' },
  premiumActiveText: { color: '#f5d76e', fontSize: 14, fontWeight: 'bold' },
  unlockBtn: { backgroundColor: '#7b5cff', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 12, alignItems: 'center' },
  unlockText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingTop: 4, gap: 8 },
  legendRow: { flexDirection: 'row', paddingLeft: 48, marginBottom: 2 },
  legendFree: { flex: 1, color: '#7ec8e3', fontSize: 11, fontWeight: 'bold' },
  legendPrem: { flex: 1, color: '#f5d76e', fontSize: 11, fontWeight: 'bold', paddingLeft: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, padding: 10, gap: 8 },
  tierLocked: { opacity: 0.55 },
  tierBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0f3460', alignItems: 'center', justifyContent: 'center' },
  tierNum: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  trackCell: { flex: 1, gap: 4 },
  premCell: { borderLeftWidth: 1, borderLeftColor: '#333', paddingLeft: 8 },
  rewardLabel: { color: '#ddd', fontSize: 12 },
  claimBtn: { backgroundColor: '#f5c518', borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, alignSelf: 'flex-start' },
  claimBtnPrem: { backgroundColor: '#d4af37' },
  claimBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 11 },
  claimed: { color: '#4caf50', fontSize: 11, fontWeight: 'bold' },
  locked: { color: '#666', fontSize: 12 },
});
