import dotenv from 'dotenv';
import { JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import {
  Controller,
  Middlewares,
  Patch,
  Path,
  Post,
  Response,
  Route,
  Security,
  Tags,
} from 'tsoa';
import { Body, ValidateBody } from '../decorators/request-body-validator';
import filterUser from '../helpers/filterUser';
import { decodeToken } from '../helpers/jwtHelper';
import { ValidateErrorJSON } from '../interfaces';
import {
  ConfirmResetPasswordBody,
  User,
  UserCreationBody,
  UserLoginBody,
} from '../models/User';
import {
  resetPasswordSchema,
  updatePasswordSchema,
  VerifyEmailSchema,
} from '../schemas/auth.schema';
import { UserSchema } from '../schemas/user.schema';
import userService from '../services/UserService';
import { FilteredUserInterface, UserInterface } from '../types';
import passport from '../utils/passport';
dotenv.config();

@Tags('Authentication')
@Route('/auth')
export class AuthController extends Controller {
  @Post('/login')
  @Response(200, 'Success') // Custom success response
  @Middlewares([passport.authenticate('local', { session: false })])
  async login(
    @Body() requestBody: UserLoginBody
  ): Promise<{ status_code: number; message: string }> {
    const user = await userService.getByEmail(requestBody.email);
    if (!user) {
      this.setStatus(401);
      return { status_code: 401, message: 'Invalid email or password' };
    }
  }

  @Post('/register')
  @Response<ValidateErrorJSON>(422, 'Validation Failed') // Custom error response
  @Response(201, 'Created') // Custom success response
  @ValidateBody(UserSchema)
  async createUser(@Body() requestBody: UserCreationBody): Promise<User | any> {
    const user = await userService.create(requestBody);
    await userService.sendVerificationMail(user);
    this.setStatus(201); // Set return status 201
    return user;
  }

  @Patch('/verify/email')
  @Response<ValidateErrorJSON>(422, 'Validation Failed') // Custom error response
  @Response(200, 'Success') // Custom success response
  @ValidateBody(VerifyEmailSchema)
  async verifyEmail(
    @Body() requestBody: { token: string }
  ): Promise<FilteredUserInterface> {
    const decodedToken = decodeToken(
      requestBody.token,
      process.env.VERIFY_JWT_SECRET as string
    ) as JwtPayload;

    const userId = decodedToken.userId;

    const updateUser = await userService.update(userId, {
      email_verification_timestamp: new Date(),
    });

    if (!updateUser) {
      this.setStatus(500);
      throw new Error('Failed to verify email');
    }

    const filteredUser = filterUser(updateUser as UserInterface);
    if (!filteredUser) {
      this.setStatus(500);
      throw new Error('Failed to filter user');
    } else {
      this.setStatus(200);
      return filteredUser;
    }
  }

  @Post('/verify/resend/{userId}')
  @Middlewares([passport.authenticate('local', { session: false })])
  @Security('jwt')
  async resendVerificationEmail(@Path() userId: string): Promise<void> {
    const user = await userService.getById(userId);
    if (!user) {
      this.setStatus(404);
      throw new Error('User not found');
    } else {
      await userService.sendVerificationMail(user);
    }
  }

  @Post('/password/reset')
  @ValidateBody(resetPasswordSchema)
  async resetPassword(
    @Body() requestBody: { email: string }
  ): Promise<{ status: number; message: string }> {
    const user = await userService.getByEmail(requestBody.email);
    if (!user) {
      this.setStatus(404);
      return { status: 404, message: 'User not found' };
    }

    const token = await userService.sendPasswordResetMail(user);

    if (token instanceof Error) {
      return { status: 500, message: 'Failed to reset password' };
    }

    const updatedUser = await userService.update(user.id, {
      reset_password_token: token,
    });

    if (!updatedUser) {
      return { status: 500, message: 'Failed to reset password' };
    }
    return { status: 200, message: 'Password reset email sent successfully' };
  }

  @Patch('/password/reset/confirm')
  @ValidateBody(updatePasswordSchema)
  async confirmResetPassword(
    @Body() requestBody: ConfirmResetPasswordBody
  ): Promise<{ status: number; message: string }> {
    const verifiedToken = decodeToken(
      requestBody.token,
      process.env.RESET_JWT_SECRET as string
    ) as JwtPayload;

    if (verifiedToken instanceof TokenExpiredError) {
      this.setStatus(400);
      return { status: 400, message: 'Token expired' };
    } else if (verifiedToken instanceof Error) {
      this.setStatus(400);
      return { status: 400, message: 'Invalid token' };
    }
    const userId = verifiedToken.userId;
    const user = await userService.getById(userId);
    if (!user) {
      this.setStatus(404);
      return { status: 404, message: 'User not found' };
    }

    const updatedUser = await userService.resetPassword(
      userId,
      requestBody.password,
      requestBody.token
    );

    if (!updatedUser) {
      this.setStatus(500);
      return { status: 500, message: 'Failed to reset password' };
    }

    this.setStatus(200);
    return { status: 200, message: 'Password reset successfully' };
  }
}

const authController = new AuthController();
export default authController;
