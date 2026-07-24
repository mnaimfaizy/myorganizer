import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
  EmailAlreadyVerifiedError,
  LastPlatformAdminError,
  UserNotFoundError,
  VerificationCooldownError,
} from '../errors/AdminLifecycleErrors';
import userService from './UserService';

type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type CountMock = jest.Mock<(...args: unknown[]) => Promise<number>>;

type MockPrismaClient = {
  user: {
    findUnique: AsyncMock;
    update: AsyncMock;
    count: CountMock;
  };
  adminAuditLog: {
    create: AsyncMock;
    findMany: AsyncMock;
  };
  $transaction: AsyncMock;
};

jest.mock('../prisma', () => {
  const __mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: typeof __mockPrisma) => unknown) =>
      fn(__mockPrisma),
    ),
  };

  return {
    __esModule: true,
    __mockPrisma,
    createPrismaClient: jest.fn(() => __mockPrisma),
    PrismaClient: jest.fn(),
  };
});

jest.mock('./EmailService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../helpers/ApiTokens', () => ({
  __esModule: true,
  default: {
    generateEmailVerificationToken: jest.fn(),
  },
}));

const mockPrisma = require('../prisma').__mockPrisma as MockPrismaClient;

const ACTOR_ID = 'actor-1';
const TARGET_ID = 'target-1';

type IdentityUser = {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: null;
  email: string;
  role: 'user' | 'platform_admin';
  disabled: boolean;
  email_verification_timestamp: null;
};

const identityUser: IdentityUser = {
  id: TARGET_ID,
  name: 'Target User',
  first_name: 'Target',
  last_name: 'User',
  phone: null,
  email: 'target@example.com',
  role: 'user',
  disabled: false,
  email_verification_timestamp: null,
};

const fullUser = {
  id: TARGET_ID,
  email: 'target@example.com',
  name: 'Target User',
  email_verification_timestamp: null,
  email_verification_token: null,
};

function mockIdentityLookup(user: IdentityUser | null = identityUser) {
  mockPrisma.user.findUnique.mockImplementation(
    ({ select }: { select?: unknown }) => {
      if (select) {
        return Promise.resolve(user);
      }
      return Promise.resolve(user ? fullUser : null);
    },
  );
}

