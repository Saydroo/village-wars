import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api,
  registerPlayer,
  setTownHallLevel,
  sql,
  getGameConfig,
  uniqueSuffix,
  type TestPlayer,
} from '../harness';

let tagCounter = 0;
function makeTag(): string {
  tagCounter += 1;
  return ('C' + tagCounter.toString(36).toUpperCase()).slice(0, 5).padEnd(3, 'X');
}

function validBanner() {
  const o = getGameConfig().clan.banner_options;
  return {
    shape: o.shapes[0],
    symbol: o.symbols[0],
    primary_color: o.colors[0],
    secondary_color: o.colors[1],
    symbol_color: o.colors[2],
  };
}

/** Spieler mit TH5 (Clan-Voraussetzung). */
async function leaderReady(): Promise<TestPlayer> {
  const p = await registerPlayer();
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  return p;
}

async function createClan(token: string): Promise<{ status: number; body: any }> {
  return api('POST', '/api/clan/create', {
    token,
    body: { name: `Clan ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
}

test('Clan erstellen unter Mindest-Rathaus-Level → 400', async () => {
  const p = await registerPlayer(); // village_level 1
  const res = await createClan(p.token);
  assert.equal(res.status, 400);
});

test('Clan erstellen ab TH5 → 201, Ersteller wird Leader', async () => {
  const p = await leaderReady();
  const res = await createClan(p.token);
  assert.equal(res.status, 201);
  assert.ok(res.body.clan.id);
  assert.equal(res.body.player.clan_id, res.body.clan.id);
});

test('Clan-Tag ist eindeutig → doppelter Tag = 409', async () => {
  const a = await leaderReady();
  const tag = makeTag();
  const banner = validBanner();
  const first = await api('POST', '/api/clan/create', {
    token: a.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag, banner },
  });
  assert.equal(first.status, 201);

  const b = await leaderReady();
  const dup = await api('POST', '/api/clan/create', {
    token: b.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag, banner },
  });
  assert.equal(dup.status, 409);
});

test('Clan erstellen mit unerlaubter Bannerfarbe → 400', async () => {
  const p = await leaderReady();
  const res = await api('POST', '/api/clan/create', {
    token: p.token,
    body: { name: `Clan ${uniqueSuffix()}`, tag: makeTag(), banner: { ...validBanner(), primary_color: '#123456' } },
  });
  assert.equal(res.status, 400);
});

test('Beitreten: zweiter Spieler tritt bei → Mitglied; Detail listet beide', async () => {
  const leader = await leaderReady();
  const created = await createClan(leader.token);
  const clanId = created.body.clan.id;

  const member = await leaderReady();
  const join = await api('POST', `/api/clan/join/${clanId}`, { token: member.token });
  assert.equal(join.status, 200);
  assert.equal(join.body.player.clan_id, clanId);

  const detail = await api('GET', `/api/clan/${clanId}`, { token: leader.token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.members.length, 2);
});

test('Doppelter Beitritt (bereits im Clan) → 409', async () => {
  const leader = await leaderReady();
  const created = await createClan(leader.token);
  const clanId = created.body.clan.id;
  const again = await api('POST', `/api/clan/join/${clanId}`, { token: leader.token });
  assert.equal(again.status, 409);
});

test('Clan-Burg-Housing: Stationieren zieht aus der Armee + erhöht Auslastung', async () => {
  const p = await leaderReady();
  await createClan(p.token);
  // Clan-Burg (Stufe 2) direkt setzen + Milizionäre in die Armee geben.
  await sql(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y) VALUES ($1, 'clan_castle', 2, 5, 5)`,
    [p.id],
  );
  await sql(
    `INSERT INTO units (player_id, unit_type, level, quantity) VALUES ($1, 'militia', 1, 5)`,
    [p.id],
  );

  const donate = await api('POST', '/api/clan/castle/donate', {
    token: p.token,
    body: { unit_type: 'militia', quantity: 3 },
  });
  assert.equal(donate.status, 200);
  const cfg = getGameConfig();
  const perUnit = (cfg.units_common.militia as { housing_space: number }).housing_space;
  assert.equal(donate.body.housing_used, perUnit * 3);

  // Über die Kapazität hinaus → 400.
  const tooMany = await api('POST', '/api/clan/castle/donate', {
    token: p.token,
    body: { unit_type: 'militia', quantity: 100 },
  });
  assert.equal(tooMany.status, 400);
});

test('Kriegssuche: Mitglied (kein Leader) → 403, Leader → 200', async () => {
  const leader = await leaderReady();
  const created = await createClan(leader.token);
  const clanId = created.body.clan.id;
  const member = await leaderReady();
  await api('POST', `/api/clan/join/${clanId}`, { token: member.token });

  const asMember = await api('POST', '/api/clan/wars/start', { token: member.token });
  assert.equal(asMember.status, 403);
  const asLeader = await api('POST', '/api/clan/wars/start', { token: leader.token });
  assert.equal(asLeader.status, 200);
});

test('Clan verlassen → ok', async () => {
  const p = await leaderReady();
  await createClan(p.token);
  const res = await api('DELETE', '/api/clan/leave', { token: p.token });
  assert.equal(res.status, 200);
});

test('Rangliste solo: liefert Liste + eigene Position', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/leaderboard/solo', { token: p.token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.entries));
  assert.ok('me' in res.body);
});

test('Rangliste clan (aktuelle Saison): liefert Liste', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/leaderboard/clan', { token: p.token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.entries));
});
