import bcrypt from 'bcrypt';
import fs from 'fs';
import { JsonWebTokenError, JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import path from 'path';
import {
  EmailAlreadyVerifiedError,
  LastPlatformAdminError,
  UserNotFoundError,
  VerificationCooldownError,
  VerificationSendFailedError,
} from '../errors/AdminLifecycleErrors';
import apiTokens from '../helpers/ApiTokens';
import { decodeToken } from '../helpers/jwtHelper';
import { User, UserCreationBody } from '../models/User';
import {
  AdminAuditAction,
  Prisma,
  PrismaClient,
  createPrismaClient,
} from '../prisma';
import sendEmail from './EmailService';

/** Fields safe to return from Platform Admin directory APIs. */
const ADMIN_IDENTITY_SELECT = {
  id: true,
  name: true,
  first_name: true,
  last_name: true,
  phone: true,
  email: true,
  role: true,
  disabled: true,
  email_verification_timestamp: true,
} as const;

export type AdminIdentityUser = Prisma.UserGetPayload<{
  select: typeof ADMIN_IDENTITY_SELECT;
}>;

export type AdminAuditLogRow = {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  action: AdminAuditAction;
  created_at: Date;
};

class UserService {
  Users: User[] = [];
  SaltRounds = 10;

  constructor(private prisma: PrismaClient) {}

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

  /**
   * List/search Users for Platform Admin directory (identity fields only).
   * Optional `q` matches email, name, first_name, or last_name (case-insensitive).
   */
  async listIdentityUsers(q?: string): Promise<AdminIdentityUser[]> {
    const query = (q ?? '').trim();
    const where: Prisma.UserWhereInput = query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { first_name: { contains: query, mode: 'insensitive' } },
            { last_name: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.prisma.user.findMany({
      where,
      select: ADMIN_IDENTITY_SELECT,
      orderBy: [{ email: 'asc' }],
    });
  }

  async getIdentityById(id: string): Promise<AdminIdentityUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: ADMIN_IDENTITY_SELECT,
    });
  }

  /**
   * Elevate an existing User to platform_admin by email.
   * Idempotent: no-op if already platform_admin. Returns null if no User matches.
   * Bootstrap path only — does not write an Admin Audit Log entry.
   */
  async elevateToPlatformAdminByEmail(
    email: string,
  ): Promise<AdminIdentityUser | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: ADMIN_IDENTITY_SELECT,
    });
    if (!existing) return null;

    if (existing.role === 'platform_admin') {
      return existing;
    }

    return this.prisma.user.update({
      where: { id: existing.id },
      data: { role: 'platform_admin' },
      select: ADMIN_IDENTITY_SELECT,
    });
  }

  private async writeAdminAuditLog(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    targetUserId: string,
    action: AdminAuditAction,
  ): Promise<void> {
    await tx.adminAuditLog.create({
      data: {
        actor_user_id: actorUserId,
        target_user_id: targetUserId,
        action,
      },
    });
  }

  private async requireIdentityUser(
    userId: string,
  ): Promise<AdminIdentityUser> {
    const user = await this.getIdentityById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    return user;
  }

  /**
   * Soft-block a User and invalidate active refresh/access sessions immediately.
   */
  async disableUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    await this.requireIdentityUser(targetUserId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          disabled: true,
          sessions_invalidated_at: new Date(),
        },
        select: ADMIN_IDENTITY_SELECT,
      });
      await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'disable');
      return updated;
    });
  }

  /**
   * Re-enable a Disabled User so authentication works again.
   * Does not restore previously invalidated sessions.
   */
  async enableUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    await this.requireIdentityUser(targetUserId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { disabled: false },
        select: ADMIN_IDENTITY_SELECT,
      });
      await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'enable');
      return updated;
    });
  }

  /**
   * Invalidate all refresh/access sessions without disabling the account.
   */
  async forceLogoutUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    await this.requireIdentityUser(targetUserId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { sessions_invalidated_at: new Date() },
        select: ADMIN_IDENTITY_SELECT,
      });
      await this.writeAdminAuditLog(
        tx,
        actorUserId,
        targetUserId,
        'force_logout',
      );
      return updated;
    });
  }

  /**
   * Promote a User to Platform Admin. Idempotent if already platform_admin.
   */
  async promoteUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    const existing = await this.requireIdentityUser(targetUserId);

    if (existing.role === 'platform_admin') {
      await this.prisma.$transaction(async (tx) => {
        await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'promote');
      });
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: 'platform_admin' },
        select: ADMIN_IDENTITY_SELECT,
      });
      await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'promote');
      return updated;
    });
  }

  /**
   * Demote a Platform Admin to a normal User.
   * Rejects when the target is the last Platform Admin.
   */
  async demoteUser(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    const existing = await this.requireIdentityUser(targetUserId);

    if (existing.role !== 'platform_admin') {
      await this.prisma.$transaction(async (tx) => {
        await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'demote');
      });
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const adminCount = await tx.user.count({
        where: { role: 'platform_admin' },
      });
      if (adminCount <= 1) {
        throw new LastPlatformAdminError();
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: 'user' },
        select: ADMIN_IDENTITY_SELECT,
      });
      await this.writeAdminAuditLog(tx, actorUserId, targetUserId, 'demote');
      return updated;
    });
  }

  /**
   * Admin-triggered verification email resend.
   * Reuses public cooldown / already-verified semantics.
   */
  async adminResendVerification(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminIdentityUser> {
    const identity = await this.requireIdentityUser(targetUserId);
    const user = await this.getById(targetUserId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const token = await this.sendVerificationMail(user);
    if (token instanceof Error) {
      if (token.message.includes('already verified')) {
        throw new EmailAlreadyVerifiedError();
      }
      if (token.message.includes('already sent recently')) {
        throw new VerificationCooldownError();
      }
      throw new VerificationSendFailedError();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { email_verification_token: token },
      });
      await this.writeAdminAuditLog(
        tx,
        actorUserId,
        targetUserId,
        'resend_verification',
      );
      return identity;
    });
  }

  /**
   * List recent Admin Audit Log entries (newest first).
   */
  async listAdminAuditLogs(limit = 50): Promise<AdminAuditLogRow[]> {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.prisma.adminAuditLog.findMany({
      take,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        actor_user_id: true,
        target_user_id: true,
        action: true,
        created_at: true,
      },
    });
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
    token: string,
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
        process.env.VERIFY_JWT_SECRET as string,
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
      '',
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
      '',
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
        ', ',
      )}`,
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
      process.env.REFRESH_JWT_SECRET as string,
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

const userService = new UserService(createPrismaClient());
export default userService;
