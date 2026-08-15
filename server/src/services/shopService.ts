import type { ShopActionResponse, ShopSkin, ShopSkinsResponse } from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { logger } from '../logger';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';

/**
 * Shop & Skins (Phase 5, Abschnitt 12/14). Skins sind REIN KOSMETISCH (kein
 * Pay-to-Win): sie verändern keine Kampf-/Wirtschaftswerte. Der Katalog lebt in
 * game-config.json (skins.catalog) und wird beim Start idempotent in die
 * skins-Tabelle geseedet. Kauf zieht Goldbarren ab; „Anwenden" markiert einen
 * Skin je Ziel als aktiv (nur einer pro Ziel).
 */

/** Seedet den Skin-Katalog aus der Config in die DB (idempotenter UPSERT). */
export async function seedSkinsFromConfig(): Promise<number> {
  const catalog = getGameConfig().skins.catalog ?? [];
  let n = 0;
  for (const s of catalog) {
    await query(
      `INSERT INTO skins (id, name, target_type, target_id, rarity, price_bars, preview_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, target_type = EXCLUDED.target_type, target_id = EXCLUDED.target_id,
         rarity = EXCLUDED.rarity, price_bars = EXCLUDED.price_bars, preview_data = EXCLUDED.preview_data`,
      [
        s.id,
        s.name,
        s.target_type,
        s.target_id,
        s.rarity,
        s.price_bars,
        s.preview_data ? JSON.stringify(s.preview_data) : null,
      ],
    );
    n += 1;
  }
  logger.info('Skin-Katalog geseedet', { count: n });
  return n;
}

function mapShopSkin(r: Record<string, unknown>): ShopSkin {
  return {
    id: r.id as string,
    name: r.name as string,
    target_type: r.target_type as ShopSkin['target_type'],
    target_id: r.target_id as string,
    rarity: r.rarity as ShopSkin['rarity'],
    price_bars: Number(r.price_bars),
    preview_data:
      r.preview_data === null || r.preview_data === undefined
        ? null
        : ((typeof r.preview_data === 'string' ? JSON.parse(r.preview_data) : r.preview_data) as Record<
            string,
            unknown
          >),
    owned: Boolean(r.owned),
    applied: Boolean(r.applied),
  };
}

async function loadShopSkins(playerId: string): Promise<ShopSkin[]> {
  const res = await query(
    `SELECT s.id, s.name, s.target_type, s.target_id, s.rarity, s.price_bars, s.preview_data,
            (ps.player_id IS NOT NULL) AS owned,
            COALESCE(ps.is_active, FALSE) AS applied
       FROM skins s
       LEFT JOIN player_skins ps ON ps.skin_id = s.id AND ps.player_id = $1
      ORDER BY s.target_type, s.price_bars, s.id`,
    [playerId],
  );
  return res.rows.map((r) => mapShopSkin(r as Record<string, unknown>));
}

async function goldBars(playerId: string): Promise<number> {
  const res = await query(`SELECT gold_bars FROM players WHERE id = $1`, [playerId]);
  const row = res.rows[0] as { gold_bars: number } | undefined;
  if (!row) throw notFound('Spieler nicht gefunden');
  return Number(row.gold_bars);
}

export async function listSkins(playerId: string): Promise<ShopSkinsResponse> {
  const [skins, bars] = await Promise.all([loadShopSkins(playerId), goldBars(playerId)]);
  return { skins, gold_bars: bars };
}

export async function buySkin(playerId: string, skinId: string): Promise<ShopActionResponse> {
  await withTransaction(async (client) => {
    const sk = await client.query(`SELECT price_bars FROM skins WHERE id = $1`, [skinId]);
    const skin = sk.rows[0] as { price_bars: number } | undefined;
    if (!skin) throw notFound('Skin nicht gefunden');

    const owned = await client.query(
      `SELECT 1 FROM player_skins WHERE player_id = $1 AND skin_id = $2`,
      [playerId, skinId],
    );
    if (owned.rows.length > 0) throw conflict('Skin bereits im Besitz');

    const pr = await client.query(`SELECT gold_bars FROM players WHERE id = $1 FOR UPDATE`, [playerId]);
    const p = pr.rows[0] as { gold_bars: number } | undefined;
    if (!p) throw notFound('Spieler nicht gefunden');
    const price = Number(skin.price_bars);
    if (Number(p.gold_bars) < price) {
      throw badRequest(`Nicht genug Goldbarren (benötigt: ${price})`);
    }

    await client.query(`UPDATE players SET gold_bars = gold_bars - $1 WHERE id = $2`, [price, playerId]);
    await client.query(
      `INSERT INTO player_skins (player_id, skin_id, is_active) VALUES ($1, $2, FALSE)`,
      [playerId, skinId],
    );
  });
  logger.info('Skin gekauft', { playerId, skinId });
  return buildActionResponse(playerId);
}

export async function applySkin(
  playerId: string,
  skinId: string,
  apply: boolean,
): Promise<ShopActionResponse> {
  await withTransaction(async (client) => {
    const sk = await client.query(`SELECT target_type, target_id FROM skins WHERE id = $1`, [skinId]);
    const skin = sk.rows[0] as { target_type: string; target_id: string } | undefined;
    if (!skin) throw notFound('Skin nicht gefunden');

    const owned = await client.query(
      `SELECT 1 FROM player_skins WHERE player_id = $1 AND skin_id = $2`,
      [playerId, skinId],
    );
    if (owned.rows.length === 0) throw badRequest('Skin nicht im Besitz');

    if (apply) {
      // Nur EIN Skin je Ziel (target_type+target_id) aktiv → andere desselben Ziels deaktivieren.
      await client.query(
        `UPDATE player_skins ps SET is_active = (ps.skin_id = $2)
           WHERE ps.player_id = $1
             AND ps.skin_id IN (SELECT id FROM skins WHERE target_type = $3 AND target_id = $4)`,
        [playerId, skinId, skin.target_type, skin.target_id],
      );
    } else {
      await client.query(
        `UPDATE player_skins SET is_active = FALSE WHERE player_id = $1 AND skin_id = $2`,
        [playerId, skinId],
      );
    }
  });
  return buildActionResponse(playerId);
}

async function buildActionResponse(playerId: string): Promise<ShopActionResponse> {
  const [skins, pr] = await Promise.all([
    loadShopSkins(playerId),
    query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [playerId]),
  ]);
  const player = mapPlayer(pr.rows[0] as Record<string, unknown>);
  return { skins, gold_bars: player.gold_bars, player };
}
