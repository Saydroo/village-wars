import type { PoolClient } from 'pg';
import type {
  AuthResponse,
  AuthProvider,
  FactionId,
  Player,
  RegisterInput,
  LoginInput,
  OAuthInput,
} from '@village-wars/shared';
import { query, withTransaction } from '../db/pool';
import { hashPassword, verifyPassword } from '../utils/password';
import { issueTokens } from '../utils/jwt';
import { badRequest, conflict, unauthorized } from '../utils/httpError';
import { mapPlayer, PLAYER_COLUMNS } from './mappers';
import { bootstrapNewPlayerVillage } from './villageService';
import { verifyGoogleToken } from './oauth/google';
import { verifyAppleToken, type OAuthIdentity } from './oauth/apple';

interface CreatePlayerArgs {
  username: string;
  email: string | null;
  passwordHash: string | null;
  authProvider: AuthProvider;
  authProviderId: string | null;
  faction: FactionId;
}

/** Erstellt Spieler + Dorf (Rathaus Lv.1) in einer Transaktion. */
async function createPlayer(args: CreatePlayerArgs): Promise<Player> {
  return withTransaction(async (client: PoolClient) => {
    const res = await client.query(
      `INSERT INTO players
         (username, email, password_hash, auth_provider, auth_provider_id, faction)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${PLAYER_COLUMNS}`,
      [
        args.username,
        args.email,
        args.passwordHash,
        args.authProvider,
        args.authProviderId,
        args.faction,
      ],
    );
    const player = mapPlayer(res.rows[0] as Record<string, unknown>);
    await bootstrapNewPlayerVillage(client, player.id);
    return player;
  });
}

async function assertUsernameFree(username: string): Promise<void> {
  const res = await query('SELECT 1 FROM players WHERE lower(username) = lower($1)', [username]);
  if (res.rows.length > 0) throw conflict('Benutzername ist bereits vergeben');
}

async function assertEmailFree(email: string): Promise<void> {
  const res = await query('SELECT 1 FROM players WHERE lower(email) = lower($1)', [email]);
  if (res.rows.length > 0) throw conflict('E-Mail ist bereits registriert');
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  await assertUsernameFree(input.username);
  await assertEmailFree(input.email);

  const passwordHash = await hashPassword(input.password);
  const player = await createPlayer({
    username: input.username,
    email: input.email,
    passwordHash,
    authProvider: 'email',
    authProviderId: null,
    faction: input.faction as FactionId,
  });

  return { player, tokens: issueTokens(player.id) };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  // auth_provider ist bereits Teil von PLAYER_COLUMNS; nur password_hash ergänzen.
  const res = await query(
    `SELECT ${PLAYER_COLUMNS}, password_hash
       FROM players
      WHERE lower(email) = lower($1) OR lower(username) = lower($1)`,
    [input.identifier],
  );
  const row = res.rows[0] as (Record<string, unknown> & { password_hash: string | null }) | undefined;
  if (!row || row.auth_provider !== 'email' || !row.password_hash) {
    throw unauthorized('Ungültige Anmeldedaten');
  }
  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) throw unauthorized('Ungültige Anmeldedaten');

  await query('UPDATE players SET last_active = NOW() WHERE id = $1', [row.id]);
  const player = mapPlayer(row);
  return { player, tokens: issueTokens(player.id) };
}

export type OAuthResult =
  | { kind: 'authenticated'; response: AuthResponse }
  | { kind: 'needs_profile'; provider: 'apple' | 'google'; email: string | null };

export async function oauthAuthenticate(
  provider: 'apple' | 'google',
  input: OAuthInput,
): Promise<OAuthResult> {
  const identity: OAuthIdentity =
    provider === 'google'
      ? await verifyGoogleToken(input.idToken)
      : await verifyAppleToken(input.idToken);

  // Bestehenden Account suchen
  const existing = await query(
    `SELECT ${PLAYER_COLUMNS} FROM players
      WHERE auth_provider = $1 AND auth_provider_id = $2`,
    [provider, identity.providerId],
  );
  const existingRow = existing.rows[0];
  if (existingRow) {
    await query('UPDATE players SET last_active = NOW() WHERE id = $1', [existingRow.id]);
    const player = mapPlayer(existingRow as Record<string, unknown>);
    return { kind: 'authenticated', response: { player, tokens: issueTokens(player.id) } };
  }

  // Neuer Account braucht username + faction
  if (!input.username || !input.faction) {
    return { kind: 'needs_profile', provider, email: identity.email };
  }

  await assertUsernameFree(input.username);
  const player = await createPlayer({
    username: input.username,
    email: identity.email,
    passwordHash: null,
    authProvider: provider,
    authProviderId: identity.providerId,
    faction: input.faction as FactionId,
  });
  return { kind: 'authenticated', response: { player, tokens: issueTokens(player.id) } };
}

export async function refresh(playerId: string): Promise<{ tokens: AuthResponse['tokens'] }> {
  const res = await query('SELECT 1 FROM players WHERE id = $1', [playerId]);
  if (res.rows.length === 0) throw badRequest('Spieler existiert nicht mehr');
  return { tokens: issueTokens(playerId) };
}
