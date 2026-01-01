import bcrypt from 'bcrypt';
import fs from 'fs';
import { JsonWebTokenError, JwtPayload } from 'jsonwebtoken';
import path from 'path';
import apiTokens from '../helpers/ApiTokens';
import { decodeToken } from '../helpers/jwtHelper';
import { User, UserCreationBody } from '../models/User';
import { PrismaClient } from '../prisma';
import sendEmail from './EmailService';

class UserService {
  Users: User[] = [];
  SaltRounds = 10;

  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<User[]> {
    this.Users = await this.prisma.user.findMany();
    return this.Users;
  }

  async getById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });
    return user;
  }

  async getByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    return user;
  }

  async create(user: UserCreationBody): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, this.SaltRounds);
    const newUser = await this.prisma.user.create({
      data: {
        name: user.name ?? `${user.firstName} ${user.lastName}`,
        first_name: user.firstName,
        last_name: user.lastName,
        phone: user.phone,
        email: user.email,
        password: hashedPassword,
      },
    });
    return newUser;
  }

  async update(id: string, data: any): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: {
        id,
      },
      data,
    });
    return updatedUser;
  }

  async resetPassword(
    id: string,
    password: string,
    token: string
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, this.SaltRounds);
    const data = {
      password: hashedPassword,
      reset_password_token: null,
    };
    const updatedUser = await this.prisma.user.update({
      where: {
        id,
        reset_password_token: token,
      },
      data,
    });

    return updatedUser;
  }

  async sendVerificationMail(user: User): Promise<void> {
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

  async sendPasswordResetMail(user: User): Promise<string | Error> {
    const token = apiTokens.generatePasswordResetToken(user.id);
    const resetUrl = `${process.env.APP_FRONTEND_URL}/reset/password/?token=${token}`;

    // Read the HTML template
    const templatePath = path.join(
      __dirname,
      './templates/reset-password.html'
    );
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders with actual values
    htmlTemplate = htmlTemplate.replace('[Reset Link]', resetUrl);
    htmlTemplate = htmlTemplate.replace('[Your Company]', process.env.APP_NAME);

    await sendEmail(user.email, 'Reset your password', htmlTemplate);
    return token;
  }

  async logout(userId: string, refreshToken: string): Promise<User> {
    const data = {
      blacklisted_tokens: {
        push: refreshToken,
      },
    };
    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data,
    });

    return updatedUser;
  }

  async refreshToken(refreshToken: string): Promise<User | null> {
    const decodedToken = decodeToken(
      refreshToken,
      process.env.REFRESH_JWT_SECRET as string
    ) as JwtPayload;

    if (
      decodedToken instanceof Error ||
      decodeToken instanceof JsonWebTokenError
    ) {
      return null;
    }

    const { userId } = decodedToken;

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    return user;
  }
}

const userService = new UserService(new PrismaClient());
export default userService;
