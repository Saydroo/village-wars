import rateLimit from 'express-rate-limit';
import { env } from '../env';

/** Allgemeines Limit für die gesamte API. Grenzen aus der Config (env). */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Zu viele Anfragen, bitte später erneut' },
  },
});

/** Strengeres Limit für Auth-Endpunkte (Brute-Force-Schutz). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Zu viele Auth-Versuche, bitte später erneut' },
  },
});
