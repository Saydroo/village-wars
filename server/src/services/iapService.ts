import type { IapPurchaseInput, IapPurchaseResponse } from '@village-wars/shared';
import { withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { logger } from '../logger';
import { badRequest, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';
import { verifyApple, verifyGoogle } from './iap/verify';

/**
 * In-App-Purchase-Service (Phase 5, Abschnitt 12). Verifiziert den Store-Beleg,
 * ordnet das Produkt einem Goldbarren-Paket aus der Config zu und schreibt die
 * Goldbarren idempotent gut (iap_transactions.transaction_id ist UNIQUE → kein
 * Doppel-Credit). Goldbarren sind die EINZIGE käufliche Währung; kein Pay-to-Win.
 */
export async function purchaseBars(
  playerId: string,
  input: IapPurchaseInput,
): Promise<IapPurchaseResponse> {
  const config = getGameConfig();
  const pkg = config.iap.packages.find((p) => p.product_id === input.product_id);
  if (!pkg) throw badRequest(`Unbekanntes Produkt: ${input.product_id}`);

  const verified =
    input.platform === 'apple'
      ? await verifyApple(input.receipt, input.product_id)
      : await verifyGoogle(input.receipt, input.product_id);

  // transaction_id aus dem Beleg hat Vorrang (verhindert clientseitiges Fälschen).
  const transactionId = verified.transactionId || input.transaction_id;
  if (!transactionId) throw badRequest('Beleg ohne Transaktions-ID');

  return withTransaction(async (client) => {
    // Idempotenz: bereits verbuchte Transaktion → keine erneute Gutschrift.
    const ins = await client.query(
      `INSERT INTO iap_transactions (player_id, platform, product_id, transaction_id, bars_credited)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (transaction_id) DO NOTHING
       RETURNING id`,
      [playerId, input.platform, input.product_id, transactionId, pkg.bars],
    );
    const alreadyProcessed = ins.rows.length === 0;

    if (!alreadyProcessed) {
      await client.query(`UPDATE players SET gold_bars = gold_bars + $1 WHERE id = $2`, [
        pkg.bars,
        playerId,
      ]);
      logger.info('Goldbarren via IAP gutgeschrieben', {
        playerId,
        product: input.product_id,
        bars: pkg.bars,
        platform: input.platform,
        sandbox: verified.sandbox,
      });
    }

    const pr = await client.query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [playerId]);
    const row = pr.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw notFound('Spieler nicht gefunden');

    return {
      player: mapPlayer(row),
      bars_credited: alreadyProcessed ? 0 : pkg.bars,
      product_id: input.product_id,
      already_processed: alreadyProcessed,
    };
  });
}
