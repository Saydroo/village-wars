import { io, type Socket } from 'socket.io-client';
import type {
  BattleEndedPayload,
  BattleSetupPayload,
  BattleStateUpdate,
  ClanChatMessage,
  DeployUnitPayload,
  MatchmakingMatchedPayload,
} from '@village-wars/shared';
import { getAccessToken, resolveBaseUrl } from './client';

/**
 * Socket.io-Client-Wrapper (Phase 3). Hält eine einzige Verbindung, die mit dem
 * JWT-Access-Token authentifiziert wird. Event-Vertrag gemäß Abschnitt 8.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token: getAccessToken() };
    socket.connect();
    return socket;
  }
  socket = io(resolveBaseUrl(), {
    transports: ['websocket'],
    autoConnect: true,
    auth: { token: getAccessToken() },
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Stellt die Socket-Verbindung her (Präsenz), ohne Matchmaking zu starten. Solange
 * der Spieler eingeloggt/im Dorf ist, ist er dadurch als Verteidiger matchbar
 * („nur Online-Spieler kämpfen"). Idempotent.
 */
export function connectPresence(): void {
  getSocket();
}

// --- Client -> Server ---
export function emitMatchmakingJoin(): void {
  getSocket().emit('matchmaking:join');
}
export function emitMatchmakingCancel(): void {
  getSocket().emit('matchmaking:cancel');
}
/** Startet ein Clan-Krieg-Duell (Gegner = feindliches Clan-Mitglied). */
export function emitClanWarJoin(): void {
  getSocket().emit('clanwar:join');
}
/** Fordert ein Clan-Mitglied zum Freundschaftskampf heraus (Roadmap P9, Übung). */
export function emitFriendlyChallenge(targetPlayerId: string): void {
  getSocket().emit('friendly:challenge', { target_player_id: targetPlayerId });
}
export function emitBattleStart(battleId: string): void {
  getSocket().emit('battle:start', { battle_id: battleId });
}
export function emitDeployUnit(payload: DeployUnitPayload): void {
  getSocket().emit('battle:deploy_unit', payload);
}
export function emitSurrender(): void {
  getSocket().emit('battle:surrender');
}

// --- Server -> Client (typisierte Helfer) ---
export interface BattleSocketHandlers {
  onSearching?: (p: { trophies: number }) => void;
  onMatched?: (p: MatchmakingMatchedPayload) => void;
  onSetup?: (p: BattleSetupPayload) => void;
  onStateUpdate?: (p: BattleStateUpdate) => void;
  onEnded?: (p: BattleEndedPayload) => void;
  onError?: (p: { message: string }) => void;
  onCancelled?: () => void;
}

/**
 * Registriert einen Live-Listener für eingehende Clan-Chat-Nachrichten (Roadmap P9).
 * Der Server pusht `clanchat:message` an alle online verbundenen Clan-Mitglieder.
 * Gibt eine Cleanup-Funktion zurück.
 */
export function bindClanChatHandler(onMessage: (m: ClanChatMessage) => void): () => void {
  const s = getSocket();
  const fn = (m: ClanChatMessage): void => onMessage(m);
  s.on('clanchat:message', fn as never);
  return () => s.off('clanchat:message', fn as never);
}

/** Registriert alle Battle-Handler; gibt eine Cleanup-Funktion zurück. */
export function bindBattleHandlers(h: BattleSocketHandlers): () => void {
  const s = getSocket();
  const map: Array<[string, (...args: never[]) => void]> = [];
  const add = (event: string, fn?: (...a: never[]) => void) => {
    if (!fn) return;
    s.on(event, fn as never);
    map.push([event, fn]);
  };
  add('matchmaking:searching', h.onSearching as never);
  add('matchmaking:matched', h.onMatched as never);
  add('matchmaking:cancelled', h.onCancelled as never);
  add('battle:setup', h.onSetup as never);
  add('battle:state_update', h.onStateUpdate as never);
  add('battle:ended', h.onEnded as never);
  add('battle:error', h.onError as never);
  return () => {
    for (const [event, fn] of map) s.off(event, fn as never);
  };
}
