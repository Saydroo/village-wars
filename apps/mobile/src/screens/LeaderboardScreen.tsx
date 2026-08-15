import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  LeaderboardClanEntry,
  LeaderboardSoloEntry,
} from '@village-wars/shared';
import { useAppStore } from '../store';
import { ClanBannerView } from '../components/clan/ClanBannerView';

type Tab = 'solo' | 'clan';

/** Rangliste (Phase 4): Solo (Trophäen) / Clan (Saison-Punkte), paginiert. */
export function LeaderboardScreen(): React.ReactElement {
  const {
    config,
    player,
    soloLeaderboard,
    clanLeaderboard,
    clanLoading,
    clanError,
    loadSoloLeaderboard,
    loadClanLeaderboard,
    setScreen,
  } = useAppStore();
  const [tab, setTab] = useState<Tab>('solo');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (tab === 'solo') void loadSoloLeaderboard(page);
    else void loadClanLeaderboard(page);
  }, [tab, page, loadSoloLeaderboard, loadClanLeaderboard]);

  const data = tab === 'solo' ? soloLeaderboard : clanLeaderboard;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={styles.title}>🏆 Rangliste</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.tabs}>
        {(['solo', 'clan'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              setPage(1);
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'solo' ? 'Solo' : 'Clans'}
            </Text>
          </Pressable>
        ))}
      </View>

      {clanError ? <Text style={styles.error}>{clanError}</Text> : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {clanLoading && !data ? (
          <ActivityIndicator color="#f0c040" style={{ marginTop: 24 }} />
        ) : tab === 'solo' ? (
          (soloLeaderboard?.entries ?? []).map((e) => (
            <SoloRow
              key={e.player_id}
              entry={e}
              isMe={e.player_id === player?.id}
              faction={config?.factions[e.faction]?.display_name ?? e.faction}
            />
          ))
        ) : (
          (clanLeaderboard?.entries ?? []).map((e) => (
            <ClanRow key={e.clan_id} entry={e} isMine={e.clan_id === player?.clan_id} />
          ))
        )}
        {data && data.entries.length === 0 ? (
          <Text style={styles.empty}>Noch keine Einträge.</Text>
        ) : null}
      </ScrollView>

      {/* Eigene Position, falls außerhalb der Seite */}
      {tab === 'solo' && soloLeaderboard?.me ? (
        <View style={styles.meBar}>
          <Text style={styles.meText}>
            Dein Rang: #{soloLeaderboard.me.rank} · {soloLeaderboard.me.trophies} 🏆
          </Text>
        </View>
      ) : null}
      {tab === 'clan' && clanLeaderboard?.me ? (
        <View style={styles.meBar}>
          <Text style={styles.meText}>
            Dein Clan: #{clanLeaderboard.me.rank} · {clanLeaderboard.me.season_points} Pkt
          </Text>
        </View>
      ) : null}

      <View style={styles.pager}>
        <Pressable
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
        >
          <Text style={styles.pageBtnText}>‹ Zurück</Text>
        </Pressable>
        <Text style={styles.pageInfo}>
          Seite {data?.page ?? page} / {totalPages}
        </Text>
        <Pressable
          disabled={page >= totalPages}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
        >
          <Text style={styles.pageBtnText}>Weiter ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function rankColor(rank: number): string {
  if (rank === 1) return '#f0c040';
  if (rank === 2) return '#c0c6cc';
  if (rank === 3) return '#cd7f32';
  return '#8b949e';
}

function SoloRow({
  entry,
  isMe,
  faction,
}: {
  entry: LeaderboardSoloEntry;
  isMe: boolean;
  faction: string;
}): React.ReactElement {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, { color: rankColor(entry.rank) }]}>#{entry.rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.username}
          {isMe ? ' (du)' : ''}
        </Text>
        <Text style={styles.sub}>{faction}</Text>
      </View>
      <Text style={styles.value}>{entry.trophies} 🏆</Text>
    </View>
  );
}

function ClanRow({
  entry,
  isMine,
}: {
  entry: LeaderboardClanEntry;
  isMine: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.row, isMine && styles.rowMe]}>
      <Text style={[styles.rank, { color: rankColor(entry.rank) }]}>#{entry.rank}</Text>
      <ClanBannerView banner={entry.banner} size={28} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {isMine ? ' (dein Clan)' : ''}
        </Text>
        <Text style={styles.sub}>
          [{entry.tag}] · {entry.member_count} Mitglieder
        </Text>
      </View>
      <Text style={styles.value}>{entry.season_points} Pkt</Text>
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
  list: { flex: 1 },
  listContent: { padding: 12, gap: 6 },
  empty: { color: '#8b949e', textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  rowMe: { borderColor: '#f0c040', backgroundColor: '#1a1c12' },
  rank: { width: 44, fontSize: 14, fontWeight: '800' },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#8b949e', fontSize: 11, marginTop: 1 },
  value: { color: '#f0c040', fontSize: 14, fontWeight: '800' },
  meBar: { backgroundColor: '#1d3a5a', paddingVertical: 8, paddingHorizontal: 12 },
  meText: { color: '#9ecbff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#30363d',
  },
  pageBtn: {
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#c9d1d9', fontWeight: '700' },
  pageInfo: { color: '#8b949e', fontSize: 12 },
});
