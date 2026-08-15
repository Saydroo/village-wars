import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../env';
import { logger } from '../logger';

/**
 * PostgreSQL-Connection-Pool. Liest entweder DATABASE_URL oder die
 * Standard-PG*-Umgebungsvariablen (pg liest letztere automatisch).
 */
const pool = new Pool(
  env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {},
);

pool.on('error', (err) => {
  logger.error('Unerwarteter Fehler im PG-Pool', { error: err.message });
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

/** Führt eine Funktion innerhalb einer Transaktion aus (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