describe('UserService lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: MockPrismaClient) => unknown) => fn(mockPrisma),
    );
  });

  describe('disableUser', () => {
    test('sets disabled and sessions_invalidated_at and writes disable audit', async () => {
      mockIdentityLookup();
      const updated = { ...identityUser, disabled: true };
      mockPrisma.user.update.mockResolvedValue(updated);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.disableUser(ACTOR_ID, TARGET_ID);

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: {
          disabled: true,
          sessions_invalidated_at: expect.any(Date),
        },
        select: expect.objectContaining({ id: true, disabled: true }),
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'disable',
        },
      });
    });

    test('throws UserNotFoundError when target is missing', async () => {
      mockIdentityLookup(null);

      await expect(
        userService.disableUser(ACTOR_ID, TARGET_ID),
      ).rejects.toThrow(UserNotFoundError);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('enableUser', () => {
    test('clears disabled flag without touching sessions_invalidated_at', async () => {
      mockIdentityLookup({ ...identityUser, disabled: true });
      const updated = { ...identityUser, disabled: false };
      mockPrisma.user.update.mockResolvedValue(updated);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.enableUser(ACTOR_ID, TARGET_ID);

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { disabled: false },
        select: expect.objectContaining({ id: true, disabled: true }),
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'enable',
        },
      });
    });
  });

  describe('forceLogoutUser', () => {
    test('sets sessions_invalidated_at without disabling the account', async () => {
      mockIdentityLookup();
      mockPrisma.user.update.mockResolvedValue(identityUser);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.forceLogoutUser(ACTOR_ID, TARGET_ID);

      expect(result).toEqual(identityUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { sessions_invalidated_at: expect.any(Date) },
        select: expect.objectContaining({ id: true, disabled: true }),
      });
      expect(
        (
          mockPrisma.user.update.mock.calls[0][0] as {
            data: Record<string, unknown>;
          }
        ).data,
      ).not.toHaveProperty('disabled');
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'force_logout',
        },
      });
    });
  });

  describe('promoteUser', () => {
    test('promotes a user to platform_admin and writes promote audit', async () => {
      mockIdentityLookup();
      const promoted = { ...identityUser, role: 'platform_admin' as const };
      mockPrisma.user.update.mockResolvedValue(promoted);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.promoteUser(ACTOR_ID, TARGET_ID);

      expect(result).toEqual(promoted);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { role: 'platform_admin' },
        select: expect.objectContaining({ role: true }),
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'promote',
        },
      });
    });
  });

  describe('demoteUser', () => {
    test('demotes platform_admin when more than one admin exists', async () => {
      mockIdentityLookup({ ...identityUser, role: 'platform_admin' });
      mockPrisma.user.count.mockResolvedValue(2);
      const demoted = { ...identityUser, role: 'user' as const };
      mockPrisma.user.update.mockResolvedValue(demoted);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.demoteUser(ACTOR_ID, TARGET_ID);

      expect(result).toEqual(demoted);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { role: 'platform_admin' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { role: 'user' },
        select: expect.objectContaining({ role: true }),
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'demote',
        },
      });
    });

    test('throws LastPlatformAdminError when target is the last platform admin', async () => {
      mockIdentityLookup({ ...identityUser, role: 'platform_admin' });
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(userService.demoteUser(ACTOR_ID, TARGET_ID)).rejects.toThrow(
        LastPlatformAdminError,
      );

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.adminAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('adminResendVerification', () => {
    test('stores verification token and writes resend_verification audit on success', async () => {
      mockIdentityLookup();
      const sendSpy = jest
        .spyOn(userService, 'sendVerificationMail')
        .mockResolvedValue('new-verification-token');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await userService.adminResendVerification(
        ACTOR_ID,
        TARGET_ID,
      );

      expect(result).toEqual(identityUser);
      expect(sendSpy).toHaveBeenCalledWith(fullUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        data: { email_verification_token: 'new-verification-token' },
      });
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'resend_verification',
        },
      });

      sendSpy.mockRestore();
    });

    test('throws VerificationCooldownError and skips audit when email was sent recently', async () => {
      mockIdentityLookup();
      const sendSpy = jest
        .spyOn(userService, 'sendVerificationMail')
        .mockResolvedValue(
          new Error('Verification email already sent recently'),
        );

      await expect(
        userService.adminResendVerification(ACTOR_ID, TARGET_ID),
      ).rejects.toThrow(VerificationCooldownError);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.adminAuditLog.create).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    test('throws EmailAlreadyVerifiedError and skips audit when already verified', async () => {
      mockIdentityLookup();
      const sendSpy = jest
        .spyOn(userService, 'sendVerificationMail')
        .mockResolvedValue(new Error('Email already verified'));

      await expect(
        userService.adminResendVerification(ACTOR_ID, TARGET_ID),
      ).rejects.toThrow(EmailAlreadyVerifiedError);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.adminAuditLog.create).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });
  });

  describe('listAdminAuditLogs', () => {
    test('returns newest-first rows and clamps limit between 1 and 200', async () => {
      const rows = [
        {
          id: 'log-2',
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'disable',
          created_at: new Date('2025-06-02T00:00:00.000Z'),
        },
        {
          id: 'log-1',
          actor_user_id: ACTOR_ID,
          target_user_id: TARGET_ID,
          action: 'enable',
          created_at: new Date('2025-06-01T00:00:00.000Z'),
        },
      ];
      mockPrisma.adminAuditLog.findMany.mockResolvedValue(rows);

      const result = await userService.listAdminAuditLogs(500);

      expect(result).toEqual(rows);
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        take: 200,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          actor_user_id: true,
          target_user_id: true,
          action: true,
          created_at: true,
        },
      });

      mockPrisma.adminAuditLog.findMany.mockClear();
      await userService.listAdminAuditLogs(0);
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });
  });
});
