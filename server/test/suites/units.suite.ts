import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, grant, sql, getGameConfig } from '../harness';

/** Macht alle laufenden Trainings eines Spielers sofort fällig (statt echtem Warten). */
async function finishTraining(playerId: string): Promise<void> {
  await sql(`UPDATE unit_training_queue SET finish_at = NOW() - INTERVAL '1 second' WHERE player_id = $1`, [
    playerId,
  ]);
}

test('Training einreihen: zieht Ressourcen ab + erscheint als laufendes Training', async () => {
  const p = await registerPlayer();
  const before = await api('GET', '/api/player/me', { token: p.token });
  const woodBefore = before.body.player.wood;

  const res = await api('POST', '/api/units/train', {
    token: p.token,
    body: { unit_type: 'militia', quantity: 5 },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.training.length, 1);

  const cfg = getGameConfig();
  const militiaWood = (cfg.units_common.militia as { cost: { wood: number } }).cost.wood;
  assert.equal(res.body.player.wood, woodBefore - militiaWood * 5);
});

test('Fertiges Training landet in der Armee (getArmy settelt)', async () => {
  const p = await registerPlayer();
  await api('POST', '/api/units/train', { token: p.token, body: { unit_type: 'militia', quantity: 5 } });
  await finishTraining(p.id);
  const army = await api('GET', '/api/units/me', { token: p.token });
  assert.equal(army.status, 200);
  const militia = army.body.units.find((u: any) => u.unit_type === 'militia');
  assert.ok(militia, 'Milizionäre sollten in der Armee sein');
  assert.equal(militia.quantity, 5);
  assert.equal(army.body.training.length, 0);
});

test('Einheiten entlassen reduziert die Menge', async () => {
  const p = await registerPlayer();
  await api('POST', '/api/units/train', { token: p.token, body: { unit_type: 'militia', quantity: 5 } });
  await finishTraining(p.id);
  const army = await api('GET', '/api/units/me', { token: p.token });
  const unitId = army.body.units.find((u: any) => u.unit_type === 'militia').id;

  const res = await api('DELETE', `/api/units/${unitId}`, { token: p.token, body: { quantity: 2 } });
  assert.equal(res.status, 200);
  const militia = res.body.units.find((u: any) => u.unit_type === 'militia');
  assert.equal(militia.quantity, 3);
});

test('Nicht freigeschaltete Einheit (zu niedriges Rathaus) → 400', async () => {
  const p = await registerPlayer(); // village_level 1
  const cfg = getGameConfig();
  // Eine gemeinsame Einheit mit unlock > 1 finden (z.B. Ritter/Katapult).
  const locked = Object.entries(cfg.units_common).find(
    ([k, v]) => k !== 'description' && typeof v === 'object' && (v as any).unlock_town_hall_level > 1,
  );
  assert.ok(locked, 'es sollte eine erst später freigeschaltete Einheit geben');
  const res = await api('POST', '/api/units/train', {
    token: p.token,
    body: { unit_type: locked![0], quantity: 1 },
  });
  assert.equal(res.status, 400);
});

test('Unbekannte Einheit → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/units/train', {
    token: p.token,
    body: { unit_type: 'phantom_unit', quantity: 1 },
  });
  assert.equal(res.status, 400);
});

test('Zu wenig Ressourcen → 400', async () => {
  const p = await registerPlayer();
  await grant(p.id, { wood: 0, stone: 0, gold: 0 });
  const res = await api('POST', '/api/units/train', {
    token: p.token,
    body: { unit_type: 'militia', quantity: 10 },
  });
  assert.equal(res.status, 400);
});
