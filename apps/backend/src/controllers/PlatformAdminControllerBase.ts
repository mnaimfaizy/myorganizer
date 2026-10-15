import { Controller } from 'tsoa';
import { Request as ExRequest } from 'express';
import {
  ForbiddenError,
  UnauthorizedError,
  requirePlatformAdmin,
} from '../guards/AuthGuard';
import { UserInterface } from '../types';

/**
 * Shared Platform Admin guard for Admin controllers. Maps guard errors to HTTP
 * statuses (401 Unauthorized, 403 Forbidden) and rethrows so the error handler
 * still produces the response body.
 *
 * Named `*Base.ts` on purpose: `tsoa.json` globs `*Controller.ts` for route
 * discovery, and this class must not be scanned as a route owner.
 */
export abstract class PlatformAdminControllerBase extends Controller {
  protected assertPlatformAdmin(req: ExRequest): UserInterface {
    try {
      return requirePlatformAdmin(req);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        this.setStatus(401);
        throw err;
      }
      if (err instanceof ForbiddenError) {
        this.setStatus(403);
        throw err;
      }
      throw err;
    }
  }
}
