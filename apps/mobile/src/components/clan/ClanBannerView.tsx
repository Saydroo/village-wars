import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClanBanner } from '@village-wars/shared';

/** Symbol-ID → Emoji (Baukasten aus clan.banner_options.symbols). */
export const SYMBOL_EMOJI: Record<string, string> = {
  sword: '⚔️',
  axe: '🪓',
  skull: '💀',
  tree: '🌲',
  anchor: '⚓',
  hammer: '🔨',
  crown: '👑',
  wolf: '🐺',
  dragon: '🐉',
  star: '⭐',
};

function shapeRadius(shape: string, size: number): number {
  switch (shape) {
    case 'rounded':
      return size / 2;
    case 'shield':
      return Math.round(size * 0.28);
    case 'pennant':
      return 3;
    default: // banner
      return 4;
  }
}

/** Rendert das Clan-Banner (Form + Farben + Symbol) als kompakte Vorschau. */
export function ClanBannerView({
  banner,
  size = 40,
}: {
  banner: ClanBanner;
  size?: number;
}): React.ReactElement {
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          backgroundColor: banner.primary_color,
          borderColor: banner.secondary_color,
          borderRadius: shapeRadius(banner.shape, size),
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{SYMBOL_EMOJI[banner.symbol] ?? '⚔️'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
});
