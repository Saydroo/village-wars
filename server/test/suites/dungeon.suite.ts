import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, getGameConfig } from '../harness';
import { isDungeonOpen } from '../../src/services/dungeonService';

/** Schaltet das Dev-Zeitfenster (dev_always_open) im laufenden Config-Objekt um. */
function setDungeonOpen(open: boolean): void {
  getGameConfig().dungeon.dev_always_open = open;
}

async function giveArmy(playerId: string, unitType: string, qty: number): Promise<void> {
  await sql(
    `INSERT INTO units (player_id, unit_type, level, quantity) VALUES ($1, $2, 1, $3)
     ON CONFLICT (player_id, unit_type) DO UPDATE SET quantity = units.quantity + EXCLUDED.quantity`,
    [playerId, unitType, qty],
  );
}

test('Status spiegelt den echten Zeitplan (dev_always_open=false); Start bei geschlossen → 400', async () => {
  // Datum-unabhängig: ohne dev_always_open MUSS der Endpunkt exakt isDungeonOpen()
  // entsprechen (am Wochenende ist der Dungeon laut Zeitplan geöffnet — das ist korrekt).
  setDungeonOpen(false);
  const expectedOpen = isDungeonOpen(getGameConfig());
  const p = await registerPlayer();
  const status = await api('GET', '/api/dungeon/status', { token: p.token });
  assert.equal(status.status, 200);
  assert.equal(status.body.open, expectedOpen);

  // Den 400-Pfad nur prüfen, wenn aktuell tatsächlich geschlossen.
  if (!expectedOpen) {
    const start = await api('POST', '/api/dungeon/start', { token: p.token, body: {} });
    assert.equal(start.status, 400);
  }
});

test('Status bei offenem Dungeon → open=true', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  const status = await api('GET', '/api/dungeon/status', { token: p.token });
  assert.equal(status.body.open, true);
  assert.equal(status.body.total_waves, getGameConfig().dungeon.structure.waves);
});

test('Start ohne Armee → 400', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  const res = await api('POST', '/api/dungeon/start', { token: p.token, body: {} });
  assert.equal(res.status, 400);
});

test('Start: Wellen sind vor dem Kampf VERBORGEN (kein enemies-Feld)', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  await giveArmy(p.id, 'knight', 300);
  const res = await api('POST', '/api/dungeon/start', { token: p.token, body: { difficulty: 'easy' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.run.status, 'in_progress');
  assert.ok(Array.isArray(res.body.waves) && res.body.waves.length > 0);
  for (const w of res.body.waves) {
    assert.equal('enemies' in w, false, 'Wellen-Vorschau darf keine Gegner verraten');
    assert.equal(typeof w.wave, 'number');
  }
});

test('Voller Durchlauf: starke Armee räumt alle Wellen + Boss → Belohnung + Gold gutgeschrieben', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  await giveArmy(p.id, 'knight', 400);
  const goldBefore = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold;

  const start = await api('POST', '/api/dungeon/start', { token: p.token, body: { difficulty: 'easy' } });
  assert.equal(start.status, 201);

  let finished = false;
  let lastRewards: any = null;
  for (let i = 0; i < 10 && !finished; i++) {
    const wave = await api('POST', '/api/dungeon/wave/complete', { token: p.token });
    assert.equal(wave.status, 200);
    // Gegner werden ERST nach dem Kampf enthüllt (als Map unit_type -> Anzahl).
    assert.equal(typeof wave.body.enemies_faced, 'object');
    assert.notEqual(wave.body.enemies_faced, null);
    finished = wave.body.finished;
    if (wave.body.rewards) lastRewards = wave.body.rewards;
  }
  assert.equal(finished, true);
  assert.ok(lastRewards, 'am Ende sollte es eine Belohnung geben');
  assert.ok(lastRewards.gold > 0);

  const goldAfter = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold;
  assert.ok(goldAfter >= goldBefore, 'Gold sollte gutgeschrieben sein (auf Cap geklemmt)');
});

test('one_run_per_week: erneuter Start nach Abschluss → 409', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  await giveArmy(p.id, 'knight', 400);
  await api('POST', '/api/dungeon/start', { token: p.token, body: { difficulty: 'easy' } });
  let finished = false;
  for (let i = 0; i < 10 && !finished; i++) {
    const wave = await api('POST', '/api/dungeon/wave/complete', { token: p.token });
    finished = wave.body.finished;
  }
  assert.equal(finished, true);
  const restart = await api('POST', '/api/dungeon/start', { token: p.token, body: {} });
  assert.equal(restart.status, 409);
});

test('Historie listet abgeschlossene Läufe', async () => {
  setDungeonOpen(true);
  const p = await registerPlayer();
  await giveArmy(p.id, 'knight', 400);
  await api('POST', '/api/dungeon/start', { token: p.token, body: {} });
  let finished = false;
  for (let i = 0; i < 10 && !finished; i++) {
    const wave = await api('POST', '/api/dungeon/wave/complete', { token: p.token });
    finished = wave.body.finished;
  }
  const hist = await api('GET', '/api/dungeon/history', { token: p.token });
  assert.equal(hist.status, 200);
  assert.ok(Array.isArray(hist.body.runs) && hist.body.runs.length >= 1);
  setDungeonOpen(false); // Dev-Flag wieder zurücksetzen
});
