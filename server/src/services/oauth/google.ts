import { OAuth2Client } from 'google-auth-library';
import { env } from '../../env';
import { badRequest, unauthorized } from '../../utils/httpError';

const client = new OAuth2Client();

export interface OAuthIdentity {
  providerId: string;
  email: string | null;
}

/** Verifiziert ein Google-Identity-Token und liefert die Identität. */
export async function verifyGoogleToken(idToken: string): Promise<OAuthIdentity> {
  if (env.GOOGLE_CLIENT_IDS.length === 0) {
    throw badRequest('Google-OAuth ist nicht konfiguriert (GOOGLE_CLIENT_ID fehlt)');
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error('kein sub im Token');
    return { providerId: payload.sub, email: payload.email ?? null };
  } catch {
    throw unauthorized('Google-Token konnte nicht verifiziert werden');
  }
}
