import type { RequestHandler } from 'express';
import type { Env } from '../config/env';
import {
  decideVersionFloor,
  parseClientHeader,
  parseVersionFloor,
} from '../helpers/versionFloor';

/**
 * Refuses Mobile App requests below this environment's Version Floor with
 * HTTP 426, before authentication and before any route runs (ADR 0114).
 *
 * The floor is read once, here. A change to MOBILE_VERSION_FLOOR takes effect
 * on restart, which is how every backend environment change applies.
 */
export function createVersionFloorMiddleware(
  env: Env = process.env,
): RequestHandler {
  const floor = parseVersionFloor(env.MOBILE_VERSION_FLOOR);

  if (floor.kind === 'invalid') {
    console.error(
      `MOBILE_VERSION_FLOOR "${floor.raw}" is not a Mobile Release version (X.Y.Z). Every Mobile App request will be refused with 426 until it is fixed.`,
    );
  }

  return (req, res, next) => {
    const header = req.headers['x-client'];
    const client = parseClientHeader(
      Array.isArray(header) ? header.join(', ') : header,
    );

    const decision = decideVersionFloor(floor, client);
    if (decision.kind === 'refuse') {
      res.status(426).json(decision.body);
      return;
    }

    next();
  };
}
