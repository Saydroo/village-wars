import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../store';

/**
 * Einstellungs-Panel (Phase 6). „Effekte reduzieren" deaktiviert Screenshake,
 * halbiert Partikel und entfernt die Idle-Atmung (Performance-Leitplanke der
 * Game-Juice-Spec, Abschnitt 9). Sound-Cues sind getrennt abschaltbar.
 */
interface Props {
  onClose: () => void;
}

export function SettingsSheet({ onClose }: Props): React.ReactElement {
  const { reduceEffects, soundEnabled, setReduceEffects, setSoundEnabled } = useAppStore();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Einstellungen</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Effekte reduzieren</Text>
          <Text style={styles.hint}>Kein Bildschirmzittern, weniger Partikel, keine Idle-Atmung.</Text>
        </View>
        <Switch
          value={reduceEffects}
          onValueChange={setReduceEffects}
          trackColor={{ true: '#f0c040', false: '#30363d' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Sound-Cues</Text>
          <Text style={styles.hint}>Kurze Klänge bei Treffern, Upgrades, Sieg.</Text>
        </View>
        <Switch
          value={soundEnabled}
          onValueChange={setSoundEnabled}
          trackColor={{ true: '#f0c040', false: '#30363d' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#30363d', padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  close: { color: '#8b949e', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1 },
  label: { color: '#c9d1d9', fontSize: 14, fontWeight: '700' },
  hint: { color: '#8b949e', fontSize: 11, marginTop: 2 },
});
