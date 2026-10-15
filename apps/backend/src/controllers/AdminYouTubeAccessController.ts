import { Request as ExRequest } from 'express';
import { Get, Request, Response, Route, Security, Tags } from 'tsoa';
import { PlatformAdminControllerBase } from './PlatformAdminControllerBase';
import userService from '../services/UserService';
import { VersionFloorRefusal } from '../types';

/** Platform Admin read of the YouTube Access lifetime ceiling (ADR 0129). */
interface YouTubeAccessUsageResponse {
  everGranted: number;
  ceiling: number;
}

@Tags('Platform Admin')
@Route('/admin/youtube-access')
@Security('jwt', ['platform_admin'])
@Response<VersionFloorRefusal>(426, 'Below the Version Floor')
export class AdminYouTubeAccessController extends PlatformAdminControllerBase {
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
}
