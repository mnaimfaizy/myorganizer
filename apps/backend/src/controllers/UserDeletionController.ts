import { Request as ExRequest } from 'express';
import {
  Controller,
  Delete,
  Request,
  Res,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
  TsoaResponse,
  ValidateError,
} from 'tsoa';
import { Body, zodIssuesToDetails } from '../decorators/request-body-validator';
import { clearRefreshCookieIfPresent } from '../helpers/cookieHelper';
import { requireUserId } from '../guards/AuthGuard';
import { ValidateErrorJSON } from '../interfaces';
import { UserDeletionSchema } from '../schemas/auth.schema';
import userService from '../services/UserService';
import {
  UserDeletionBody,
  UserDeletionRefusal,
  VersionFloorRefusal,
} from '../types';

@Tags('Users')
@Route('/users')
@Response<VersionFloorRefusal>(426, 'Below the Version Floor')
export class UserDeletionController extends Controller {
  /**
   * User Deletion: permanently and immediately deletes the signed-in User and
   * everything they own. Requires the User's password and the literal
   * confirmation `DELETE`. Sessions end because the User row is removed.
   */
  @Delete('me')
  @Security('jwt')
  @SuccessResponse(204, 'User deleted')
  @Response<ValidateErrorJSON>(422, 'Validation Failed')
  @Response<UserDeletionRefusal>(403, 'Incorrect password')
  @Response<UserDeletionRefusal>(409, 'A YouTube sync is running')
  public async deleteMe(
    @Request() req: ExRequest,
    @Body() requestBody: UserDeletionBody,
    @Res() respond: TsoaResponse<403 | 409, UserDeletionRefusal>,
  ): Promise<void> {
    // Validated here rather than with @ValidateBody so password + DELETE
    // confirmation stay next to deleteUser refusals. ValidateError is answered
    // with 422 by the app's tsoa error handler.
    const parsed = UserDeletionSchema.safeParse(requestBody);
    if (!parsed.success) {
      throw new ValidateError(
        zodIssuesToDetails(parsed.error),
        'Validation Failed',
      );
    }

    const userId = requireUserId(req);
    const outcome = await userService.deleteUser(userId, parsed.data.password);

    if (outcome.status === 'incorrect_password') {
      return respond(403, { message: 'Incorrect password.' });
    }
    if (outcome.status === 'youtube_sync_live') {
      return respond(409, {
        message:
          'A YouTube sync is running. Try deleting your account again shortly.',
      });
    }

    clearRefreshCookieIfPresent(req);
    this.setStatus(204);
  }
}
