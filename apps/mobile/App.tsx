import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from './src/store';
import { AuthScreen } from './src/screens/AuthScreen';
import { VillageScreen } from './src/screens/VillageScreen';
import { BattleScreen } from './src/screens/BattleScreen';
import { ClanScreen } from './src/screens/ClanScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { DungeonScreen } from './src/screens/DungeonScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { AchievementsScreen } from './src/screens/AchievementsScreen';
import { ResearchScreen } from './src/screens/ResearchScreen';
import { QuestScreen } from './src/screens/QuestScreen';
import { HeroScreen } from './src/screens/HeroScreen';
import { SeasonPassScreen } from './src/screens/SeasonPassScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { EventScreen } from './src/screens/EventScreen';
import { ScreenFade } from './src/components/ui/ScreenFade';
import { DailyRewardSheet } from './src/components/ui/DailyRewardSheet';

/**
 * App-Shell (Phase 2–4): lädt zuerst die game-config (GET /api/config), zeigt
 * dann Login/Registrierung, danach den VillageScreen mit isometrischem Dorf,
 * – sobald ein Kampf/Matchmaking läuft – den BattleScreen, und über die Kopfzeile
 * den Clan- bzw. Rangliste-Screen (Phase 4).
 */
export default function App() {
  const { config, configLoading, configError, token, authBootstrapping, battlePhase, activeScreen, reduceEffects, initConfig, tryAutoLogin } =
    useAppStore();

  useEffect(() => {
    void (async () => {
      await initConfig();
      // Gespeicherten Token laden und ohne Eingabe einloggen (überspringt Anmelden-Screen).
      await tryAutoLogin();
    })();
  }, [initConfig, tryAutoLogin]);

  // Welcher Screen ist aktiv? (steuert den Fade-Übergang)
  const screenKey = !config || authBootstrapping
    ? 'loading'
    : !token
      ? 'auth'
      : battlePhase !== 'idle'
        ? 'battle'
        : activeScreen;

  const screen = !config ? (
    <View style={styles.center}>
      {configError ? (
        <>
          <Text style={styles.error}>Verbindung fehlgeschlagen</Text>
          <Text style={styles.muted}>{configError}</Text>
          <Text style={styles.muted}>Läuft das Backend? EXPO_PUBLIC_API_URL prüfen.</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#f0c040" />
          <Text style={styles.muted}>{configLoading ? 'Lade Konfiguration …' : 'Starte …'}</Text>
        </>
      )}
    </View>
  ) : authBootstrapping ? (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#f0c040" />
      <Text style={styles.muted}>Anmeldung wird geprüft …</Text>
    </View>
  ) : !token ? (
    <AuthScreen />
  ) : battlePhase !== 'idle' ? (
    <BattleScreen />
  ) : activeScreen === 'clan' ? (
    <ClanScreen />
  ) : activeScreen === 'leaderboard' ? (
    <LeaderboardScreen />
  ) : activeScreen === 'dungeon' ? (
    <DungeonScreen />
  ) : activeScreen === 'shop' ? (
    <ShopScreen />
  ) : activeScreen === 'achievements' ? (
    <AchievementsScreen />
  ) : activeScreen === 'research' ? (
    <ResearchScreen />
  ) : activeScreen === 'quests' ? (
    <QuestScreen />
  ) : activeScreen === 'hero' ? (
    <HeroScreen />
  ) : activeScreen === 'season_pass' ? (
    <SeasonPassScreen />
  ) : activeScreen === 'onboarding' ? (
    <OnboardingScreen />
  ) : activeScreen === 'event' ? (
    <EventScreen />
  ) : (
    <VillageScreen />
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScreenFade
          screenKey={screenKey}
          durationMs={config?.effects?.screen_transition_ms ?? 240}
          reduceEffects={reduceEffects}
        >
          {screen}
        </ScreenFade>
        {token ? <DailyRewardSheet /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: '#8b949e', textAlign: 'center' },
  error: { color: '#ff6b6b', fontSize: 18, fontWeight: '700' },
});
