import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import type { DeployUnitPayload } from '@village-wars/shared';
import { deployUnitSchema } from '@village-wars/shared';
import { env } from '../env';
import { logger } from '../logger';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';
import {
  joinQueue,
  leaveQueue,
  markAttackEnd,
  markAttackStart,
  setOnlineTrophies,
  setPlayerOffline,
  setPlayerOnline,
  type MatchOutcome,
} from '../services/matchmakingService';
import {
  deployIntoBattle,
  finalizeBattle,
  getActiveBattleId,
  prepareBattle,
  startBattleLoop,
  surrenderBattle,
} from '../services/battleService';
import {
  getWarContextForPlayer,
  pickEnemyDefender,
  type WarContext,
} from '../services/clanWarService';
import { getMembership } from '../services/clanService';

/**
 * Socket.io-Schicht (Phase 3). JWT-authentifizierter Echtzeit-Kanal für
 * Matchmaking und Kämpfe. Event-Verträge gemäß Abschnitt 8 des Briefings.
 *
 *   Client -> Server: matchmaking:join | matchmaking:cancel |
 *                     battle:start | battle:deploy_unit | battle:surrender
 *   Server -> Client: matchmaking:matched | battle:setup |
 *                     battle:state_update | battle:ended | battle:error
 */

interface SocketData {
  playerId: string;
  trophies: number;
}

let io: IOServer | null = null;

export function initSockets(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()) },
  });

  // JWT-Handshake: Token aus auth.token oder Authorization-Header.
  io.use((socket, next) => {
    try {
      const raw =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!raw) throw new Error('Token fehlt');
      const payload = verifyAccessToken(raw);
      (socket.data as SocketData).playerId = payload.sub;
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Auth fehlgeschlagen'));
    }
  });

  io.on('connection', onConnection);

  logger.info('Socket.io initialisiert (Matchmaking + Battle)');
  return io;
}

function onConnection(socket: Socket): void {
  const data = socket.data as SocketData;
  const playerId = data.playerId;

  // WICHTIG: Handler SYNCHRON registrieren, bevor irgendein await läuft — sonst
  // geht ein direkt nach dem Connect gepuffertes Client-Event (z.B.
  // matchmaking:join) verloren (Socket.io puffert eingehende Events nicht).
  data.trophies = 0;
  setPlayerOnline(playerId, 0);

  // Trophäen asynchron nachladen (Matchmaking-Toleranz nutzt sie).
  void query('SELECT trophies FROM players WHERE id = $1', [playerId])
    .then((pr) => {
      const t = pr.rows[0] ? Number((pr.rows[0] as { trophies: number }).trophies) : 0;
      data.trophies = t;
      setOnlineTrophies(playerId, t);
    })
    .catch(() => undefined);

  // Clan-Room beitreten (Live-Chat-Broadcast, Roadmap P9). Room-Name inline
  // gehalten, damit kein Rück-Import auf clanChatService nötig ist (Zyklus-frei).
  void getMembership(playerId)
    .then((m) => {
      if (m) void socket.join(`clan:${m.clanId}`);
    })
    .catch(() => undefined);

  logger.info('Socket verbunden', { playerId, socketId: socket.id });

  socket.on('matchmaking:join', () => {
    if (getActiveBattleId(playerId)) {
      socket.emit('battle:error', { message: 'Es läuft bereits ein Kampf' });
      return;
    }
    markAttackStart(playerId);
    joinQueue(playerId, data.trophies, (outcome) => void onMatched(socket, playerId, outcome));
    socket.emit('matchmaking:searching', { trophies: data.trophies });
  });

  socket.on('matchmaking:cancel', () => {
    leaveQueue(playerId);
    markAttackEnd(playerId);
    socket.emit('matchmaking:cancelled', {});
  });

  socket.on('clanwar:join', () => {
    if (getActiveBattleId(playerId)) {
      socket.emit('battle:error', { message: 'Es läuft bereits ein Kampf' });
      return;
    }
    void startClanWarBattle(socket, playerId);
  });

  socket.on('friendly:challenge', (payload: { target_player_id?: string } = {}) => {
    if (getActiveBattleId(playerId)) {
      socket.emit('battle:error', { message: 'Es läuft bereits ein Kampf' });
      return;
    }
    void startFriendlyBattle(socket, playerId, payload.target_player_id);
  });

  socket.on('battle:start', (payload: { battle_id?: string } = {}) => {
    const battleId = payload.battle_id ?? getActiveBattleId(playerId);
    if (battleId) startBattleLoop(battleId);
  });

  socket.on('battle:deploy_unit', (payload: DeployUnitPayload) => {
    const battleId = getActiveBattleId(playerId);
    if (!battleId) {
      socket.emit('battle:error', { message: 'Kein aktiver Kampf' });
      return;
    }
    const parsed = deployUnitSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('battle:error', { message: 'Ungültige Deploy-Daten' });
      return;
    }
    const res = deployIntoBattle(battleId, parsed.data);
    if (!res.ok) socket.emit('battle:error', { message: res.reason ?? 'Deploy fehlgeschlagen' });
  });

  socket.on('battle:surrender', () => {
    const battleId = getActiveBattleId(playerId);
    if (battleId) surrenderBattle(battleId);
  });

  socket.on('disconnect', () => {
    leaveQueue(playerId);
    setPlayerOffline(playerId);
    // Laufenden Kampf des Angreifers beenden (zählt als Aufgabe).
    const battleId = getActiveBattleId(playerId);
    if (battleId) {
      surrenderBattle(battleId);
      void finalizeBattle(battleId);
    }
    logger.info('Socket getrennt', { playerId, socketId: socket.id });
  });
}

