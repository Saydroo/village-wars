import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from './httpError';

export interface AccessTokenPayload {
  sub: string; // player id
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string; // player id
  type: 'refresh';
}

export function signAccessToken(playerId: string): string {
  const payload: AccessTokenPayload = { sub: playerId, type: 'access' };
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(playerId: string): string {
  const payload: RefreshTokenPayload = { sub: playerId, type: 'refresh' };
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function issueTokens(playerId: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken(playerId),
    refreshToken: signRefreshToken(playerId),
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') throw new Error('falscher Token-Typ');
    return decoded;
  } catch {
    throw unauthorized('Ungültiges oder abgelaufenes Access-Token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') throw new Error('falscher Token-Typ');
    return decoded;
  } catch {
    throw unauthorized('Ungültiges oder abgelaufenes Refresh-Token');
  }
}
