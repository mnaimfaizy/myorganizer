import {
  Controller,
  Get,
  Path,
  Post,
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
  EmailAlreadyVerifiedError,
  LastPlatformAdminError,
  UserNotFoundError,
  VerificationCooldownError,
  VerificationSendFailedError,
} from '../errors/AdminLifecycleErrors';
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

  /**
   * Disable a User (soft-block) and invalidate active sessions immediately.
   */
  @Post('{userId}/disable')
  @Response(404, 'User not found')
  async disableUser(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
  ): Promise<AdminUserIdentity> {
    const actor = this.assertPlatformAdmin(req);
    try {
      const user = await userService.disableUser(actor.id, userId);
      return toAdminUserIdentity(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      throw err;
    }
  }

  /**
   * Re-enable a Disabled User so authentication works again.
   */
  @Post('{userId}/enable')
  @Response(404, 'User not found')
  async enableUser(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
  ): Promise<AdminUserIdentity> {
    const actor = this.assertPlatformAdmin(req);
    try {
      const user = await userService.enableUser(actor.id, userId);
      return toAdminUserIdentity(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      throw err;
    }
  }

  /**
   * Force logout a User without disabling the account.
   */
  @Post('{userId}/force-logout')
  @Response(404, 'User not found')
  async forceLogoutUser(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
  ): Promise<AdminUserIdentity> {
    const actor = this.assertPlatformAdmin(req);
    try {
      const user = await userService.forceLogoutUser(actor.id, userId);
      return toAdminUserIdentity(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      throw err;
    }
  }

  /**
   * Resend verification email for an unverified User (existing cooldown rules).
   */
  @Post('{userId}/resend-verification')
  @Response(404, 'User not found')
  @Response(409, 'Email already verified')
  @Response(429, 'Verification email cooldown')
  async resendVerification(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
    @Res() conflict: TsoaResponse<409, { message: string }>,
    @Res() tooMany: TsoaResponse<429, { message: string }>,
  ): Promise<{ message: string }> {
    const actor = this.assertPlatformAdmin(req);
    try {
      await userService.adminResendVerification(actor.id, userId);
      return { message: 'Verification email sent successfully' };
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      if (err instanceof EmailAlreadyVerifiedError) {
        return conflict(409, { message: err.message });
      }
      if (err instanceof VerificationCooldownError) {
        return tooMany(429, { message: err.message });
      }
      if (err instanceof VerificationSendFailedError) {
        this.setStatus(500);
        throw err;
      }
      throw err;
    }
  }

  /**
   * Promote a User to Platform Admin.
   */
  @Post('{userId}/promote')
  @Response(404, 'User not found')
  async promoteUser(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
  ): Promise<AdminUserIdentity> {
    const actor = this.assertPlatformAdmin(req);
    try {
      const user = await userService.promoteUser(actor.id, userId);
      return toAdminUserIdentity(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      throw err;
    }
  }

  /**
   * Demote a Platform Admin to a normal User.
   * Rejects demotion of the last Platform Admin.
   */
  @Post('{userId}/demote')
  @Response(404, 'User not found')
  @Response(409, 'Cannot demote the last Platform Admin')
  async demoteUser(
    @Request() req: ExRequest,
    @Path() userId: string,
    @Res() notFound: TsoaResponse<404, { message: string }>,
    @Res() conflict: TsoaResponse<409, { message: string }>,
  ): Promise<AdminUserIdentity> {
    const actor = this.assertPlatformAdmin(req);
    try {
      const user = await userService.demoteUser(actor.id, userId);
      return toAdminUserIdentity(user);
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return notFound(404, { message: err.message });
      }
      if (err instanceof LastPlatformAdminError) {
        return conflict(409, { message: err.message });
      }
      throw err;
    }
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
