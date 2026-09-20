import type { RequestHandler } from 'express';
import { isYouTubeAvailable } from '../config/youtube';

/**
 * Paths under `/youtube` that stay reachable while the switch is off: the
 * cron endpoints (which must keep succeeding and doing nothing, per ADR
 * 0091) and the availability report itself (which exists precisely to say
 * YouTube is unavailable). Everything else 404s.
 */
const CRON_PATH_PREFIX = '/cron/';
const AVAILABILITY_PATH = '/availability';

export function createYouTubeAvailabilityGate(): RequestHandler {
  return (req, res, next) => {
    if (isYouTubeAvailable()) {
      next();
      return;
    }

    if (
      req.path === AVAILABILITY_PATH ||
      req.path.startsWith(CRON_PATH_PREFIX)
    ) {
      next();
      return;
    }

    res.status(404).json({ message: 'Not Found' });
  };
}
