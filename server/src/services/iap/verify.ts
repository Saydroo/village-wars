import { env } from '../../env';
import { logger } from '../../logger';
import { badRequest } from '../../utils/httpError';

/**
 * Beleg-Verifizierung für In-App-Käufe (Phase 5, Abschnitt 12). Zwei Pfade:
 *  - Sandbox/Dev (IAP_ALLOW_SANDBOX): akzeptiert Belege der Form
 *    "sandbox:<product_id>:<transaction_id>" ohne externen Aufruf — für lokale
 *    Tests, da hier keine echten Apple/Google-Credentials vorliegen.
 *  - Produktiv: echte Belegprüfung gegen Apple/Google (siehe Hinweise unten).
 *    Ohne konfigurierte Credentials wird der Kauf bewusst abgelehnt (keine
 *    erfundene Gutschrift).
 */

export interface VerifiedReceipt {
  productId: string;
  transactionId: string;
  sandbox: boolean;
}

const SANDBOX_PREFIX = 'sandbox:';

/** Sandbox-Beleg: "sandbox:<product_id>:<transaction_id>". */
function parseSandbox(receipt: string): { productId: string; transactionId: string } | null {
  if (!receipt.startsWith(SANDBOX_PREFIX)) return null;
  const rest = receipt.slice(SANDBOX_PREFIX.length);
  const idx = rest.indexOf(':');
  if (idx <= 0) return null;
  const productId = rest.slice(0, idx);
  const transactionId = rest.slice(idx + 1);
  if (!productId || !transactionId) return null;
  return { productId, transactionId };
}

/**
 * Verifiziert einen Apple-Beleg. Produktiv würde der Beleg an
 * https://buy.itunes.apple.com/verifyReceipt (bzw. sandbox-URL) mit
 * APPLE_IAP_SHARED_SECRET gesendet und die latest_receipt_info ausgewertet.
 */
export async function verifyApple(receipt: string, expectedProductId: string): Promise<VerifiedReceipt> {
  const sb = parseSandbox(receipt);
  if (sb) {
    if (!env.IAP_ALLOW_SANDBOX) throw badRequest('Sandbox-Belege sind deaktiviert');
    if (sb.productId !== expectedProductId) throw badRequest('Beleg passt nicht zum Produkt');
    return { ...sb, sandbox: true };
  }
  if (!env.APPLE_IAP_SHARED_SECRET) {
    throw badRequest('Apple-IAP ist nicht konfiguriert (APPLE_IAP_SHARED_SECRET fehlt)');
  }
  // Produktiv: echten Beleg gegen Apple prüfen. Bewusst nicht „erfunden".
  logger.warn('Apple-Beleg-Verifizierung (Produktiv) noch nicht implementiert');
  throw badRequest('Apple-Beleg-Verifizierung ist serverseitig noch nicht aktiviert');
}

/**
 * Verifiziert einen Google-Play-Kauf. Produktiv würde der purchaseToken über die
 * Google Play Developer API (purchases.products.get) mit einem Service-Account
 * geprüft (GOOGLE_PLAY_PACKAGE_NAME + Credentials).
 */
export async function verifyGoogle(receipt: string, expectedProductId: string): Promise<VerifiedReceipt> {
  const sb = parseSandbox(receipt);
  if (sb) {
    if (!env.IAP_ALLOW_SANDBOX) throw badRequest('Sandbox-Belege sind deaktiviert');
    if (sb.productId !== expectedProductId) throw badRequest('Beleg passt nicht zum Produkt');
    return { ...sb, sandbox: true };
  }
  if (!env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw badRequest('Google-IAP ist nicht konfiguriert (GOOGLE_PLAY_PACKAGE_NAME fehlt)');
  }
  logger.warn('Google-Beleg-Verifizierung (Produktiv) noch nicht implementiert');
  throw badRequest('Google-Beleg-Verifizierung ist serverseitig noch nicht aktiviert');
}
