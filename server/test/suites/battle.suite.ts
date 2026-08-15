import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY_OUTSIDE_RADIUS } from '@village-wars/shared';
import {
  registerPlayer,
  connectSocket,
  waitEvent,
  giveUnits,
  sql,
  type ClientSocket,
} from '../harness';

/**
 * Live-Kampf über Socket.io (Phase 3) — die einzige Schicht, die das REST-E2E nicht
 * abdeckt. Treibt den echten Socket-Server: Handshake-Auth, Matchmaking (Angreifer
 * gegen einen ONLINE-Verteidiger), server-autoritativer Tick-Loop, Deploy,
 * Zustands-Updates und Kampfende/Aufgabe. Es werden zwei echte Clients verbunden
 * (Angreifer + online Verteidiger), kein Bot-Warten (90 s).
 */

test('Socket-Handshake: ungültiges Token → Verbindung abgelehnt', async () => {
  await assert.rejects(connectSocket('kaputtes.token.hier'));
});

test('Matchmaking: join → searching → cancel → cancelled', async () => {
  const p = await registerPlayer();
  const s = await connectSocket(p.token);
  try {
    const searching = waitEvent(s, 'matchmaking:searching', 6000);
    s.emit('matchmaking:join');
    await searching; // Such-Bestätigung erhalten
    const cancelled = waitEvent(s, 'matchmaking:cancelled', 6000);
    s.emit('matchmaking:cancel');
    await cancelled;
  } finally {
    s.disconnect();
  }
});

test('Deploy ohne aktiven Kampf → battle:error', async () => {
  const p = await registerPlayer();
  const s = await connectSocket(p.token);
  try {
    const err = waitEvent(s, 'battle:error', 6000);
    s.emit('battle:deploy_unit', { unit_type: 'militia', x: 5, y: 5 });
    const payload = await err;
    assert.ok(payload.message);
  } finally {
    s.disconnect();
  }
});

test('Voller Live-Kampf: Match → Setup → Deploy → State-Updates → Sieg + Loot', async () => {
  const defender = await registerPlayer(); // frisch: nur ein Rathaus (Lvl 1)
  const attacker = await registerPlayer();
  await giveUnits(attacker.id, 'militia', 60);

  const sDef: ClientSocket = await connectSocket(defender.token); // online → matchbar
  const sAtk: ClientSocket = await connectSocket(attacker.token);
  try {
    let stateUpdates = 0;
    sAtk.on('battle:state_update', () => {
      stateUpdates += 1;
    });
    const matchedP = waitEvent(sAtk, 'matchmaking:matched', 15000);
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    const endedP = waitEvent(sAtk, 'battle:ended', 25000);

    sAtk.emit('matchmaking:join');
    const matched = await matchedP;
    assert.ok(matched.battle_id);
    assert.equal(matched.is_bot, false); // echter Online-Verteidiger

    const setup = await setupP;
    const th = setup.buildings.find((b: any) => b.building_type === 'town_hall');
    assert.ok(th, 'Verteidiger hat ein Rathaus');

    sAtk.emit('battle:start', { battle_id: setup.battle_id });
    // Knapp AUSSERHALB der Deploy-Sperrzone deployen (die Zone reicht
    // DEPLOY_OUTSIDE_RADIUS Kacheln um den Rathaus-Footprint) — die Milizen laufen heran.
    for (let i = 0; i < 60; i++) {
      sAtk.emit('battle:deploy_unit', { unit_type: 'militia', x: th.gx - DEPLOY_OUTSIDE_RADIUS - 1, y: th.gy });
    }

    const ended = await endedP;
    assert.equal(ended.result, 'attacker_win');
    assert.ok(stateUpdates > 0, 'es sollten Zustands-Updates angekommen sein');
    assert.ok(ended.destruction_pct >= 50);
    assert.equal(ended.mode, 'solo');
    assert.ok(ended.loot.wood >= 0 && ended.loot.stone >= 0);
  } finally {
    sAtk.disconnect();
    sDef.disconnect();
  }
});

test('Deploy-Sperrzone: Deploy auf dem Rathaus → battle:error (Server lehnt ab)', async () => {
  const defender = await registerPlayer(); // frisch: nur ein Rathaus, mittig
  const attacker = await registerPlayer();
  await giveUnits(attacker.id, 'militia', 10);

  const sDef: ClientSocket = await connectSocket(defender.token); // online → matchbar
  const sAtk: ClientSocket = await connectSocket(attacker.token);
  try {
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    sAtk.emit('matchmaking:join');
    const setup = await setupP;
    const th = setup.buildings.find((b: any) => b.building_type === 'town_hall');
    assert.ok(th, 'Verteidiger hat ein Rathaus');
    sAtk.emit('battle:start', { battle_id: setup.battle_id });

    // Direkt auf dem Rathaus liegt in der Sperrzone → der Server lehnt AUTORITATIV
    // ab (die Zone wird VOR dem Reserve-Verbrauch geprüft, daher trotz Armee).
    const errP = waitEvent(sAtk, 'battle:error', 6000);
    sAtk.emit('battle:deploy_unit', { unit_type: 'militia', x: th.gx + 0.5, y: th.gy + 0.5 });
    const err = await errP;
    assert.match(err.message, /zu nah/i);

    // Gegenprobe: dieselbe Einheit klar im Vorfeld (außerhalb der Zone) wird NICHT
    // abgelehnt — kein weiteres battle:error innerhalb des Fensters.
    let rejected = false;
    sAtk.on('battle:error', () => {
      rejected = true;
    });
    sAtk.emit('battle:deploy_unit', { unit_type: 'militia', x: th.gx - DEPLOY_OUTSIDE_RADIUS - 1, y: th.gy });
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(rejected, false, 'Deploy im Vorfeld darf nicht abgelehnt werden');
  } finally {
    sAtk.disconnect();
    sDef.disconnect();
  }
});

