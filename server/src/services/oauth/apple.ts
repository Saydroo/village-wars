import appleSignin from 'apple-signin-auth';
import { env } from '../../env';
import { badRequest, unauthorized } from '../../utils/httpError';
import type { OAuthIdentity } from './google';

/** Verifiziert ein Apple-Identity-Token und liefert die Identität. */
export async function verifyAppleToken(idToken: string): Promise<OAuthIdentity> {
  if (env.APPLE_CLIENT_IDS.length === 0) {
    throw badRequest('Apple-OAuth ist nicht konfiguriert (APPLE_CLIENT_ID fehlt)');
  }
  try {
    const payload = await appleSignin.verifyIdToken(idToken, {
      // audience akzeptiert string | string[]
      audience: env.APPLE_CLIENT_IDS.length === 1 ? env.APPLE_CLIENT_IDS[0] : env.APPLE_CLIENT_IDS,
      ignoreExpiration: false,
    });
    if (!payload.sub) throw new Error('kein sub im Token');
    return { providerId: payload.sub, email: payload.email ?? null };
  } catch {
    throw unauthorized('Apple-Token konnte nicht verifiziert werden');
  }
}

export type { OAuthIdentity };
