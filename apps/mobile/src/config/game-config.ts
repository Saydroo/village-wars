import type { GameConfig } from '@village-wars/shared';
import { fetchGameConfig } from '../api/client';

/**
 * Lädt die game-config.json EINMALIG vom Backend (GET /api/config) und cached
 * sie. Das Frontend hält dadurch keine eigenen Zahlenwerte vor — die Config
 * bleibt die einzige Quelle der Wahrheit.
 */
let cached: GameConfig | null = null;
let inflight: Promise<GameConfig> | null = null;

export async function loadGameConfig(force = false): Promise<GameConfig> {
  if (cached && !force) return cached;
  if (inflight && !force) return inflight;
  inflight = fetchGameConfig().then((cfg) => {
    cached = cfg;
    inflight = null;
    return cfg;
  });
  return inflight;
}

export function getCachedGameConfig(): GameConfig | null {
  return cached;
}