test('Held im Kampf (P6): Setup enthält Held → Deploy → Sieg → Regen gesetzt', async () => {
  const defender = await registerPlayer(); // frisch: nur ein Rathaus (Lvl 1)
  const attacker = await registerPlayer();
  await giveUnits(attacker.id, 'militia', 60);
  // Held des Angreifers freischalten — NUR Heldenhalle (keine heroes-Zeile):
  // der Held muss bereits ab Level 1 einsatzbereit sein, sobald die Halle steht.
  await sql(
    `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
       VALUES ($1, 'hero_hall', 1, 3, 3)`,
    [attacker.id],
  );

  const sDef: ClientSocket = await connectSocket(defender.token);
  const sAtk: ClientSocket = await connectSocket(attacker.token);
  try {
    const matchedP = waitEvent(sAtk, 'matchmaking:matched', 15000);
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    const endedP = waitEvent(sAtk, 'battle:ended', 25000);

    sAtk.emit('matchmaking:join');
    await matchedP;
    const setup = await setupP;

    // Held muss im Setup auftauchen (deploybar + Anzeige-Info).
    assert.ok(setup.hero, 'setup.hero muss gesetzt sein');
    assert.equal(setup.hero.unit_type, 'hero');
    assert.ok(setup.hero.display_name, 'Held hat einen Anzeigenamen');
    assert.equal(setup.army['hero'], 1, 'Held ist als 1 in der deploybaren Armee');

    const th = setup.buildings.find((b: any) => b.building_type === 'town_hall');
    sAtk.emit('battle:start', { battle_id: setup.battle_id });
    // Held + Truppen knapp AUSSERHALB der Deploy-Sperrzone setzen — sie laufen heran.
    const hx = th.gx - DEPLOY_OUTSIDE_RADIUS - 1;
    sAtk.emit('battle:deploy_unit', { unit_type: 'hero', x: hx, y: th.gy });
    for (let i = 0; i < 60; i++) {
      sAtk.emit('battle:deploy_unit', { unit_type: 'militia', x: hx, y: th.gy });
    }

    const ended = await endedP;
    assert.equal(ended.result, 'attacker_win');

    // Held wurde eingesetzt → Regeneration muss gesetzt sein. setHeroRegenAfterBattle
    // läuft fire-and-forget NACH dem battle:ended-Event, daher kurz pollen.
    let regen: string | null = null;
    for (let i = 0; i < 20; i++) {
      const [hero] = await sql<{ regenerates_at: string | null }>(
        `SELECT regenerates_at FROM heroes WHERE player_id = $1`,
        [attacker.id],
      );
      regen = hero?.regenerates_at ?? null;
      if (regen) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(regen, 'regenerates_at muss nach dem Einsatz gesetzt sein');
  } finally {
    sAtk.disconnect();
    sDef.disconnect();
  }
});

test('Aufgeben: battle:surrender → Kampfende als defender_win', async () => {
  const defender = await registerPlayer();
  const attacker = await registerPlayer();

  const sDef = await connectSocket(defender.token);
  const sAtk = await connectSocket(attacker.token);
  try {
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    const endedP = waitEvent(sAtk, 'battle:ended', 15000);

    sAtk.emit('matchmaking:join');
    const setup = await setupP;
    sAtk.emit('battle:start', { battle_id: setup.battle_id });
    sAtk.emit('battle:surrender');

    const ended = await endedP;
    assert.equal(ended.result, 'defender_win');
  } finally {
    sAtk.disconnect();
    sDef.disconnect();
  }
});

test('Doppel-Angriff: matchmaking:join während eines aktiven Kampfes → battle:error', async () => {
  const defender = await registerPlayer();
  const attacker = await registerPlayer();
  const sDef = await connectSocket(defender.token);
  const sAtk = await connectSocket(attacker.token);
  try {
    const setupP = waitEvent(sAtk, 'battle:setup', 15000);
    sAtk.emit('matchmaking:join');
    await setupP; // Kampf läuft jetzt
    const errP = waitEvent(sAtk, 'battle:error', 6000);
    sAtk.emit('matchmaking:join'); // erneut → bereits im Kampf
    const err = await errP;
    assert.ok(err.message);
  } finally {
    sAtk.disconnect();
    sDef.disconnect();
  }
});
