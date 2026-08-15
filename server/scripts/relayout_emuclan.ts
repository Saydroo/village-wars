/**
 * emuclan (+ botfull-KOPIE) als CLASH-REFERENZ-LAYOUT neu aufbauen (S5) — DB-Applier.
 *
 * Baut das Dorf exakt nach dem parametrisierbaren Zonen-Generator
 * (tools/layout/emuclanLayout.ts) neu auf. Der Generator ist die EINZIGE Layout-
 * und Footprint-Quelle (Footprints aus der manifest.json). Es werden ZWEI Dörfer
 * synchron gehalten: `emuclan` (Referenz) und `botfull` (die Bot-Kopie, die das
 * Matchmaking als Vollbasis-Gegner nutzt) — sonst testet man am Gerät gegen ein
 * veraltetes Bot-Layout.
 *
 * Ablauf je Dorf: Ist-Level je Typ merken → Gebäude in einer Transaktion neu
 * setzen (Level erhalten, wo vorhanden) → layout-JSON synchronisieren → aus der
 * DB per Footprint-Kollisionsprüfung verifizieren.
 *
 *   npx tsx server/scripts/relayout_emuclan.ts
 *   $env:DATABASE_URL="postgresql://postgres@localhost:55432/village_wars"; npx tsx server/scripts/relayout_emuclan.ts
 */
import { Client } from 'pg';
import {
  generateEmuclanLayout,
  footprintOverlaps,
  coverageReport,
  type GeneratedLayout,
  type Placement,
} from '../../tools/layout/emuclanLayout';

const DB = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:55432/village_wars';
/** Referenz-Dorf UND seine Bot-Kopie — beide bekommen exakt das Generator-Layout. */
const USERNAMES = ['emuclan', 'botfull'];
/** Fallback-Level je Typ für Instanzen, die es im Ist-Zustand (noch) nicht gibt. */
const DEFAULT_LEVEL: Record<string, number> = { town_hall: 5, clan_castle: 2 };

/** Setzt EIN Dorf komplett auf das Generator-Layout um (Level je Typ erhalten). */
async function applyToPlayer(c: Client, username: string, layout: GeneratedLayout): Promise<void> {
  const { rows: pl } = await c.query('SELECT id FROM players WHERE username=$1', [username]);
  if (!pl.length) {
    console.warn(`  ${username.padEnd(10)}: Spieler nicht gefunden — übersprungen.`);
    return;
  }
  const pid = pl[0].id as string;

  // Grid auf mind. 44×44 sicherstellen (Layout ist auf 44 zentriert).
  await c.query(
    'UPDATE villages SET grid_width=GREATEST(grid_width,44), grid_height=GREATEST(grid_height,44) WHERE player_id=$1',
    [pid],
  );

  // Ist-Level je Typ als Pool (absteigend) merken, damit Upgrades erhalten bleiben.
  const { rows: before } = await c.query(
    'SELECT building_type, level FROM buildings WHERE player_id=$1',
    [pid],
  );
  const levelPool = new Map<string, number[]>();
  for (const b of before) {
    const arr = levelPool.get(b.building_type as string) ?? [];
    arr.push(Number(b.level));
    levelPool.set(b.building_type as string, arr);
  }
  for (const arr of levelPool.values()) arr.sort((x, y) => y - x);
  const nextLevel = (type: string): number => {
    const pool = levelPool.get(type);
    if (pool && pool.length) return pool.shift()!;
    return DEFAULT_LEVEL[type] ?? 1;
  };

  await c.query('BEGIN');
  try {
    const inserted: Array<{ id: string; p: Placement }> = [];
    await c.query('DELETE FROM buildings WHERE player_id=$1', [pid]);
    for (const p of layout.all) {
      const { rows } = await c.query(
        `INSERT INTO buildings (player_id, building_type, level, grid_x, grid_y)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [pid, p.type, nextLevel(p.type), p.gx, p.gy],
      );
      inserted.push({ id: rows[0].id as string, p });
    }
    const layoutJson = inserted.map((i) => ({ building_id: i.id, grid_x: i.p.gx, grid_y: i.p.gy }));
    await c.query('UPDATE villages SET layout=$1, updated_at=NOW() WHERE player_id=$2', [
      JSON.stringify(layoutJson), pid,
    ]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  // Aus der DB verifizieren (harte Regel: keine Footprint-Kollision).
  const { rows: after } = await c.query(
    'SELECT building_type, grid_x, grid_y FROM buildings WHERE player_id=$1',
    [pid],
  );
  const dbPlacements: Placement[] = after.map((r) => ({
    type: r.building_type as string, gx: Number(r.grid_x), gy: Number(r.grid_y), zone: 'core',
  }));
  const dbCollisions = footprintOverlaps(dbPlacements);
  console.log(
    `  ${username.padEnd(10)}: ${after.length} Gebäude neu gesetzt · ` +
    `Footprint-Kollision ${dbCollisions.length === 0 ? '✓ keine' : `⚠ ${dbCollisions.length}`}`,
  );
}

async function main(): Promise<void> {
  const layout = generateEmuclanLayout();

  // Harte Vorprüfung: das Generator-Layout darf KEINE Footprint-Kollision haben.
  const collisions = footprintOverlaps(layout.all);
  if (collisions.length) {
    console.error(`ABBRUCH: ${collisions.length} Footprint-Kollisionen im Generator-Layout:`);
    collisions.slice(0, 8).forEach((c) => console.error(`  ${c.a} ⨯ ${c.b}`));
    process.exit(1);
  }
  const cov = coverageReport(layout);
  const wpct = Math.round((cov.wallCovered / cov.wallTotal) * 100);
  const fpct = cov.ffTotal ? Math.round((cov.ffCovered / cov.ffTotal) * 100) : 100;
  console.log(
    `Generator OK · ${layout.all.length} Gebäude · ` +
    `Mauerlinie ${cov.wallCovered}/${cov.wallTotal} (${wpct} %, Überlappung ${cov.wallOverlap}) · ` +
    `Vorfeld ${cov.ffCovered}/${cov.ffTotal} (${fpct} %)`,
  );

  const c = new Client({ connectionString: DB });
  await c.connect();
  try {
    console.log(`\nDörfer umsetzen (${USERNAMES.join(', ')}):`);
    for (const username of USERNAMES) await applyToPlayer(c, username, layout);
    console.log('\nFertig. emuclan + botfull entsprechen dem Generator (tools/layout/emuclanLayout.ts).');
  } finally {
    await c.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
