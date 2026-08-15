import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FactionId } from '@village-wars/shared';
import { useAppStore } from '../store';

/** Einfacher Dev-Login/-Registrierung für Phase 2 (vor dem richtigen Onboarding). */
export function AuthScreen(): React.ReactElement {
  const { config, authLogin, authRegister } = useAppStore();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [faction, setFaction] = useState<FactionId>('humans');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const factions = config ? (Object.keys(config.factions) as FactionId[]) : [];

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') await authRegister({ username, email, password, faction });
      else await authLogin(username || email, password);
    } catch (e) {
      const msg =
        typeof e === 'object' && e && 'response' in e
          ? ((e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message ?? 'Fehlgeschlagen')
          : e instanceof Error
            ? e.message
            : 'Fehlgeschlagen';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Village Wars</Text>
      <Text style={styles.subtitle}>{mode === 'register' ? 'Konto erstellen' : 'Anmelden'}</Text>

      <TextInput
        style={styles.input}
        placeholder={mode === 'register' ? 'Benutzername' : 'Benutzername oder E-Mail'}
        placeholderTextColor="#6e7681"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      {mode === 'register' ? (
        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          placeholderTextColor="#6e7681"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Passwort (min. 8 Zeichen)"
        placeholderTextColor="#6e7681"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {mode === 'register' ? (
        <View style={styles.factions}>
          {factions.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFaction(f)}
              style={[styles.faction, faction === f && styles.factionActive]}
            >
              <Text style={[styles.factionText, faction === f && styles.factionTextActive]}>
                {config?.factions[f].display_name ?? f}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.submit, busy && styles.busy]} disabled={busy} onPress={() => void submit()}>
        <Text style={styles.submitText}>
          {busy ? '…' : mode === 'register' ? 'Registrieren & Spielen' : 'Anmelden'}
        </Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'register' ? 'login' : 'register')}>
        <Text style={styles.switch}>
          {mode === 'register' ? 'Schon ein Konto? Anmelden' : 'Neu hier? Konto erstellen'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 60, gap: 12 },
  title: { color: '#f0c040', fontSize: 34, fontWeight: '800' },
  subtitle: { color: '#9e9e9e', fontSize: 16, marginBottom: 12 },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  factions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  faction: {
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  factionActive: { borderColor: '#f0c040', backgroundColor: '#2b2410' },
  factionText: { color: '#c9d1d9', fontSize: 13 },
  factionTextActive: { color: '#f0c040', fontWeight: '700' },
  error: { color: '#ff6b6b', fontSize: 13 },
  submit: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  busy: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switch: { color: '#58a6ff', textAlign: 'center', marginTop: 8, fontSize: 14 },
});
