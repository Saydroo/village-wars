import { Router } from 'express';
import { getRawGameConfig } from '../gameConfig';

export const configRouter = Router();

/**
 * GET /api/config — liefert die komplette game-config.json.
 * Das Frontend lädt sie hierüber und cached sie im State. So bleibt die JSON
 * die einzige Quelle aller Zahlenwerte für Front- und Backend.
 */
configRouter.get('/', (_req, res) => {
  res.json(getRawGameConfig());
});
