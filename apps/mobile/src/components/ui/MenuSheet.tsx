import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playCue } from '../../rendering/effects';

/**
 * Aufgeräumtes Menü-Raster (Phase-6-Politur): fasst die früher in der Kopfzeile
 * gequetschten Icon-Buttons (Clan, Rangliste, Dungeon, Shop, Inventar,
 * Einstellungen) in einem übersichtlichen Bottom-Sheet zusammen. Die Kopfzeile
 * zeigt nur noch die wichtigsten Aktionen.
 */
export interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
}

interface Props {
  items: MenuItem[];
  onClose: () => void;
}

export function MenuSheet({ items, onClose }: Props): React.ReactElement {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Menü</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {items.map((it) => (
            <Pressable
              key={it.label}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => {
                playCue('button');
                it.onPress();
                onClose();
              }}
            >
              <View style={styles.tileInner}>
                <Text style={styles.tileIcon}>{it.icon}</Text>
                {it.badge !== undefined ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{it.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: '#0009', zIndex: 20 },
  sheet: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#30363d',
    padding: 16,
    paddingBottom: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  close: { color: '#8b949e', fontSize: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  tile: {
    width: '31%',
    backgroundColor: '#21262d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  tilePressed: { backgroundColor: '#2b313a', borderColor: '#f0c040' },
  tileInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 24 },
  tileLabel: { color: '#c9d1d9', fontSize: 12, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#d9433f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
