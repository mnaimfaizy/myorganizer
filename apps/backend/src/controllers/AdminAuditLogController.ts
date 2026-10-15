import { Get, Query, Request, Response, Route, Security, Tags } from 'tsoa';
import { Request as ExRequest } from 'express';
import { PlatformAdminControllerBase } from './PlatformAdminControllerBase';
import userService from '../services/UserService';
import { AdminAuditLogEntry, VersionFloorRefusal } from '../types';

@Tags('Platform Admin')
@Route('/admin/audit-logs')
@Security('jwt', ['platform_admin'])
@Response<VersionFloorRefusal>(426, 'Below the Version Floor')
export class AdminAuditLogController extends PlatformAdminControllerBase {
  /**
   * List recent Admin Audit Log entries (newest first). Platform Admin only.
   */
  @Get()
  async listAuditLogs(
    @Request() req: ExRequest,
    @Query() limit?: number,
  ): Promise<AdminAuditLogEntry[]> {
    this.assertPlatformAdmin(req);
    const rows = await userService.listAdminAuditLogs(limit);
    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      targetUserId: row.target_user_id,
      action: row.action,
      createdAt: row.created_at,
    }));
  }
}
