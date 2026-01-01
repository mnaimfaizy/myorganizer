import {
  Controller,
  Get,
  Middlewares,
  Path,
  Post,
  Response,
  Route,
  Security,
  Tags,
} from 'tsoa';
import { Body, ValidateBody } from '../decorators/request-body-validator';
import filterUser from '../helpers/filterUser';
import { ValidateErrorJSON } from '../interfaces';
import { User, UserCreationBody } from '../models/User';
import { UserSchema } from '../schemas/user.schema';
import userService from '../services/UserService';
import { FilteredUserInterface, UserInterface } from '../types';
import passport from '../utils/passport';

@Tags('Users Management')
@Route('/user')
export class UserController extends Controller {
  @Get()
  @Middlewares([passport.authenticate('jwt', { session: false })])
  @Security('jwt')
  async getAllUsers(): Promise<User[]> {
    return userService.getAll();
  }

  @Get('{userId}')
  async getUserById(@Path() userId: string): Promise<User | null> {
    return userService.getById(userId);
  }

  @Post()
  @Response<ValidateErrorJSON>(422, 'Validation Failed') // Custom error response
  @Response(201, 'Created') // Custom success response
  @ValidateBody(UserSchema)
  async createUser(
    @Body() requestBody: UserCreationBody
  ): Promise<FilteredUserInterface> {
    const existing = await userService.getByEmail(requestBody.email);
    if (existing) {
      const isVerified = Boolean(
        (existing as any)?.email_verification_timestamp
      );
      if (isVerified) {
        this.setStatus(409);
        throw new Error('Email already registered');
      }

      await userService.sendVerificationMail(existing);
      this.setStatus(200);
      return filterUser(existing as UserInterface);
    }

    const user = await userService.create(requestBody);
    try {
      await userService.sendVerificationMail(user);
    } catch (err) {
      try {
        await userService.deleteById(user.id);
      } catch {
        // best-effort rollback
      }
      throw err;
    }

    this.setStatus(201); // Set return status 201
    return filterUser(user as UserInterface);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return userService.getByEmail(email);
  }
}

const userController = new UserController();
export default userController;
