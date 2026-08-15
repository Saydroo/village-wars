import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IapPackage, ShopSkin } from '@village-wars/shared';
import { useAppStore } from '../store';

type Tab = 'skins' | 'bars';

const TARGET_LABEL: Record<string, string> = {
  unit: 'Einheit',
  building: 'Gebäude',
  village_theme: 'Dorf-Theme',
};

/**
 * Shop (Phase 5). Skin-Galerie (rein kosmetisch: Kauf + Anwenden gegen Goldbarren)
 * und Goldbarren-Pakete (IAP). Goldbarren sind die einzige käufliche Währung —
 * kein Pay-to-Win.
 */
export function ShopScreen(): React.ReactElement {
  const {
    player,
    shopSkins,
    barPackages,
    p5Loading,
    p5Error,
    loadShop,
    buySkinAction,
    applySkinAction,
    buyBarsAction,
    setScreen,
  } = useAppStore();
  const [tab, setTab] = useState<Tab>('skins');

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={styles.title}>🛒 Shop</Text>
        <Text style={styles.bars}>{player?.gold_bars ?? 0} 🪙</Text>
      </View>

      <View style={styles.tabs}>
        {(['skins', 'bars'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'skins' ? 'Skins' : 'Goldbarren'}
            </Text>
          </Pressable>
        ))}
      </View>

      {p5Error ? <Text style={styles.error}>{p5Error}</Text> : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {p5Loading && shopSkins.length === 0 && barPackages.length === 0 ? (
          <ActivityIndicator color="#f0c040" style={{ marginTop: 24 }} />
        ) : tab === 'skins' ? (
          shopSkins.length === 0 ? (
            <Text style={styles.empty}>Keine Skins verfügbar.</Text>
          ) : (
            shopSkins.map((s) => (
              <SkinRow
                key={s.id}
                skin={s}
                canAfford={(player?.gold_bars ?? 0) >= s.price_bars}
                onBuy={() => void buySkinAction(s.id)}
                onApply={() => void applySkinAction(s.id, !s.applied)}
              />
            ))
          )
        ) : barPackages.length === 0 ? (
          <Text style={styles.empty}>Keine Pakete verfügbar.</Text>
        ) : (
          barPackages.map((p) => (
            <BarRow key={p.product_id} pkg={p} loading={p5Loading} onBuy={() => void buyBarsAction(p.product_id)} />
          ))
        )}
        {tab === 'bars' ? (
          <Text style={styles.note}>
            Käufe laufen lokal im Sandbox-Modus (Testbeleg). Auf einem echten Gerät liefert das Apple-/Google-Store-SDK
            den Beleg, der serverseitig verifiziert wird.
          </Text>
        ) : (
          <Text style={styles.note}>Skins sind rein kosmetisch und ändern keine Kampf- oder Wirtschaftswerte.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function SkinRow({
  skin,
  canAfford,
  onBuy,
  onApply,
}: {
  skin: ShopSkin;
  canAfford: boolean;
  onBuy: () => void;
  onApply: () => void;
}): React.ReactElement {
  const swatch = (skin.preview_data?.primary as string) ?? (skin.preview_data?.ground as string) ?? '#30363d';
  const accent = (skin.preview_data?.accent as string) ?? '#f0c040';
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: swatch, borderColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {skin.name}
        </Text>
        <Text style={styles.sub}>
          {TARGET_LABEL[skin.target_type] ?? skin.target_type} · {skin.rarity === 'rare' ? 'Selten' : 'Gewöhnlich'}
        </Text>
      </View>
      {skin.owned ? (
        <Pressable style={[styles.actionBtn, skin.applied && styles.actionActive]} onPress={onApply}>
          <Text style={[styles.actionText, skin.applied && styles.actionTextActive]}>
            {skin.applied ? '✓ Aktiv' : 'Anwenden'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.buyBtn, !canAfford && styles.btnDisabled]}
          disabled={!canAfford}
          onPress={onBuy}
        >
          <Text style={styles.buyText}>{skin.price_bars} 🪙</Text>
        </Pressable>
      )}
    </View>
  );
}

function BarRow({
  pkg,
  loading,
  onBuy,
}: {
  pkg: IapPackage;
  loading: boolean;
  onBuy: () => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.barIcon}>🪙</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {pkg.display_name} · {pkg.bars} Goldbarren
        </Text>
        <Text style={styles.sub}>{pkg.price_eur.toFixed(2)} €</Text>
      </View>
      <Pressable style={[styles.buyBtn, loading && styles.btnDisabled]} disabled={loading} onPress={onBuy}>
        <Text style={styles.buyText}>Kaufen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
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
  bars: { color: '#f0c040', fontSize: 14, fontWeight: '800' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262d',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  tabActive: { backgroundColor: '#2b2410', borderColor: '#f0c040' },
  tabText: { color: '#c9d1d9', fontWeight: '700' },
  tabTextActive: { color: '#f0c040' },
  error: { color: '#ffd7d7', backgroundColor: '#5a1d1d', padding: 8, fontSize: 12 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 8 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
  note: { color: '#6e7681', fontSize: 11, marginTop: 10, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    gap: 10,
  },
  swatch: { width: 34, height: 34, borderRadius: 8, borderWidth: 2 },
  barIcon: { fontSize: 26, width: 34, textAlign: 'center' },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#8b949e', fontSize: 11, marginTop: 1 },
  buyBtn: {
    backgroundColor: '#1f6f43',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2ea043',
  },
  buyText: { color: '#d7ffe2', fontWeight: '800', fontSize: 13 },
  actionBtn: {
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  actionActive: { backgroundColor: '#2b2410', borderColor: '#f0c040' },
  actionText: { color: '#c9d1d9', fontWeight: '700', fontSize: 13 },
  actionTextActive: { color: '#f0c040' },
  btnDisabled: { opacity: 0.4 },
});
