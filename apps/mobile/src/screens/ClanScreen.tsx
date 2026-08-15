import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ClanChatMessage } from '@village-wars/shared';
import type {
  ClanBanner,
  ClanDetailResponse,
  ClanSummary,
  CastleResponse,
  ClanWarResponse,
  FactionId,
  GameConfig,
  Player,
} from '@village-wars/shared';
import { useAppStore } from '../store';
import { bindClanChatHandler } from '../api/socket';
import { ClanBannerView } from '../components/clan/ClanBannerView';
import { BannerEditor } from '../components/clan/BannerEditor';

function unitName(config: GameConfig, type: string, faction: FactionId): string {
  const c = config.units_common[type];
  if (c && typeof c === 'object' && c.display_name) return c.display_name;
  const ex = config.factions_exclusive_content[faction]?.exclusive_units.find((u) => u.id === type);
  return ex?.display_name ?? type;
}

type Tab = 'members' | 'castle' | 'war' | 'chat';

/** Clan-Screen (Phase 4): erstellen/beitreten, Mitglieder, Clan-Burg, Krieg. */
export function ClanScreen(): React.ReactElement {
  const {
    config,
    player,
    clanDetail,
    clanList,
    castle,
    war,
    clanLoading,
    clanError,
    loadClanHome,
    setScreen,
    leaveClanAction,
  } = useAppStore();
  const [tab, setTab] = useState<Tab>('members');

  useEffect(() => {
    void loadClanHome();
  }, [loadClanHome]);

  if (!config || !player) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  const unlock = config.clan.unlock_town_hall_level;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('village')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Dorf</Text>
        </Pressable>
        <Text style={styles.title}>🏰 Clan</Text>
        <View style={{ width: 56 }} />
      </View>

      {clanError ? (
        <Pressable onPress={() => useAppStore.setState({ clanError: null })} style={styles.errorBar}>
          <Text style={styles.errorText}>{clanError} (tippen zum Schließen)</Text>
        </Pressable>
      ) : null}

      {clanLoading && !clanDetail && clanList.length === 0 ? (
        <ActivityIndicator color="#f0c040" style={{ marginTop: 24 }} />
      ) : clanDetail ? (
        <MyClan
          config={config}
          player={player}
          detail={clanDetail}
          castle={castle}
          war={war}
          tab={tab}
          onTab={setTab}
          onLeave={() => void leaveClanAction()}
        />
      ) : player.village_level < unlock ? (
        <View style={styles.center}>
          <Text style={styles.lockText}>🔒 Clans ab Rathaus-Level {unlock}</Text>
          <Text style={styles.muted}>Aktuell: Rathaus {player.village_level}</Text>
        </View>
      ) : (
        <NoClan config={config} clans={clanList} />
      )}
    </View>
  );
}

