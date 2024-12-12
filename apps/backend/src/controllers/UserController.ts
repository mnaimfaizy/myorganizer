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
import { ValidateErrorJSON } from '../interfaces';
import { User, UserCreationBody } from '../models/User';
import { UserSchema } from '../schemas/user.schema';
import userService from '../services/UserService';
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
  async createUser(@Body() requestBody: UserCreationBody): Promise<User | any> {
    const user = await userService.create(requestBody);
    await userService.sendVerificationMail(user);
    this.setStatus(201); // Set return status 201
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return userService.getByEmail(email);
  }
}

const userController = new UserController();
export default userController;
