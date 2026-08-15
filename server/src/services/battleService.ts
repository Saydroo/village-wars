import { randomUUID } from 'node:crypto';
import type {
  BattleSetupPayload,
  BattleState,
  DefenderBuildingInput,
  FactionId,
} from '@village-wars/shared';
import {
  computeLoot,
  computeTrophyDelta,
  defenderTrophyDelta,
  deployUnit,
  isDeployBlocked,
  heroCombatStats,
  initBattleState,
  resourceCap,
  stepBattle,
  toStateUpdate,
  type OwnedBuilding,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { getGameConfig } from '../gameConfig';
import { loadUnitLevels } from './researchService';
import { incrementQuestProgress } from './questService';
import { setHeroRegenAfterBattle, loadHeroForBattle } from './heroService';
import { addSeasonPassXp } from './seasonPassService';
import { logger } from '../logger';
import { notFound } from '../utils/httpError';
import { mapBattle, BATTLE_COLUMNS } from './mappers';
import { getReadyArmyMap, consumeUnits } from './unitService';
import { settlePlayerResources } from './resourceService';
import { markAttackEnd, setOnlineTrophies } from './matchmakingService';
import { recordClanWarAttack, type WarContext } from './clanWarService';

/**
 * Battle-Server (Phase 3). Hält aktive Kämpfe im Speicher, simuliert sie
 * server-autoritativ im Tick-Loop und überträgt den Zustand via Callback
 * (Socket.io). Bei Abschluss werden Loot, Trophäen und die battles-Zeile
 * persistiert. Alle Kampf-Zahlen kommen aus der Engine in @village-wars/shared
 * (gespeist aus game-config.json).
 */

type Emit = (event: string, payload: unknown) => void;

interface PlayerCombatProfile {
  faction: FactionId;
  trophies: number;
  wood: number;
  stone: number;
  buildings: DefenderBuildingInput[];
  grid_width: number;
  grid_height: number;
  username: string;
}

interface BattleSession {
  state: BattleState;
  attackerId: string;
  attackerTrophies: number;
  defenderId: string | null;
  defenderTrophies: number;
  defenderWood: number;
  defenderStone: number;
  isBot: boolean;
  initialArmy: Record<string, number>;
  /** Anfänglich stationierte Clan-Burg-Verteidiger (unit_type -> Anzahl). */
  initialDefenders: Record<string, number>;
  defenderUsername: string;
  defenderFaction: FactionId;
  gridWidth: number;
  gridHeight: number;
  interval: ReturnType<typeof setInterval> | null;
  emit: Emit;
  finalizing: boolean;
  /** Gesetzt bei Clan-Krieg-Duellen (sonst null = Solo). */
  warContext: WarContext | null;
  /** Freundschaftskampf (Roadmap P9): reine Übung — kein Loot/Trophäen/Verbrauch/Persistenz. */
  friendly: boolean;
  /** Deploy-Schlüssel des einsatzbereiten Helden (Roadmap P6), sonst null. */
  heroUnitType: string | null;
}

const sessions = new Map<string, BattleSession>();
/** Schneller Lookup: aktuelle Battle-ID je Angreifer (1 aktiver Kampf pro Spieler). */
const attackerBattle = new Map<string, string>();

async function loadCombatProfile(playerId: string): Promise<PlayerCombatProfile | null> {
  // Produktion vor dem Snapshot verrechnen (loot basiert auf aktuellem Stand).
  await settlePlayerResources(playerId).catch(() => undefined);

  const pr = await query(
    `SELECT p.faction, p.trophies, p.wood, p.stone, p.username, v.grid_width, v.grid_height
       FROM players p JOIN villages v ON v.player_id = p.id WHERE p.id = $1`,
    [playerId],
  );
  const p = pr.rows[0] as
    | {
        faction: FactionId;
        trophies: number;
        wood: string;
        stone: string;
        username: string;
        grid_width: number;
        grid_height: number;
      }
    | undefined;
  if (!p) return null;

  const br = await query(
    `SELECT id, building_type, level, grid_x, grid_y FROM buildings WHERE player_id = $1`,
    [playerId],
  );
  return {
    faction: p.faction,
    trophies: Number(p.trophies),
    wood: Number(p.wood),
    stone: Number(p.stone),
    username: p.username,
    grid_width: Number(p.grid_width),
    grid_height: Number(p.grid_height),
    buildings: br.rows.map((r) => ({
      id: r.id as string,
      building_type: r.building_type as string,
      level: Number(r.level),
      grid_x: Number(r.grid_x),
      grid_y: Number(r.grid_y),
    })),
  };
}

/** Aus der Clan-Burg eines Spielers stationierte Verteidiger (unit_type -> Anzahl). */
async function loadCastleDefenders(playerId: string): Promise<Record<string, number>> {
  const res = await query(
    `SELECT unit_type, quantity FROM clan_castle_defenders WHERE player_id = $1 AND quantity > 0`,
    [playerId],
  );
  const out: Record<string, number> = {};
  for (const r of res.rows as Array<{ unit_type: string; quantity: number }>) {
    out[r.unit_type as string] = Number(r.quantity);
  }
  return out;
}

/** Synthetisches Bot-Dorf, falls (noch) kein anderer Spieler existiert. */
function defaultBotProfile(gridW = 30, gridH = 30): PlayerCombatProfile {
  const cx = Math.floor(gridW / 2);
  const cy = Math.floor(gridH / 2);
  const mk = (t: string, lvl: number, dx: number, dy: number): DefenderBuildingInput => ({
    id: `bot-${t}-${dx}-${dy}`,
    building_type: t,
    level: lvl,
    grid_x: cx + dx,
    grid_y: cy + dy,
  });
  return {
    faction: 'humans',
    trophies: 0,
    wood: 1000,
    stone: 800,
    username: 'Übungsdorf (Bot)',
    grid_width: gridW,
    grid_height: gridH,
    buildings: [
      mk('town_hall', 3, 0, 0),
      mk('watchtower', 2, 2, 0),
      mk('watchtower', 2, -2, 0),
      mk('lumber_camp', 3, 0, 2),
      mk('quarry', 3, 0, -2),
      mk('wall', 2, 1, 1),
      mk('wall', 2, -1, -1),
    ],
  };
}

export interface PreparedBattle {
  battleId: string;
  setup: BattleSetupPayload;
}

/**
 * Erstellt eine Kampf-Session (Verteidiger = echter Spieler oder Bot) und liefert
 * das Setup für den Client. Startet noch nicht den Tick-Loop (das passiert beim
 * Socket-Join / battle:start).
 */
export async function prepareBattle(
  attackerId: string,
  outcome: { defenderId: string | null; isBot: boolean },
  emit: Emit,
  warContext: WarContext | null = null,
  friendly = false,
): Promise<PreparedBattle> {
  const config = getGameConfig();

  const attacker = await loadCombatProfile(attackerId);
  if (!attacker) throw notFound('Angreifer nicht gefunden');

  let defenderId = outcome.defenderId;
  let isBot = outcome.isBot;
  let defender: PlayerCombatProfile | null = null;

  if (!isBot && defenderId) {
    defender = await loadCombatProfile(defenderId);
    if (!defender) {
      isBot = true;
      defenderId = null;
    }
  }
  if (isBot) {
    // Bot: zufälliges echtes Dorf als Layout, sonst synthetisches Standard-Dorf.
    const rnd = await query(
      `SELECT id FROM players WHERE id <> $1 ORDER BY random() LIMIT 1`,
      [attackerId],
    );
    const src = rnd.rows[0] as { id: string } | undefined;
    defender = src ? await loadCombatProfile(src.id) : null;
    defender = defender ?? defaultBotProfile();
    defenderId = null; // Bot: kein echter Verteidiger wird bestraft/beloht
  }
  if (!defender) defender = defaultBotProfile();

  const army = await getReadyArmyMap(attackerId);
  // Clan-Burg-Verteidiger nur für echte (nicht-Bot) Verteidiger — Verluste werden
  // bei diesem Spieler abgezogen, was bei einem Bot ohne Einwilligung falsch wäre.
  const defenderUnits = !isBot && defenderId ? await loadCastleDefenders(defenderId) : {};
  // Truppen-Level des Angreifers (Roadmap P3: HP/DPS-Bonus aus Forschungslabor).
  const attackerUnitLevels = await loadUnitLevels(attackerId);
  // Einsatzbereiter Held des Angreifers (Roadmap P6): nur wenn nicht in Regen/Leveling
  // und Held freigeschaltet. Kämpft als zusätzliche, nicht verbrauchbare Einheit.
  const heroInfo = await loadHeroForBattle(attackerId);
  const hero = heroInfo ? heroCombatStats(config, attacker.faction, heroInfo.level) : null;

  const battleId = randomUUID();
  const state = initBattleState(config, {
    battleId,
    attackerId,
    attackerFaction: attacker.faction,
    defenderId,
    defenderFaction: defender.faction,
    isBot,
    defenderBuildings: defender.buildings,
    army,
    defenderUnits,
    attackerUnitLevels,
    hero,
  });

  const session: BattleSession = {
    state,
    attackerId,
    attackerTrophies: attacker.trophies,
    defenderId,
    defenderTrophies: defender.trophies,
    defenderWood: defender.wood,
    defenderStone: defender.stone,
    isBot,
    initialArmy: { ...army },
    initialDefenders: { ...defenderUnits },
    defenderUsername: defender.username,
    defenderFaction: defender.faction,
    gridWidth: defender.grid_width,
    gridHeight: defender.grid_height,
    interval: null,
    emit,
    finalizing: false,
    warContext,
    friendly,
    heroUnitType: hero ? hero.unit_type : null,
  };
  sessions.set(battleId, session);
  attackerBattle.set(attackerId, battleId);

  // Quest-Fortschritt: 1 Angriff gestartet.
  incrementQuestProgress(attackerId, 'attacks').catch(() => {});

  return {
    battleId,
    setup: {
      battle_id: battleId,
      defender_username: defender.username,
      defender_faction: defender.faction,
      is_bot: isBot,
      grid_width: defender.grid_width,
      grid_height: defender.grid_height,
      buildings: state.buildings,
      // Held als zusätzliche deploybare Einheit für die DeployBar (Anzeigename via setup.hero).
      army: hero ? { ...army, [hero.unit_type]: 1 } : army,
      hero,
      duration_seconds: state.duration_seconds,
    },
  };
}

export function getSession(battleId: string): BattleSession | undefined {
  return sessions.get(battleId);
}

export function getActiveBattleId(attackerId: string): string | undefined {
  return attackerBattle.get(attackerId);
}

/** Startet den server-autoritativen Tick-Loop für eine Session. */
export function startBattleLoop(battleId: string): void {
  const session = sessions.get(battleId);
  if (!session || session.interval) return;
  const config = getGameConfig();
  const dt = 1 / config.combat.tick_rate_per_second;
  const intervalMs = Math.round(1000 / config.combat.tick_rate_per_second);

  session.interval = setInterval(() => {
    try {
      stepBattle(config, session.state, dt);
      session.emit('battle:state_update', toStateUpdate(session.state));
      if (session.state.finished) {
        void finalizeBattle(battleId);
      }
    } catch (err) {
      logger.error('Battle-Tick fehlgeschlagen', {
        battleId,
        error: err instanceof Error ? err.message : String(err),
      });
      void finalizeBattle(battleId);
    }
  }, intervalMs);
}

/** Setzt eine Einheit aufs Feld (innerhalb der Grid-Grenzen, außerhalb der Sperrzone). */
export function deployIntoBattle(
  battleId: string,
  input: { unit_type: string; x: number; y: number },
): { ok: boolean; reason?: string } {
  const session = sessions.get(battleId);
  if (!session) return { ok: false, reason: 'Kampf nicht gefunden' };
  if (input.x < 0 || input.y < 0 || input.x >= session.gridWidth || input.y >= session.gridHeight) {
    return { ok: false, reason: 'Position außerhalb des Dorfes' };
  }
  // Deploy-Sperrzone (server-autoritativ, nicht umgehbar): der per Flood-Fill
  // bestimmte Innenraum (hinter dem geschlossenen Mauerring) UND ein kleiner
  // Radius um freistehende Außen-Gebäude sind gesperrt. Direkt neben Mauern von
  // AUSSEN deployen bleibt möglich. Dieselbe geteilte Regel zeichnet der Client.
  if (isDeployBlocked(session.state.buildings, input.x, input.y, session.gridWidth, session.gridHeight)) {
    return { ok: false, reason: 'Im Basis-Inneren oder zu nah an einem Gebäude' };
  }
  const config = getGameConfig();
  const res = deployUnit(config, session.state, input);
  return { ok: res.ok, reason: res.reason };
}

/** Aufgabe durch den Angreifer (zählt als Verteidiger-Sieg). */
export function surrenderBattle(battleId: string): void {
  const session = sessions.get(battleId);
  if (!session || session.state.finished) return;
  session.state.finished = true;
  session.state.result = 'defender_win';
  void finalizeBattle(battleId);
}

function consumedUnits(session: BattleSession): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, initial] of Object.entries(session.initialArmy)) {
    const left = session.state.reserve[type] ?? 0;
    const used = initial - left;
    if (used > 0) out[type] = used;
  }
  return out;
}

