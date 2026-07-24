import { Controller, Get, Query, Request, Route, Security, Tags } from 'tsoa';
import { Request as ExRequest } from 'express';
import {
  ForbiddenError,
  UnauthorizedError,
  requirePlatformAdmin,
} from '../guards/AuthGuard';
import userService from '../services/UserService';
import { AdminAuditLogEntry } from '../types';

@Tags('Platform Admin')
@Route('/admin/audit-logs')
@Security('jwt', ['platform_admin'])
export class AdminAuditLogController extends Controller {
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

  private assertPlatformAdmin(req: ExRequest): void {
    try {
      requirePlatformAdmin(req);
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