/** Bereitet einen Clan-Krieg-Angriff vor (Gegner = zufälliges feindliches Mitglied). */
async function startClanWarBattle(socket: Socket, playerId: string): Promise<void> {
  try {
    const ctx = await getWarContextForPlayer(playerId);
    if (!ctx) {
      socket.emit('battle:error', { message: 'Kein laufender Clan-Krieg' });
      return;
    }
    const defenderId = await pickEnemyDefender(ctx.warId, playerId);
    if (!defenderId) {
      socket.emit('battle:error', { message: 'Kein angreifbares Mitglied im feindlichen Clan' });
      return;
    }
    markAttackStart(playerId);
    await onMatched(socket, playerId, { defenderId, isBot: false }, ctx);
  } catch (err) {
    markAttackEnd(playerId);
    socket.emit('battle:error', {
      message: err instanceof Error ? err.message : 'Clan-Krieg-Start fehlgeschlagen',
    });
  }
}

/**
 * Bereitet einen Freundschaftskampf vor (Roadmap P9): Übungskampf gegen das echte
 * Layout eines Clan-Kameraden — kein Loot/Trophäen/Verbrauch. Ziel muss im selben
 * Clan sein (nicht man selbst).
 */
async function startFriendlyBattle(
  socket: Socket,
  playerId: string,
  targetId?: string,
): Promise<void> {
  try {
    if (!targetId || targetId === playerId) {
      socket.emit('battle:error', { message: 'Ungültiges Ziel für den Übungskampf' });
      return;
    }
    const [mine, theirs] = await Promise.all([getMembership(playerId), getMembership(targetId)]);
    if (!mine || !theirs || mine.clanId !== theirs.clanId) {
      socket.emit('battle:error', { message: 'Nur gegen Mitglieder deines Clans' });
      return;
    }
    markAttackStart(playerId);
    await onMatched(socket, playerId, { defenderId: targetId, isBot: false }, null, true);
  } catch (err) {
    markAttackEnd(playerId);
    socket.emit('battle:error', {
      message: err instanceof Error ? err.message : 'Übungskampf-Start fehlgeschlagen',
    });
  }
}

async function onMatched(
  socket: Socket,
  playerId: string,
  outcome: MatchOutcome,
  warContext: WarContext | null = null,
  friendly = false,
): Promise<void> {
  try {
    // Deferred emit: Raum-ID steht erst nach prepareBattle fest.
    let battleIdRef = '';
    const emit = (event: string, p: unknown) => io?.to(battleIdRef).emit(event, p);

    const prepared = await prepareBattle(playerId, outcome, emit, warContext, friendly);
    battleIdRef = prepared.battleId;
    await socket.join(prepared.battleId);

    socket.emit('matchmaking:matched', {
      battle_id: prepared.battleId,
      defender_username: prepared.setup.defender_username,
      defender_faction: prepared.setup.defender_faction,
      is_bot: prepared.setup.is_bot,
      mode: warContext ? 'clan_war' : friendly ? 'friendly' : 'solo',
    });
    socket.emit('battle:setup', prepared.setup);
  } catch (err) {
    markAttackEnd(playerId);
    socket.emit('battle:error', {
      message: err instanceof Error ? err.message : 'Matchmaking fehlgeschlagen',
    });
  }
}

export function getIO(): IOServer | null {
  return io;
}