/** Im Kampf gefallene Verteidiger je Typ (Anfangsbestand − überlebende Einheiten). */
function fallenDefenders(session: BattleSession): Record<string, number> {
  const survivors: Record<string, number> = {};
  for (const d of session.state.defenders) {
    if (d.alive) survivors[d.unit_type] = (survivors[d.unit_type] ?? 0) + 1;
  }
  const fallen: Record<string, number> = {};
  for (const [type, initial] of Object.entries(session.initialDefenders)) {
    const dead = initial - (survivors[type] ?? 0);
    if (dead > 0) fallen[type] = dead;
  }
  return fallen;
}

/** Zieht gefallene Verteidiger aus der Clan-Burg des Verteidigers ab. */
async function persistDefenderLosses(
  defenderId: string,
  fallen: Record<string, number>,
): Promise<void> {
  await withTransaction(async (client) => {
    for (const [type, qty] of Object.entries(fallen)) {
      if (qty <= 0) continue;
      await client.query(
        `UPDATE clan_castle_defenders SET quantity = GREATEST(0, quantity - $1)
           WHERE player_id = $2 AND unit_type = $3`,
        [qty, defenderId, type],
      );
    }
    await client.query(
      `DELETE FROM clan_castle_defenders WHERE player_id = $1 AND quantity <= 0`,
      [defenderId],
    );
  });
}

