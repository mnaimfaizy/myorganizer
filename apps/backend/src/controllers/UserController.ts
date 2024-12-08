import fs from 'fs';
import path from 'path';
import {
  Controller,
  Get,
  Path,
  Post,
  Route,
  Tags,
  Response as TsoaResponse,
} from 'tsoa';
import { z } from 'zod';
import { Body, ValidateBody } from '../decorators/request-body-validator';
import apiTokens from '../helpers/ApiTokens';
import { User, UserCreationBody } from '../models/User';
import sendEmail from '../services/EmailService';
import userService from '../services/UserService';

const UserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

@Tags('Users Management')
@Route('/user')
export class UserController extends Controller {
  @Get()
  async getAllUsers(): Promise<User[]> {
    return userService.getAll();
  }

  @Get('{userId}')
  async getUserById(@Path() userId: string): Promise<User | null> {
    return userService.getById(userId);
  }

  @Post()
  @TsoaResponse(201, 'Created') // Custom success response
  @ValidateBody(UserSchema)
  async createUser(@Body() requestBody: UserCreationBody): Promise<User | any> {
    const user = await userService.create(requestBody);
    await this.sendVerificationMail(user);
    this.setStatus(201); // Set return status 201
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return userService.getByEmail(email);
  }

  private async sendVerificationMail(user: User): Promise<void> {
    const token = apiTokens.generateEmailVerificationToken(user.id);
    const verifyUrl = `${process.env.APP_FRONTEND_URL}/verify/email/?token=${token}`;

    // Read the HTML template
    const templatePath = path.join(__dirname, './templates/verify-email.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders with actual values
    htmlTemplate = htmlTemplate.replace('[Verification Link]', verifyUrl);
    htmlTemplate = htmlTemplate.replace('[Your Company]', process.env.APP_NAME);
    htmlTemplate = htmlTemplate.replace('[Your Company]', process.env.APP_NAME);

    await sendEmail(user.email, 'Verify your email', htmlTemplate);
  }
}

const userController = new UserController();
export default userController;
