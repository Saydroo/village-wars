import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, grant, sql } from '../harness';

async function townHallId(playerId: string): Promise<string> {
  const v = await api('GET', `/api/village/${playerId}`);
  const th = v.body.buildings.find((b: any) => b.building_type === 'town_hall');
  assert.ok(th, 'Rathaus sollte existieren');
  return th.id;
}

test('GET /village/:playerId ist öffentlich + liefert Dorf + Rathaus', async () => {
  const p = await registerPlayer();
  const res = await api('GET', `/api/village/${p.id}`); // ohne Token
  assert.equal(res.status, 200);
  assert.ok(res.body.village);
  assert.equal(res.body.buildings.length, 1);
  assert.equal(res.body.buildings[0].building_type, 'town_hall');
  assert.equal(res.body.buildings[0].level, 1);
});

test('Gebäude platzieren: Holzfäller ist gratis → 201', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/village/buildings', {
    token: p.token,
    body: { building_type: 'lumber_camp', grid_x: 10, grid_y: 10 },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.building.building_type, 'lumber_camp');
});

test('Gebäude platzieren auf belegtem Feld → Fehler (4xx)', async () => {
  const p = await registerPlayer();
  // Auf die TATSÄCHLICHE Rathaus-Kachel platzieren (Grid-Mitte) — robust gegen
  // Grid-Größen-Änderungen (Migration 021: 44×44 → Rathaus bei 22,22, nicht 15,15).
  const v = await api('GET', `/api/village/${p.id}`);
  const th = v.body.buildings.find((b: any) => b.building_type === 'town_hall');
  assert.ok(th, 'Rathaus sollte existieren');
  const res = await api('POST', '/api/village/buildings', {
    token: p.token,
    body: { building_type: 'lumber_camp', grid_x: th.grid_x, grid_y: th.grid_y },
  });
  assert.ok(res.status >= 400 && res.status < 500, `erwartet 4xx, war ${res.status}`);
});

test('Rathaus-Upgrade starten: Startressourcen reichen exakt → Abzug + is_upgrading', async () => {
  const p = await registerPlayer();
  const thId = await townHallId(p.id);
  const res = await api('POST', `/api/village/buildings/${thId}/upgrade/start`, { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.building.is_upgrading, true);
  // Stufe-2-Kosten = 500 Holz / 300 Stein → Bestand 500/300 → 0/0.
  assert.equal(res.body.player.wood, 0);
  assert.equal(res.body.player.stone, 0);
});

test('Upgrade erneut starten, während es läuft → 409', async () => {
  const p = await registerPlayer();
  const thId = await townHallId(p.id);
  await api('POST', `/api/village/buildings/${thId}/upgrade/start`, { token: p.token });
  const again = await api('POST', `/api/village/buildings/${thId}/upgrade/start`, { token: p.token });
  assert.equal(again.status, 409);
});

test('Upgrade-Skip gegen Goldbarren → Stufe steigt + village_level synct', async () => {
  const p = await registerPlayer();
  const thId = await townHallId(p.id);
  await api('POST', `/api/village/buildings/${thId}/upgrade/start`, { token: p.token });
  await grant(p.id, { gold_bars: 1000 });
  const skip = await api('POST', `/api/village/buildings/${thId}/upgrade/skip`, { token: p.token });
  assert.equal(skip.status, 200);
  assert.equal(skip.body.building.level, 2);
  assert.equal(skip.body.building.is_upgrading, false);
  // Rathaus → village_level wird mitgezogen.
  const me = await api('GET', '/api/player/me', { token: p.token });
  assert.equal(me.body.player.village_level, 2);
});

test('Upgrade ohne Ressourcen → 400', async () => {
  const p = await registerPlayer();
  const thId = await townHallId(p.id);
  await grant(p.id, { wood: 0, stone: 0, gold: 0 });
  const res = await api('POST', `/api/village/buildings/${thId}/upgrade/start`, { token: p.token });
  assert.equal(res.status, 400);
});

test('Gebäude einlagern → Inventar → aus Inventar platzieren', async () => {
  const p = await registerPlayer();
  const place = await api('POST', '/api/village/buildings', {
    token: p.token,
    body: { building_type: 'lumber_camp', grid_x: 12, grid_y: 8 },
  });
  const buildingId = place.body.building.id;

  const store = await api('POST', `/api/village/buildings/${buildingId}/store`, { token: p.token });
  assert.equal(store.status, 200);
  assert.ok(store.body.inventory.length >= 1);

  const list = await api('GET', '/api/village/inventory/list', { token: p.token });
  const invItem = list.body.inventory.find((i: any) => i.building_type === 'lumber_camp');
  assert.ok(invItem, 'eingelagertes Lager sollte im Inventar sein');

  const replace = await api('POST', `/api/village/inventory/${invItem.id}/place`, {
    token: p.token,
    body: { grid_x: 9, grid_y: 9 },
  });
  assert.equal(replace.status, 201);
  assert.equal(replace.body.building.building_type, 'lumber_camp');
});

test('Nicht-UUID-Gebäude-ID → 400 (zentrale 22P02-Abbildung), nicht 500', async () => {
  const p = await registerPlayer();
  const res = await api('POST', `/api/village/buildings/kein-uuid/upgrade/start`, { token: p.token });
  assert.equal(res.status, 400);
});
