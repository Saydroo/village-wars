import Redis from 'ioredis';
import { env } from '../env';
import { logger } from '../logger';

/**
 * Redis-Client (Cache/Session/Matchmaking). Lazy-Connect, damit das Backend
 * in Phase 1 auch ohne laufendes Redis startbar/testbar bleibt. Erst Phase 3
 * (Matchmaking) ist zwingend auf Redis angewiesen.
 */
let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on('error', (err) => {
    logger.warn('Redis-Fehler', { error: err.message });
  });
  client.on('connect', () => logger.info('Redis verbunden'));
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const r = getRedis();
    if (r.status === 'wait' || r.status === 'end') {
      await r.connect();
    }
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
