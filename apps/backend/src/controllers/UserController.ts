import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Route,
  Tags,
  Response as TsoaResponse,
} from 'tsoa';
import { User, UserCreationBody } from '../models/User';
import userService from '../services/UserService';

@Tags('Users Management')
@Route('/users')
export class UserController extends Controller {
  @Get()
  async getAllUsers(): Promise<User[]> {
    return userService.getAll();
  }

  @Get('{userId}')
  async getUserById(@Path() userId: string): Promise<User | null> {
    return userService.getById(userId);
  }

  @TsoaResponse(201, 'Created') // Custom success response
  @Post()
  async createUser(@Body() requestBody: UserCreationBody): Promise<User> {
    const user = await userService.create(requestBody);
    this.setStatus(201); // Set return status 201
    return user;
  }
}

const userController = new UserController();
export default userController;
