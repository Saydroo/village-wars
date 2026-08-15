import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ClanBanner, GameConfig } from '@village-wars/shared';
import { ClanBannerView, SYMBOL_EMOJI } from './ClanBannerView';

/**
 * Banner-Baukasten (Phase 4, Abschnitt 10): Form + Farben + Symbol — alle
 * Optionen kommen aus config.clan.banner_options. Kein Bild-Upload.
 */
export function BannerEditor({
  config,
  banner,
  onChange,
}: {
  config: GameConfig;
  banner: ClanBanner;
  onChange: (b: ClanBanner) => void;
}): React.ReactElement {
  const opt = config.clan.banner_options;

  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <ClanBannerView banner={banner} size={64} />
        <Text style={styles.previewHint}>Vorschau</Text>
      </View>

      <Text style={styles.label}>Form</Text>
      <View style={styles.rowWrap}>
        {opt.shapes.map((s) => (
          <Chip key={s} active={banner.shape === s} onPress={() => onChange({ ...banner, shape: s })}>
            {s}
          </Chip>
        ))}
      </View>

      <Text style={styles.label}>Symbol</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolRow}>
        {opt.symbols.map((s) => (
          <Pressable
            key={s}
            onPress={() => onChange({ ...banner, symbol: s })}
            style={[styles.symbol, banner.symbol === s && styles.symbolActive]}
          >
            <Text style={{ fontSize: 22 }}>{SYMBOL_EMOJI[s] ?? '⚔️'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Hauptfarbe</Text>
      <ColorRow
        colors={opt.colors}
        selected={banner.primary_color}
        onSelect={(c) => onChange({ ...banner, primary_color: c })}
      />
      <Text style={styles.label}>Rand</Text>
      <ColorRow
        colors={opt.colors}
        selected={banner.secondary_color}
        onSelect={(c) => onChange({ ...banner, secondary_color: c })}
      />
    </View>
  );
}

function Chip({
  children,
  active,
  onPress,
}: {
  children: React.ReactNode;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </Pressable>
  );
}

function ColorRow({
  colors,
  selected,
  onSelect,
}: {
  colors: string[];
  selected: string;
  onSelect: (c: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.rowWrap}>
      {colors.map((c) => (
        <Pressable
          key={c}
          onPress={() => onSelect(c)}
          style={[styles.swatch, { backgroundColor: c }, selected === c && styles.swatchActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  previewHint: { color: '#8b949e', fontSize: 12 },
  label: { color: '#c9d1d9', fontSize: 12, fontWeight: '700', marginTop: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  symbolRow: { gap: 6, paddingVertical: 2 },
  symbol: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  symbolActive: { borderColor: '#f0c040', backgroundColor: '#2b2410' },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  chipActive: { borderColor: '#f0c040', backgroundColor: '#2b2410' },
  chipText: { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#f0c040' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff' },
});
