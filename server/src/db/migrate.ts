/**
 * Einfacher SQL-Migrations-Runner.
 *
 *   tsx src/db/migrate.ts up       -> wendet alle ausstehenden Migrationen an
 *   tsx src/db/migrate.ts status   -> zeigt angewandte/ausstehende Migrationen
 *
 * Migrationen sind .sql-Dateien in src/db/migrations, lexikografisch sortiert
 * (z.B. 001_..., 002_...). Jede Datei wird in einer Transaktion ausgefuehrt und
 * in der Tabelle schema_migrations vermerkt.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pool, withTransaction } from './pool';
import { logger } from '../logger';

const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(): Promise<Set<string>> {
  const res = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations',
  );
  return new Set(res.rows.map((r) => r.name));
}

async function up(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const files = getMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info('Keine ausstehenden Migrationen');
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    logger.info(`Wende Migration an: ${file}`);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
    });
    logger.info(`Migration angewandt: ${file}`);
  }
  logger.info(`${pending.length} Migration(en) angewandt`);
}

async function status(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const files = getMigrationFiles();
  for (const file of files) {
    const mark = applied.has(file) ? '[x] angewandt ' : '[ ] ausstehend';
    // eslint-disable-next-line no-console
    console.log(`${mark}  ${file}`);
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';
  try {
    if (cmd === 'up') await up();
    else if (cmd === 'status') await status();
    else {
      // eslint-disable-next-line no-console
      console.error(`Unbekannter Befehl: ${cmd} (erlaubt: up | status)`);
      process.exitCode = 1;
    }
  } catch (err) {
    logger.error('Migration fehlgeschlagen', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
