import { Request as ExRequest } from 'express';
import { Controller, Get, Request, Route, Security, Tags } from 'tsoa';
import {
  ForbiddenError,
  UnauthorizedError,
  requirePlatformAdmin,
} from '../guards/AuthGuard';
import userService from '../services/UserService';

/** Platform Admin read of the YouTube Access lifetime ceiling (ADR 0129). */
interface YouTubeAccessUsageResponse {
  everGranted: number;
  ceiling: number;
}

@Tags('Platform Admin')
@Route('/admin/youtube-access')
@Security('jwt', ['platform_admin'])
export class AdminYouTubeAccessController extends Controller {
  /**
   * Users ever granted YouTube Access, and the configured ceiling. Platform Admin only.
   */
  @Get()
  async getYouTubeAccessUsage(
    @Request() req: ExRequest,
  ): Promise<YouTubeAccessUsageResponse> {
    this.assertPlatformAdmin(req);
    return userService.getYouTubeAccessUsage();
  }

  private assertPlatformAdmin(req: ExRequest) {
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