// --- Spieler ohne Clan: Erstellen + Liste/Suche ---
function NoClan({ config, clans }: { config: GameConfig; clans: ClanSummary[] }): React.ReactElement {
  const { searchClans, joinClanAction, createClanAction, clanLoading } = useAppStore();
  const opt = config.clan.banner_options;
  const [mode, setMode] = useState<'browse' | 'create'>('browse');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [banner, setBanner] = useState<ClanBanner>({
    shape: opt.shapes[0] ?? 'shield',
    primary_color: opt.colors[0] ?? '#c0392b',
    secondary_color: opt.colors[4] ?? '#f0c040',
    symbol: opt.symbols[0] ?? 'sword',
    symbol_color: opt.colors[8] ?? '#ecf0f1',
  });

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <View style={styles.tabs}>
        <Pressable onPress={() => setMode('browse')} style={[styles.tab, mode === 'browse' && styles.tabActive]}>
          <Text style={[styles.tabText, mode === 'browse' && styles.tabTextActive]}>Beitreten</Text>
        </Pressable>
        <Pressable onPress={() => setMode('create')} style={[styles.tab, mode === 'create' && styles.tabActive]}>
          <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Erstellen</Text>
        </Pressable>
      </View>

      {mode === 'browse' ? (
        <>
          <View style={styles.searchRow}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Clan suchen (Name/Tag)…"
              placeholderTextColor="#6e7681"
              style={styles.input}
              autoCapitalize="none"
            />
            <Pressable onPress={() => void searchClans(search)} style={styles.searchBtn}>
              <Text style={styles.searchBtnText}>Suchen</Text>
            </Pressable>
          </View>
          {clans.length === 0 ? (
            <Text style={styles.muted}>Keine Clans gefunden. Erstelle den ersten!</Text>
          ) : (
            clans.map((c) => (
              <View key={c.id} style={styles.clanCard}>
                <ClanBannerView banner={c.banner} size={40} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.clanName}>{c.name}</Text>
                  <Text style={styles.sub}>
                    [{c.tag}] · {c.member_count}/{config.clan.max_members} · {c.season_points} Pkt
                  </Text>
                </View>
                <Pressable onPress={() => void joinClanAction(c.id)} style={styles.joinBtn}>
                  <Text style={styles.joinText}>Beitreten</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Clan-Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="z. B. Drachenwacht"
            placeholderTextColor="#6e7681"
            style={styles.input}
            maxLength={config.clan.name_length_max}
          />
          <Text style={styles.label}>Tag ({config.clan.tag_length_min}–{config.clan.tag_length_max} Zeichen)</Text>
          <TextInput
            value={tag}
            onChangeText={(t) => setTag(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="DRGN"
            placeholderTextColor="#6e7681"
            style={styles.input}
            autoCapitalize="characters"
            maxLength={config.clan.tag_length_max}
          />
          <Text style={[styles.label, { marginTop: 10 }]}>Banner</Text>
          <BannerEditor config={config} banner={banner} onChange={setBanner} />
          <Pressable
            disabled={clanLoading || name.trim().length < config.clan.name_length_min || tag.length < config.clan.tag_length_min}
            onPress={async () => {
              const ok = await createClanAction({ name: name.trim(), tag, banner });
              if (!ok) return;
            }}
            style={[
              styles.createBtn,
              (clanLoading || name.trim().length < config.clan.name_length_min || tag.length < config.clan.tag_length_min) &&
                styles.btnDisabled,
            ]}
          >
            <Text style={styles.createBtnText}>Clan gründen</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// --- Spieler im Clan ---
function MyClan({
  config,
  player,
  detail,
  castle,
  war,
  tab,
  onTab,
  onLeave,
}: {
  config: GameConfig;
  player: Player;
  detail: ClanDetailResponse;
  castle: CastleResponse | null;
  war: ClanWarResponse | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onLeave: () => void;
}): React.ReactElement {
  const { changeMemberRole, startFriendlyBattle } = useAppStore();
  const { clan, members } = detail;
  const myRole = members.find((m) => m.player_id === player.id)?.role ?? 'member';
  const canManage = myRole === 'leader' || myRole === 'co_leader';

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.clanHeader}>
        <ClanBannerView banner={clan.banner} size={52} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.clanName}>
            {clan.name} <Text style={styles.sub}>[{clan.tag}]</Text>
          </Text>
          <Text style={styles.sub}>
            {clan.member_count}/{config.clan.max_members} Mitglieder · {clan.season_points} Pkt · {clan.total_wins} Siege
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['members', 'castle', 'war', 'chat'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => onTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'members' ? 'Mitglieder' : t === 'castle' ? 'Burg' : t === 'war' ? 'Krieg' : 'Chat'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'chat' ? (
        <ChatTab player={player} />
      ) : (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {tab === 'members' ? (
          members.map((m) => {
            const isSelf = m.player_id === player.id;
            // ⬆ Mitglied→Co-Leader (Leader/Co-Leader) bzw. Co-Leader→Leader (nur Leader, Übergabe).
            const showPromote =
              canManage && !isSelf && (m.role === 'member' || (m.role === 'co_leader' && myRole === 'leader'));
            // ⬇ Co-Leader→Mitglied (nur Leader).
            const showDemote = !isSelf && myRole === 'leader' && m.role === 'co_leader';
            return (
              <View key={m.player_id} style={styles.memberRow}>
                <Text style={styles.roleBadge}>
                  {m.role === 'leader' ? '👑' : m.role === 'co_leader' ? '⭐' : '•'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clanName} numberOfLines={1}>
                    {m.username}
                    {isSelf ? ' (du)' : ''}
                  </Text>
                  <Text style={styles.sub}>
                    {config.factions[m.faction]?.display_name ?? m.faction} · RH {m.village_level}
                  </Text>
                </View>
                {showPromote ? (
                  <Pressable onPress={() => void changeMemberRole(m.player_id, 'promote')} style={styles.roleBtn}>
                    <Text style={styles.roleBtnText}>⬆</Text>
                  </Pressable>
                ) : null}
                {showDemote ? (
                  <Pressable onPress={() => void changeMemberRole(m.player_id, 'demote')} style={styles.roleBtn}>
                    <Text style={styles.roleBtnText}>⬇</Text>
                  </Pressable>
                ) : null}
                {!isSelf ? (
                  <Pressable onPress={() => startFriendlyBattle(m.player_id)} style={styles.friendlyBtn}>
                    <Text style={styles.friendlyBtnText}>⚔️ Üben</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.value}>{m.trophies} 🏆</Text>
              </View>
            );
          })
        ) : tab === 'castle' ? (
          <CastleTab config={config} player={player} castle={castle} />
        ) : (
          <WarTab war={war} clanId={player.clan_id} canStart={myRole === 'leader' || myRole === 'co_leader'} />
        )}
      </ScrollView>
      )}

      <Pressable onPress={onLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveText}>Clan verlassen</Text>
      </Pressable>
    </View>
  );
}

function CastleTab({
  config,
  player,
  castle,
}: {
  config: GameConfig;
  player: Player;
  castle: CastleResponse | null;
}): React.ReactElement {
  const { army, donateAction } = useAppStore();
  const donationRequests = useAppStore((s) => s.donationRequests);
  const myDonationRequest = useAppStore((s) => s.myDonationRequest);
  const loadDonations = useAppStore((s) => s.loadDonations);
  const createDonation = useAppStore((s) => s.createDonationAction);
  const cancelDonation = useAppStore((s) => s.cancelDonationAction);
  const donateToRequest = useAppStore((s) => s.donateToRequestAction);
  const trainable = useMemo(() => (army?.units ?? []).filter((u) => u.quantity > 0), [army]);

  useEffect(() => {
    void loadDonations();
  }, []);

  if (!castle) return <ActivityIndicator color="#f0c040" style={{ marginTop: 16 }} />;
  if (castle.castle_level <= 0) {
    return <Text style={styles.muted}>Baue zuerst eine Clan-Burg (Rathaus 5) und schließe den Bau ab.</Text>;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.housing}>
        Stellplätze: {castle.housing_used} / {castle.housing_capacity} (Burg Lvl {castle.castle_level})
      </Text>
      <View style={styles.barOuter}>
        <View
          style={[
            styles.barInner,
            { width: `${Math.min(100, (castle.housing_used / Math.max(1, castle.housing_capacity)) * 100)}%` },
          ]}
        />
      </View>

      <Text style={styles.label}>Stationiert</Text>
      {castle.defenders.length === 0 ? (
        <Text style={styles.muted}>Noch keine Einheiten stationiert.</Text>
      ) : (
        castle.defenders.map((d) => (
          <View key={d.id} style={styles.defRow}>
            <Text style={styles.clanName}>{unitName(config, d.unit_type, player.faction)}</Text>
            <Text style={styles.value}>×{d.quantity}</Text>
          </View>
        ))
      )}

      <Text style={[styles.label, { marginTop: 8 }]}>Aus Armee stationieren (+1)</Text>
      {trainable.length === 0 ? (
        <Text style={styles.muted}>Keine Einheiten in der Armee. Rekrutiere im Dorf (🛡 Armee).</Text>
      ) : (
        <View style={styles.rowWrap}>
          {trainable.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => void donateAction(u.unit_type, 1)}
              style={styles.donateChip}
            >
              <Text style={styles.donateChipText}>
                {unitName(config, u.unit_type, player.faction)} (×{u.quantity})
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* --- Spenden-Anfragen (Roadmap P9) --- */}
      <View style={styles.donationSection}>
        <Text style={[styles.label, { marginTop: 4 }]}>🆘 Truppen-Anfragen</Text>

        {myDonationRequest ? (
          <View style={styles.reqCardMine}>
            <Text style={styles.clanName}>Deine Anfrage</Text>
            <Text style={styles.muted}>
              {myDonationRequest.received} / {myDonationRequest.capacity} Stellplätze gefüllt
              {myDonationRequest.requested_unit_type
                ? ` · Wunsch: ${unitName(config, myDonationRequest.requested_unit_type, player.faction)}`
                : ''}
            </Text>
            <Pressable onPress={() => void cancelDonation()} style={styles.reqCancelBtn}>
              <Text style={styles.reqCancelText}>Anfrage schließen</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void createDonation()} style={styles.reqAskBtn}>
            <Text style={styles.reqAskText}>Truppen anfordern</Text>
          </Pressable>
        )}

        {donationRequests.filter((r) => r.player_id !== player.id).length === 0 ? (
          <Text style={styles.muted}>Keine offenen Anfragen anderer Mitglieder.</Text>
        ) : (
          donationRequests
            .filter((r) => r.player_id !== player.id)
            .map((r) => (
              <View key={r.id} style={styles.reqCard}>
                <Text style={styles.clanName}>{r.username} bittet um Truppen</Text>
                <Text style={styles.muted}>
                  {r.received} / {r.capacity} gefüllt
                  {r.requested_unit_type
                    ? ` · Wunsch: ${unitName(config, r.requested_unit_type, player.faction)}`
                    : ''}
                </Text>
                {trainable.length === 0 ? (
                  <Text style={styles.muted}>Keine Truppen zum Spenden.</Text>
                ) : (
                  <View style={styles.rowWrap}>
                    {trainable.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() => void donateToRequest(r.id, u.unit_type, 1)}
                        style={styles.donateChip}
                      >
                        <Text style={styles.donateChipText}>
                          ➜ {unitName(config, u.unit_type, player.faction)} (×{u.quantity})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))
        )}
      </View>
    </View>
  );
}

function WarTab({
  war,
  clanId,
  canStart,
}: {
  war: ClanWarResponse | null;
  clanId: string | null;
  canStart: boolean;
}): React.ReactElement {
  const { startWarAction, startClanWarBattle } = useAppStore();
  const current = war?.war ?? null;

  if (current) {
    const myIsA = current.clan_a_id === clanId;
    const myPts = myIsA ? current.clan_a_points : current.clan_b_points;
    const foePts = myIsA ? current.clan_b_points : current.clan_a_points;
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.warTitle}>⚔️ Krieg läuft</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Dein Clan</Text>
            <Text style={styles.scoreValue}>{myPts}</Text>
          </View>
          <Text style={styles.scoreVs}>:</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Gegner</Text>
            <Text style={styles.scoreValue}>{foePts}</Text>
          </View>
        </View>
        <Text style={styles.muted}>
          Kriegspunkte = Summe der erzielten Zerstörung. Greife ein feindliches Mitglied an!
        </Text>
        <Pressable onPress={() => startClanWarBattle()} style={styles.warBtn}>
          <Text style={styles.warBtnText}>⚔️ Krieg-Angriff starten</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.muted}>Kein laufender Krieg.</Text>
      {canStart ? (
        <Pressable onPress={() => void startWarAction()} style={styles.warBtn}>
          <Text style={styles.warBtnText}>🔍 Kriegsgegner suchen</Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>Nur Leader/Co-Leader können einen Krieg starten.</Text>
      )}
    </View>
  );
}

/**
 * Clan-Chat (Roadmap P9). Invertierte Liste (neueste unten), Live-Updates über den
 * Socket (`clanchat:message`), Eingabe + Senden. Eigene Nachrichten rechts/gold.
 */
function ChatTab({ player }: { player: Player }): React.ReactElement {
  const chat = useAppStore((s) => s.clanChat);
  const hasMore = useAppStore((s) => s.clanChatHasMore);
  const loading = useAppStore((s) => s.clanChatLoading);
  const loadChat = useAppStore((s) => s.loadClanChat);
  const loadMore = useAppStore((s) => s.loadMoreClanChat);
  const send = useAppStore((s) => s.sendClanMessageAction);
  const append = useAppStore((s) => s.appendClanChatMessage);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    void loadChat();
    // Live-Listener registrieren (Socket pusht clanchat:message an Clan-Mitglieder).
    const unbind = bindClanChatHandler((m) => append(m));
    return unbind;
  }, []);

  const onSend = (): void => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void send(text);
  };

  return (
    <View style={{ flex: 1 }}>
      {loading && chat.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f0c040" />
        </View>
      ) : chat.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Noch keine Nachrichten. Sag Hallo! 👋</Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={chat}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <Text style={styles.muted}>Lade ältere …</Text> : null}
          renderItem={({ item }: { item: ClanChatMessage }) => {
            const mine = item.player_id === player.id;
            return (
              <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                <View style={[styles.msgBubble, mine && styles.msgBubbleMine]}>
                  {!mine ? <Text style={styles.msgAuthor}>{item.username}</Text> : null}
                  <Text style={styles.msgBody}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Nachricht …"
          placeholderTextColor="#6e7681"
          maxLength={500}
          multiline
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <Pressable onPress={onSend} style={styles.chatSendBtn} disabled={!draft.trim()}>
          <Text style={styles.chatSendText}>Senden</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: '#8b949e', fontSize: 13 },
  lockText: { color: '#f0c040', fontSize: 16, fontWeight: '700' },
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
  errorBar: { backgroundColor: '#5a1d1d', paddingVertical: 8, paddingHorizontal: 12 },
  errorText: { color: '#ffd7d7', fontSize: 12 },
  body: { flex: 1 },
  bodyContent: { padding: 12, gap: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, paddingVertical: 6 },
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
  label: { color: '#c9d1d9', fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    flex: 1,
  },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn: { backgroundColor: '#21262d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#30363d' },
  searchBtnText: { color: '#c9d1d9', fontWeight: '700' },
  clanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  clanName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: '#8b949e', fontSize: 12 },
  value: { color: '#f0c040', fontSize: 14, fontWeight: '800' },
  joinBtn: { backgroundColor: '#1f6f3f', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  joinText: { color: '#d7ffe6', fontWeight: '800', fontSize: 12 },
  createBtn: {
    backgroundColor: '#1f6f3f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  createBtnText: { color: '#d7ffe6', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  clanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    gap: 8,
  },
  roleBadge: { fontSize: 16, width: 24, textAlign: 'center' },
  roleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  roleBtnText: { color: '#f0c040', fontSize: 16, fontWeight: '800' },
  housing: { color: '#fff', fontSize: 14, fontWeight: '700' },
  barOuter: { height: 10, backgroundColor: '#21262d', borderRadius: 5, overflow: 'hidden' },
  barInner: { height: 10, backgroundColor: '#f0c040' },
  defRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  donateChip: {
    backgroundColor: '#21262d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  donateChipText: { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
  leaveBtn: {
    margin: 12,
    backgroundColor: '#5a1d1d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b5443f',
  },
  leaveText: { color: '#ffd7d7', fontWeight: '800' },
  warTitle: { color: '#f0c040', fontSize: 16, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  scoreBox: { alignItems: 'center', backgroundColor: '#161b22', borderRadius: 10, padding: 14, minWidth: 100, borderWidth: 1, borderColor: '#30363d' },
  scoreLabel: { color: '#8b949e', fontSize: 12 },
  scoreValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  scoreVs: { color: '#8b949e', fontSize: 24, fontWeight: '900' },
  warBtn: { backgroundColor: '#7a2b2b', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#b5443f' },
  warBtnText: { color: '#ffd7d7', fontWeight: '800', fontSize: 15 },
  // --- Clan-Chat (Roadmap P9) ---
  msgRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgBubble: {
    maxWidth: '80%',
    backgroundColor: '#161b22',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  msgBubbleMine: { backgroundColor: '#2a2410', borderColor: '#6e5a1e' },
  msgAuthor: { color: '#7ec8e3', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgBody: { color: '#e6edf3', fontSize: 14 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#30363d',
    backgroundColor: '#0d1117',
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#161b22',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#e6edf3',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  chatSendBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chatSendText: { color: '#1a1a2e', fontWeight: '800' },
  // --- Spenden-Anfragen (Roadmap P9) ---
  donationSection: { marginTop: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#30363d', paddingTop: 12 },
  reqAskBtn: { backgroundColor: '#1e3a5f', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#2f6fbf' },
  reqAskText: { color: '#bcd9ff', fontWeight: '800', fontSize: 14 },
  reqCardMine: { backgroundColor: '#11233a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2f6fbf', gap: 6 },
  reqCard: { backgroundColor: '#161b22', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#30363d', gap: 6 },
  reqCancelBtn: { alignSelf: 'flex-start', backgroundColor: '#5a1d1d', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#b5443f' },
  reqCancelText: { color: '#ffd7d7', fontWeight: '700', fontSize: 12 },
  // --- Freundschaftskampf (Roadmap P9) ---
  friendlyBtn: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#2f6fbf', marginRight: 6 },
  friendlyBtnText: { color: '#bcd9ff', fontWeight: '700', fontSize: 12 },
});
