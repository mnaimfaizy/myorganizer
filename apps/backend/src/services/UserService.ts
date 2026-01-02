import bcrypt from 'bcrypt';
import fs from 'fs';
import { JsonWebTokenError, JwtPayload, TokenExpiredError } from 'jsonwebtoken';
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

  async deleteById(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: {
        id,
      },
    });
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

  async sendVerificationMail(user: User): Promise<string | Error> {
    const isVerified = Boolean((user as any)?.email_verification_timestamp);
    if (isVerified) {
      return new Error('Email already verified');
    }

    const existingToken = (user as any)?.email_verification_token as
      | string
      | null
      | undefined;

    if (existingToken) {
      const decodedExisting = decodeToken(
        existingToken,
        process.env.VERIFY_JWT_SECRET as string
      );
      const isExpired = decodedExisting instanceof TokenExpiredError;
      const isInvalid = decodedExisting instanceof Error;

      if (!isExpired && !isInvalid) {
        return new Error('Verification email already sent recently');
      }
    }

    const token = apiTokens.generateEmailVerificationToken(user.id);
    if (token instanceof Error) {
      return token;
    }
    const frontendBaseUrl = (process.env.APP_FRONTEND_URL || '').replace(
      /\/+$/,
      ''
    );
    const verifyUrl = `${frontendBaseUrl}/verify/email?token=${token}`;

    const htmlTemplate = this.readHtmlTemplate('verify-email.html');

    // Replace placeholders with actual values
    const filledTemplate = htmlTemplate
      .replace('[Verification Link]', verifyUrl)
      .replace('[Your Company]', process.env.APP_NAME)
      .replace('[Your Company]', process.env.APP_NAME);

    try {
      await sendEmail(user.email, 'Verify your email', filledTemplate);
      return token;
    } catch {
      return new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetMail(user: User): Promise<string | Error> {
    const token = apiTokens.generatePasswordResetToken(user.id);
    if (token instanceof Error) {
      return token;
    }
    const frontendBaseUrl = (process.env.APP_FRONTEND_URL || '').replace(
      /\/+$/,
      ''
    );
    const resetUrl = `${frontendBaseUrl}/reset/password?token=${token}`;

    const htmlTemplate = this.readHtmlTemplate('reset-password.html');

    // Replace placeholders with actual values
    const filledTemplate = htmlTemplate
      .replace('[Reset Link]', resetUrl)
      .replace('[Your Company]', process.env.APP_NAME);

    try {
      await sendEmail(user.email, 'Reset your password', filledTemplate);
      return token;
    } catch {
      return new Error('Failed to send password reset email');
    }
  }

  private readHtmlTemplate(fileName: string): string {
    const candidates = [
      // Nx webpack build output (templates are copied as an asset)
      path.join(__dirname, 'templates', fileName),
      // Fallback for alternate runtimes/layouts
      path.join(__dirname, '../templates', fileName),
    ];

    for (const templatePath of candidates) {
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
      }
    }

    throw new Error(
      `Email template '${fileName}' not found. Looked in: ${candidates.join(
        ', '
      )}`
    );
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
