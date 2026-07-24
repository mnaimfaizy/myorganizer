import {
  Controller,
  Get,
  Path,
  Query,
  Request,
  Res,
  Response,
  Route,
  Security,
  Tags,
  TsoaResponse,
} from 'tsoa';
import { Request as ExRequest } from 'express';
import {
  ForbiddenError,
  UnauthorizedError,
  requirePlatformAdmin,
} from '../guards/AuthGuard';
import { toAdminUserIdentity } from '../helpers/filterUser';
import userService from '../services/UserService';
import { AdminUserIdentity } from '../types';

@Tags('Platform Admin')
@Route('/admin/users')
@Security('jwt', ['platform_admin'])
export class AdminUsersController extends Controller {
  /**
   * List/search Users (identity fields only). Platform Admin only.
   */
  @Get()
  async listUsers(
    @Request() req: ExRequest,
    @Query() q?: string,
  ): Promise<AdminUserIdentity[]> {
    this.assertPlatformAdmin(req);
    const users = await userService.listIdentityUsers(q);
    return users.map((user) => toAdminUserIdentity(user));
  }

  /**
   * Get a User by id (identity fields only). Platform Admin only.
   */
  @Get('{userId}')
  @Response(404, 'User not found')
  async getUserById(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
  ): Promise<AdminUserIdentity> {
    this.assertPlatformAdmin(req);
    const user = await userService.getIdentityById(userId);
    if (!user) {
      return notFound(404, { message: 'User not found' });
    }
    return toAdminUserIdentity(user);
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
