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
 * Clan-Krieg-Live-Duell über Socket.io (`clanwar:join`). Bisher die einzige nicht
 * automatisierte Socket-Schicht (braucht zwei Clans). Anders als Solo zählt hier nur
 * die **Zerstörung als Kriegspunkte** — keine Solo-Trophäen, kein Ressourcen-Loot
 * (getrennter Wettbewerb, Abschnitt 10/11). Der aktive Krieg wird direkt per SQL
 * geseedet, da das Clan-Krieg-Matchmaking in der Harness bewusst nicht läuft.
 */

let tagN = 0;
function makeTag(): string {
  tagN += 1;
  return ('W' + tagN.toString(36).toUpperCase()).slice(0, 5).padEnd(3, 'X');
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

/** Hebt den Spieler auf das Clan-Mindest-Rathaus + gründet einen Clan, liefert dessen ID. */
async function createClanFor(p: TestPlayer): Promise<string> {
  await setTownHallLevel(p.id, getGameConfig().clan.unlock_town_hall_level);
  const res = await api('POST', '/api/clan/create', {
    token: p.token,
    body: { name: `War ${uniqueSuffix()}`, tag: makeTag(), banner: validBanner() },
  });
  assert.equal(res.status, 201, `Clan anlegen: ${JSON.stringify(res.body)}`);
  return res.body.clan.id;
}

test('clanwar:join ohne laufenden Krieg → battle:error', async () => {
  const p = await registerPlayer();
  const s = await connectSocket(p.token);
  try {
    const errP = waitEvent(s, 'battle:error', 6000);
    s.emit('clanwar:join');
    const err = await errP;
    assert.match(err.message, /Krieg/);
  } finally {
    s.disconnect();
  }
});

test('Clan-Krieg-Duell: clanwar:join → mode=clan_war, Punkte=Zerstörung, KEINE Trophäen/Loot', async () => {
  const attacker = await registerPlayer();
  const defender = await registerPlayer();
  const clanA = await createClanFor(attacker);
  const clanB = await createClanFor(defender);
  await giveUnits(attacker.id, 'militia', 60);

  // Aktiven Krieg A↔B direkt seeden (ends_at in der Zukunft → wird nicht abgerechnet).
  const warRows = await sql<{ id: string }>(
    `INSERT INTO clan_wars (clan_a_id, clan_b_id, status, season_number, started_at, ends_at)
     VALUES ($1, $2, 'in_progress',
             (SELECT season_number FROM seasons WHERE is_active = TRUE ORDER BY season_number DESC LIMIT 1),
             NOW(), NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [clanA, clanB],
  );
  const warId = warRows[0]!.id;

  const sAtk = await connectSocket(attacker.token);
  try {
    const matchedP = waitEvent(sAtk, 'matchmaking:matched', 15000);
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    const endedP = waitEvent(sAtk, 'battle:ended', 30000);

    sAtk.emit('clanwar:join');
    const matched = await matchedP;
    assert.equal(matched.mode, 'clan_war');
    assert.equal(matched.is_bot, false); // echtes feindliches Clan-Mitglied

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
    assert.equal(ended.mode, 'clan_war');
    assert.equal(ended.result, 'attacker_win');
    assert.equal(ended.trophies_change, 0); // Krieg: keine Solo-Trophäen
    assert.equal(ended.loot.wood, 0); // Krieg: kein Loot
    assert.equal(ended.loot.stone, 0);

    // Kriegspunkte = erzielte Zerstörung (Angreifer = clan_a).
    const war = await sql<{ clan_a_points: number; clan_b_points: number }>(
      `SELECT clan_a_points, clan_b_points FROM clan_wars WHERE id = $1`,
      [warId],
    );
    assert.ok(Number(war[0]!.clan_a_points) >= 50, 'Angreifer-Clan-Punkte = Zerstörung');

    // battles-Zeile mode=clan_war + clan_war_id, 0 Trophäen/Loot.
    const battles = await sql<{ mode: string; trophies_change: number; loot_wood: number }>(
      `SELECT mode, trophies_change, loot_wood FROM battles WHERE clan_war_id = $1`,
      [warId],
    );
    assert.equal(battles.length, 1);
    assert.equal(battles[0]!.mode, 'clan_war');
    assert.equal(Number(battles[0]!.trophies_change), 0);
    assert.equal(Number(battles[0]!.loot_wood), 0);

    // Angreifer-Trophäen unverändert (0).
    const me = await api('GET', '/api/player/me', { token: attacker.token });
    assert.equal(me.body.player.trophies, 0);
  } finally {
    sAtk.disconnect();
  }
});
