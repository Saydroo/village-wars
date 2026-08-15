import type { FactionId, Player } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getFactionChangeCostBars } from '../gameConfig';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

export async function getPlayerById(playerId: string): Promise<Player> {
  const res = await query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [playerId]);
  const row = res.rows[0];
  if (!row) throw notFound('Spieler nicht gefunden');
  return mapPlayer(row as Record<string, unknown>);
}

/**
 * Ändert die Fraktion gegen Goldbarren (Kosten aus game-config.json,
 * faction_change.cost_bars). Kein Zahlenwert ist hier hartcodiert.
 */
export async function changeFaction(
  playerId: string,
  newFaction: FactionId,
): Promise<{ player: Player; cost_bars: number }> {
  const cost = getFactionChangeCostBars();

  return withTransaction(async (client) => {
    const cur = await client.query(
      'SELECT faction, gold_bars FROM players WHERE id = $1 FOR UPDATE',
      [playerId],
    );
    const row = cur.rows[0] as { faction: FactionId; gold_bars: number } | undefined;
    if (!row) throw notFound('Spieler nicht gefunden');

    if (row.faction === newFaction) {
      throw conflict('Diese Fraktion ist bereits aktiv');
    }
    if (Number(row.gold_bars) < cost) {
      throw badRequest(`Nicht genug Goldbarren (benötigt: ${cost})`);
    }

    const upd = await client.query(
      `UPDATE players
          SET faction = $1, gold_bars = gold_bars - $2
        WHERE id = $3
      RETURNING ${PLAYER_COLUMNS}`,
      [newFaction, cost, playerId],
    );
    return { player: mapPlayer(upd.rows[0] as Record<string, unknown>), cost_bars: cost };
  });
}
