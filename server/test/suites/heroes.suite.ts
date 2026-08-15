import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, sql, grant, setTownHallLevel, cfg } from '../harness';

/**
 * Helden (Roadmap P6). Testet Status, Level-Up-Queue, Settle-on-Read,
 * Abbrechen, Validierung und Auth-Schutz.
 */

/** Legt eine Heldenhalle für den Spieler an (Level 1 → sofort fertig). */
async function giveHeroHall(playerId: string): Promise<void> {
  await setTownHallLevel(playerId, 5); // TH5 = Voraussetzung
  // Nur einfügen wenn noch keine Heldenhalle vorhanden
  const existing = await sql(
    `SELECT id FROM buildings WHERE player_id = $1 AND building_type = 'hero_hall'`,
    [playerId],
  );
  if (existing.length === 0) {
    await sql(
      `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
       VALUES ($1, 'hero_hall', 1, 3, 3)`,
      [playerId],
    );
  }
}

test('GET /api/heroes — frischer Spieler ohne Heldenhalle: no_hall=true', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/heroes', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.no_hall, true);
  assert.equal(res.body.level, 1);
});

test('GET /api/heroes — nach Heldenhalle: no_hall=false, display_name gesetzt', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  const res = await api('GET', '/api/heroes', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.no_hall, false);
  assert.ok(res.body.display_name, 'display_name muss gesetzt sein');
  assert.equal(res.body.level, 1);
  assert.equal(res.body.leveling_until, null);
  assert.equal(res.body.regenerates_until, null);
});

test('POST /api/heroes/levelup — ohne Heldenhalle → 400', async () => {
  const p = await registerPlayer();
  const res = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(res.status, 400);
});

test('POST /api/heroes/levelup — ohne Gold → 400', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  // Nullsetzt Gold
  await sql(`UPDATE players SET gold = 0 WHERE id = $1`, [p.id]);
  const res = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(res.status, 400);
});

test('POST /api/heroes/levelup — mit Gold → leveling_until gesetzt, Gold abgezogen', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  const cost = cfg.heroes.level_costs.find((c) => c.to_level === 2)!;
  await grant(p.id, { gold: cost.gold + 500 });

  const before = await api('GET', '/api/heroes', { token: p.token });
  assert.equal(before.body.level, 1);

  const res = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.leveling_until, 'leveling_until muss gesetzt sein');
  assert.ok(new Date(res.body.leveling_until) > new Date(), 'leveling_until muss in der Zukunft liegen');

  const [player] = await sql<{ gold: string }>(`SELECT gold FROM players WHERE id = $1`, [p.id]);
  assert.equal(Number(player!.gold), 500, 'Gold muss abgezogen worden sein');
});

test('POST /api/heroes/levelup — doppelt → 400 (Queue bereits aktiv)', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  const cost = cfg.heroes.level_costs.find((c) => c.to_level === 2)!;
  await grant(p.id, { gold: cost.gold * 2 + 500 });

  const first = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(first.status, 200);

  const second = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(second.status, 400);
});

test('DELETE /api/heroes/levelup — abbrechbar (kein Gold zurück)', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  const cost = cfg.heroes.level_costs.find((c) => c.to_level === 2)!;
  await grant(p.id, { gold: cost.gold + 100 });

  const start = await api('POST', '/api/heroes/levelup', { token: p.token });
  assert.equal(start.status, 200);

  const cancel = await api('DELETE', '/api/heroes/levelup', { token: p.token });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.leveling_until, null);

  const [player] = await sql<{ gold: string }>(`SELECT gold FROM players WHERE id = $1`, [p.id]);
  assert.equal(Number(player!.gold), 100, 'Gold darf NICHT erstattet werden');
});

test('DELETE /api/heroes/levelup — kein aktives Upgrade → 400', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  const res = await api('DELETE', '/api/heroes/levelup', { token: p.token });
  assert.equal(res.status, 400);
});

test('Settle-on-Read: abgelaufene Queue → Level wird auf 2 gesetzt', async () => {
  const p = await registerPlayer();
  await giveHeroHall(p.id);
  await sql(`INSERT INTO heroes (player_id, level) VALUES ($1, 1) ON CONFLICT DO NOTHING`, [p.id]);
  // Queue mit in-der-Vergangenheit liegendem finishes_at
  await sql(
    `INSERT INTO hero_level_queue (player_id, target_level, started_at, finishes_at)
     VALUES ($1, 2, now() - interval '2 hours', now() - interval '1 minute')`,
    [p.id],
  );
  const res = await api('GET', '/api/heroes', { token: p.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.level, 2, 'Held muss Level 2 sein (Settle-on-Read)');
  assert.equal(res.body.leveling_until, null, 'Queue muss geleert worden sein');
});

test('GET /api/heroes — ohne Token → 401', async () => {
  const res = await api('GET', '/api/heroes', {});
  assert.equal(res.status, 401);
});

test('POST /api/heroes/levelup — ohne Token → 401', async () => {
  const res = await api('POST', '/api/heroes/levelup', {});
  assert.equal(res.status, 401);
});
