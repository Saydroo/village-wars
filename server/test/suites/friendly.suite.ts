import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY_OUTSIDE_RADIUS } from '@village-wars/shared';
import {
  api,
  registerPlayer,
  setTownHallLevel,
  sql,
  getGameConfig,
  connectSocket,
  waitEvent,
  giveUnits,
  uniqueSuffix,
  type TestPlayer,
} from '../harness';

/**
 * Freundschaftskämpfe (Roadmap P9) über Socket.io (`friendly:challenge`). Übungs-
 * kampf gegen das echte Layout eines Clan-Kameraden — KEIN Loot, KEINE Trophäen,
 * KEIN Truppen-Verbrauch, KEINE Persistenz (reine Übung).
 */

let tagN = 0;
function makeTag(): string {
  tagN += 1;
  return ('F' + tagN.toString(36).toUpperCase()).slice(0, 5).padEnd(3, 'X');
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
async function createClanFor(p: TestPlayer): Promise<string> {
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  const res = await api('POST', '/api/clan/create', {
    token: p.token,
    body: { name: `Frnd ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.clan.id;
}
async function joinClan(p: TestPlayer, clanId: string): Promise<void> {
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  const res = await api('POST', `/api/clan/join/${clanId}`, { token: p.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
}

test('friendly:challenge ohne Ziel → battle:error', async () => {
  const p = await registerPlayer();
  const s = await connectSocket(p.token);
  try {
    const errP = waitEvent(s, 'battle:error', 6000);
    s.emit('friendly:challenge', {});
    const err = await errP;
    assert.match(err.message, /Ziel/i);
  } finally {
    s.disconnect();
  }
});

test('friendly:challenge gegen sich selbst → battle:error', async () => {
  const p = await registerPlayer();
  const s = await connectSocket(p.token);
  try {
    const errP = waitEvent(s, 'battle:error', 6000);
    s.emit('friendly:challenge', { target_player_id: p.id });
    const err = await errP;
    assert.match(err.message, /Ziel/i);
  } finally {
    s.disconnect();
  }
});

test('friendly:challenge gegen Nicht-Clan-Mitglied → battle:error', async () => {
  const attacker = await registerPlayer();
  const stranger = await registerPlayer();
  await createClanFor(attacker); // attacker im Clan, stranger nicht
  const s = await connectSocket(attacker.token);
  try {
    const errP = waitEvent(s, 'battle:error', 6000);
    s.emit('friendly:challenge', { target_player_id: stranger.id });
    const err = await errP;
    assert.match(err.message, /Clan/i);
  } finally {
    s.disconnect();
  }
});

test('Freundschaftskampf: friendly:challenge → mode=friendly, KEINE Trophäen/Loot/Verbrauch/Persistenz', async () => {
  const attacker = await registerPlayer();
  const defender = await registerPlayer();
  const clanId = await createClanFor(attacker);
  await joinClan(defender, clanId);
  await giveUnits(attacker.id, 'militia', 60);

  const sAtk = await connectSocket(attacker.token);
  try {
    const matchedP = waitEvent(sAtk, 'matchmaking:matched', 15000);
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    const endedP = waitEvent(sAtk, 'battle:ended', 30000);

    sAtk.emit('friendly:challenge', { target_player_id: defender.id });
    const matched = await matchedP;
    assert.equal(matched.mode, 'friendly');
    assert.equal(matched.is_bot, false); // echtes Clan-Mitglied
    assert.equal(matched.defender_username, defender.username);

    const setup = await setupP;
    const th = setup.buildings.find((b: any) => b.building_type === 'town_hall');
    assert.ok(th, 'Verteidiger-Dorf hat ein Rathaus');
    sAtk.emit('battle:start', { battle_id: setup.battle_id });
    // Knapp AUSSERHALB der Deploy-Sperrzone (DEPLOY_OUTSIDE_RADIUS Kacheln um den
    // Rathaus-Footprint) — die Milizen laufen heran und zerstören es.
    for (let i = 0; i < 60; i++) {
      sAtk.emit('battle:deploy_unit', { unit_type: 'militia', x: th.gx - DEPLOY_OUTSIDE_RADIUS - 1, y: th.gy });
    }

    const ended = await endedP;
    assert.equal(ended.mode, 'friendly');
    assert.equal(ended.trophies_change, 0); // Übung: keine Trophäen
    assert.equal(ended.loot.wood, 0); // Übung: kein Loot
    assert.equal(ended.loot.stone, 0);

    // KEIN Truppen-Verbrauch: Angreifer hat noch alle 60 Milizen.
    const army = await sql<{ quantity: number }>(
      `SELECT quantity FROM units WHERE player_id = $1 AND unit_type = 'militia'`,
      [attacker.id],
    );
    assert.equal(Number(army[0]!.quantity), 60, 'Übung verbraucht keine Truppen');

    // KEINE Persistenz: keine battles-Zeile für diesen Angreifer.
    const battles = await sql<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM battles WHERE attacker_id = $1`,
      [attacker.id],
    );
    assert.equal(Number(battles[0]!.n), 0, 'Übungskampf wird nicht persistiert');

    // Trophäen beider Spieler unverändert (0).
    const meA = await api('GET', '/api/player/me', { token: attacker.token });
    assert.equal(meA.body.player.trophies, 0);
    const meD = await api('GET', '/api/player/me', { token: defender.token });
    assert.equal(meD.body.player.trophies, 0);
  } finally {
    sAtk.disconnect();
  }
});