/** Schließt einen Kampf ab: Loot/Trophäen, Persistenz, ended-Event, Cleanup. */
export async function finalizeBattle(battleId: string): Promise<void> {
  const session = sessions.get(battleId);
  if (!session || session.finalizing) return;
  session.finalizing = true;

  if (session.interval) {
    clearInterval(session.interval);
    session.interval = null;
  }

  const config = getGameConfig();
  const st = session.state;
  if (!st.finished) {
    st.finished = true;
    st.result = st.result ?? 'defender_win';
  }
  const result = st.result ?? 'defender_win';
  const isWar = session.warContext !== null;
  // Freundschaftskampf (Roadmap P9): reine Übung — keine Trophäen, kein Loot, kein
  // Truppen-Verbrauch, keine Verteidiger-Verluste, keine Persistenz, kein XP/Regen.
  const isFriendly = session.friendly;

  // Im Clan-Krieg zählt nur die Zerstörung (Kriegspunkte) — keine Solo-Trophäen,
  // kein Ressourcen-Loot (getrennter Wettbewerb, Abschnitt 10/11). Friendly = 0.
  const attackerDelta =
    isWar || isFriendly
      ? 0
      : computeTrophyDelta(config, result, session.attackerTrophies, session.defenderTrophies);
  const loot =
    !isWar && !isFriendly && result === 'attacker_win'
      ? computeLoot(config, session.defenderWood, session.defenderStone)
      : { wood: 0, stone: 0 };
  const consumed = isFriendly ? {} : consumedUnits(session);

  try {
    if (isFriendly) {
      // reine Übung: nichts persistieren (kein battles-Eintrag, kein Loot/Trophäen).
    } else if (isWar) {
      await persistWarOutcome(session, result, consumed);
    } else {
      await persistOutcome(session, result, attackerDelta, loot, consumed);
    }
  } catch (err) {
    logger.error('Battle-Persistenz fehlgeschlagen', {
      battleId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Gefallene Clan-Burg-Verteidiger abziehen (echter Verteidiger, Solo & Krieg; NICHT Friendly).
  if (!isFriendly && session.defenderId && Object.keys(session.initialDefenders).length > 0) {
    const fallen = fallenDefenders(session);
    if (Object.keys(fallen).length > 0) {
      await persistDefenderLosses(session.defenderId, fallen).catch((err) =>
        logger.error('Verteidiger-Verlust-Persistenz fehlgeschlagen', {
          battleId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  session.emit('battle:ended', {
    result,
    destruction_pct: st.destruction_pct,
    loot,
    trophies_change: attackerDelta,
    mode: isWar ? 'clan_war' : isFriendly ? 'friendly' : 'solo',
  });

  markAttackEnd(session.attackerId);
  attackerBattle.delete(session.attackerId);
  sessions.delete(battleId);

  // Held nach Kampf regenerieren — aber NUR, wenn er auch eingesetzt wurde
  // (fire-and-forget). Sonst würde ein Angriff ohne Helden-Einsatz unnötig die
  // Regeneration auslösen (bzw. für Spieler ohne Helden eine Helden-Zeile anlegen).
  // Im Freundschaftskampf regeneriert der Held NICHT (reine Übung, kein Cooldown).
  const heroDeployed =
    !isFriendly &&
    session.heroUnitType !== null &&
    session.state.units.some((u) => u.unit_type === session.heroUnitType);
  if (heroDeployed) {
    setHeroRegenAfterBattle(session.attackerId).catch(() => {});
  }

  // Season-Pass-XP für einen gewonnenen Solo-Angriff (Roadmap P7, fire-and-forget).
  // Clan-Krieg + Freundschaftskampf zählen bewusst nicht (keine Solo-Belohnungen).
  if (!isWar && !isFriendly && result === 'attacker_win') {
    addSeasonPassXp(session.attackerId, 'battle_win').catch(() => {});
  }
}

async function persistOutcome(
  session: BattleSession,
  result: BattleState['result'],
  attackerDelta: number,
  loot: { wood: number; stone: number },
  consumed: Record<string, number>,
): Promise<void> {
  const config = getGameConfig();

  // Loot-Cap des Angreifers berechnen (Abschnitt 4: 3x Lagerkapazität).
  const ar = await query(
    `SELECT building_type, level FROM buildings WHERE player_id = $1`,
    [session.attackerId],
  );
  const attackerBuildings: OwnedBuilding[] = ar.rows.map((r) => ({
    building_type: r.building_type as string,
    level: Number(r.level),
  }));
  const capWood = resourceCap(config, attackerBuildings, 'wood');
  const capStone = resourceCap(config, attackerBuildings, 'stone');

  let defenderDelta = 0;
  await withTransaction(async (client) => {
    // Angreifer: Trophäen (>= 0) + Loot (gedeckelt).
    await client.query(
      `UPDATE players
          SET trophies = GREATEST(0, trophies + $1),
              wood = LEAST(wood + $2, $3),
              stone = LEAST(stone + $4, $5)
        WHERE id = $6`,
      [attackerDelta, loot.wood, capWood, loot.stone, capStone, session.attackerId],
    );

    // Verteidiger (nur echter Spieler): Trophäen-Gegendelta + Loot-Abzug.
    if (session.defenderId) {
      defenderDelta = defenderTrophyDelta(attackerDelta, session.defenderTrophies);
      await client.query(
        `UPDATE players
            SET trophies = GREATEST(0, trophies + $1),
                wood = GREATEST(0, wood - $2),
                stone = GREATEST(0, stone - $3)
          WHERE id = $4`,
        [defenderDelta, loot.wood, loot.stone, session.defenderId],
      );
    }

    // battles-Zeile.
    await client.query(
      `INSERT INTO battles
         (id, attacker_id, defender_id, mode, result,
          attacker_destruction_pct, defender_destruction_pct,
          loot_wood, loot_stone, trophies_change, duration_seconds,
          is_bot_defender, replay, finished_at)
       VALUES ($1, $2, $3, 'solo', $4, $5, 0, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        session.state.battle_id,
        session.attackerId,
        session.defenderId,
        result,
        session.state.destruction_pct,
        loot.wood,
        loot.stone,
        attackerDelta,
        Math.round(session.state.elapsed_seconds),
        session.isBot,
        JSON.stringify({
          army: session.initialArmy,
          consumed,
          defender_username: session.defenderUsername,
          defender_faction: session.defenderFaction,
        }),
      ],
    );

    // Solo-Rangliste fortschreiben.
    await client.query(
      `INSERT INTO leaderboard_solo (player_id, trophies)
         SELECT id, trophies FROM players WHERE id = $1
       ON CONFLICT (player_id) DO UPDATE SET trophies = EXCLUDED.trophies, updated_at = NOW()`,
      [session.attackerId],
    );
    if (session.defenderId) {
      await client.query(
        `INSERT INTO leaderboard_solo (player_id, trophies)
           SELECT id, trophies FROM players WHERE id = $1
         ON CONFLICT (player_id) DO UPDATE SET trophies = EXCLUDED.trophies, updated_at = NOW()`,
        [session.defenderId],
      );
    }
  });

  // Online-Trophäen für künftiges Matchmaking aktualisieren (sonst bleiben sie auf
  // dem Stand vom Verbindungszeitpunkt und driften über die Session hinweg).
  setOnlineTrophies(session.attackerId, Math.max(0, session.attackerTrophies + attackerDelta));
  if (session.defenderId) {
    setOnlineTrophies(session.defenderId, Math.max(0, session.defenderTrophies + defenderDelta));
  }

  // Verbrauchte Einheiten von der Armee abziehen.
  if (Object.keys(consumed).length > 0) {
    await consumeUnits(session.attackerId, consumed);
  }
}

/**
 * Persistenz eines Clan-Krieg-Duells: Zerstörung als Kriegspunkte verbuchen,
 * battles-Zeile (mode=clan_war, clan_war_id) schreiben, Einheiten verbrauchen.
 * Keine Solo-Trophäen/Loot (siehe finalizeBattle).
 */
async function persistWarOutcome(
  session: BattleSession,
  result: BattleState['result'],
  consumed: Record<string, number>,
): Promise<void> {
  const ctx = session.warContext;
  if (!ctx) return;

  // Erzielte Zerstörung als Kriegspunkte für den Angreifer-Clan.
  await recordClanWarAttack(ctx.warId, ctx.attackerClanId, session.state.destruction_pct);

  await query(
    `INSERT INTO battles
       (id, attacker_id, defender_id, mode, clan_war_id, result,
        attacker_destruction_pct, defender_destruction_pct,
        loot_wood, loot_stone, trophies_change, duration_seconds,
        is_bot_defender, replay, finished_at)
     VALUES ($1, $2, $3, 'clan_war', $4, $5, $6, 0, 0, 0, 0, $7, FALSE, $8, NOW())`,
    [
      session.state.battle_id,
      session.attackerId,
      session.defenderId,
      ctx.warId,
      result,
      session.state.destruction_pct,
      Math.round(session.state.elapsed_seconds),
      JSON.stringify({
        army: session.initialArmy,
        consumed,
        defender_username: session.defenderUsername,
        defender_faction: session.defenderFaction,
        clan_war_id: ctx.warId,
      }),
    ],
  );

  if (Object.keys(consumed).length > 0) {
    await consumeUnits(session.attackerId, consumed);
  }
}

/** Kampf-Historie eines Spielers. */
export async function getBattleHistory(playerId: string, limit = 20) {
  const res = await query(
    `SELECT ${BATTLE_COLUMNS} FROM battles
       WHERE attacker_id = $1 OR defender_id = $1
       ORDER BY started_at DESC LIMIT $2`,
    [playerId, limit],
  );
  return res.rows.map((r) => mapBattle(r as Record<string, unknown>));
}
