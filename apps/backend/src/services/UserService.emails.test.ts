jest.mock('../prisma', () => {
  const __mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  return {
    __esModule: true,
    __mockPrisma,
    createPrismaClient: jest.fn(() => __mockPrisma),
    PrismaClient: jest.fn(),
  };
});

jest.mock('./EmailService', () => {
  const __mockSendEmail = jest.fn(async () => undefined);
  return {
    __esModule: true,
    default: __mockSendEmail,
    __mockSendEmail,
  };
});

jest.mock('../helpers/ApiTokens', () => ({
  __esModule: true,
  default: {
    generateEmailVerificationToken: jest.fn(),
    generatePasswordResetToken: jest.fn(),
  },
}));

type EmailMessage = import('./EmailService').EmailMessage;
type User = import('../prisma').User;

const {
  EMAIL_LOGO_CID,
  collectCidReferences,
} = require('@myorganizer/email-shell');
const { colorPrimary } = require('@myorganizer/design-tokens');
const userService = require('./UserService').default;
const mockSendEmail = require('./EmailService').__mockSendEmail as jest.Mock;
const apiTokens = require('../helpers/ApiTokens').default as {
  generateEmailVerificationToken: jest.Mock;
  generatePasswordResetToken: jest.Mock;
};

function makeUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    email_verification_token: null,
    ...(overrides || {}),
  } as unknown as User;
}

async function sendVerificationAndCapture(
  frontendUrl = 'https://app.example.com',
): Promise<EmailMessage> {
  process.env.APP_FRONTEND_URL = frontendUrl;
  apiTokens.generateEmailVerificationToken.mockReturnValue('test-token-123');
  const user = makeUser();

  await userService.sendVerificationMail(user);

  const message = mockSendEmail.mock.calls[0][2] as EmailMessage;
  return message;
}

async function sendPasswordResetAndCapture(
  frontendUrl = 'https://app.example.com',
): Promise<EmailMessage> {
  process.env.APP_FRONTEND_URL = frontendUrl;
  apiTokens.generatePasswordResetToken.mockReturnValue('reset-token-456');
  const user = makeUser();

  await userService.sendPasswordResetMail(user);

  const message = mockSendEmail.mock.calls[0][2] as EmailMessage;
  return message;
}

describe('UserService emails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.APP_FRONTEND_URL;
  });

  describe('sendVerificationMail', () => {
    it('sends shell document with no Unsubscribe', async () => {
      const message = await sendVerificationAndCapture();

      expect(mockSendEmail).toHaveBeenCalled();
      expect(message.html).toMatch(/^<!doctype html>/i);
      expect(message.html).toContain('</html>');
      expect(message.html).not.toContain('Unsubscribe');
      expect(message.text).not.toContain('Unsubscribe:');
    });

    it('ships logo CID with linkage and text version', async () => {
      const message = await sendVerificationAndCapture();

      expect(message.attachments).toBeDefined();
      expect(message.attachments).toHaveLength(1);
      const attachment = message.attachments[0];
      expect(attachment.cid).toBe(EMAIL_LOGO_CID);
      expect(attachment.contentDisposition).toBe('inline');
      expect(attachment.contentType).toBe('image/png');
      expect(attachment.content).toBeInstanceOf(Buffer);
      if (Buffer.isBuffer(attachment.content)) {
        expect(attachment.content.length).toBeGreaterThan(0);
      }

      const referencedCids = collectCidReferences(message.html);
      const attachmentCids = message.attachments.map((a) => a.cid);
      expect(referencedCids).toEqual(attachmentCids);

      expect(typeof message.text).toBe('string');
      expect(message.text.length).toBeGreaterThan(0);
    });

    it('includes verify link and escapes URL params', async () => {
      const message = await sendVerificationAndCapture(
        'https://app.example.com/x?a=1&b="2"&c=3',
      );

      expect(message.text).toContain(
        'https://app.example.com/x?a=1&b="2"&c=3/verify/email?token=test-token-123',
      );
      expect(message.html).toContain('&amp;');
      expect(message.html).toContain('&quot;');
      expect(message.html).not.toContain('b="2"&c=3');
    });

    it('includes year in footer and uses design tokens', async () => {
      const message = await sendVerificationAndCapture();

      const currentYear = new Date().getFullYear();
      expect(message.html).toContain(`&copy; ${currentYear}`);
      expect(message.html).toContain(colorPrimary);
      expect(message.html).not.toContain('#007bff');
    });
  });

  describe('sendPasswordResetMail', () => {
    it('sends shell document with no Unsubscribe', async () => {
      const message = await sendPasswordResetAndCapture();

      expect(mockSendEmail).toHaveBeenCalled();
      expect(message.html).toMatch(/^<!doctype html>/i);
      expect(message.html).toContain('</html>');
      expect(message.html).not.toContain('Unsubscribe');
      expect(message.text).not.toContain('Unsubscribe:');
    });

    it('ships logo CID with linkage and text version', async () => {
      const message = await sendPasswordResetAndCapture();

      expect(message.attachments).toBeDefined();
      expect(message.attachments).toHaveLength(1);
      const attachment = message.attachments[0];
      expect(attachment.cid).toBe(EMAIL_LOGO_CID);
      expect(attachment.contentDisposition).toBe('inline');
      expect(attachment.contentType).toBe('image/png');
      expect(attachment.content).toBeInstanceOf(Buffer);
      if (Buffer.isBuffer(attachment.content)) {
        expect(attachment.content.length).toBeGreaterThan(0);
      }

      const referencedCids = collectCidReferences(message.html);
      const attachmentCids = message.attachments.map((a) => a.cid);
      expect(referencedCids).toEqual(attachmentCids);

      expect(typeof message.text).toBe('string');
      expect(message.text.length).toBeGreaterThan(0);
    });

    it('includes reset link and escapes URL params', async () => {
      const message = await sendPasswordResetAndCapture(
        'https://app.example.com/x?a=1&b="2"&c=3',
      );

      expect(message.text).toContain(
        'https://app.example.com/x?a=1&b="2"&c=3/reset/password?token=reset-token-456',
      );
      expect(message.html).toContain('&amp;');
      expect(message.html).toContain('&quot;');
      expect(message.html).not.toContain('b="2"&c=3');
    });

    it('includes year in footer and uses design tokens', async () => {
      const message = await sendPasswordResetAndCapture();

      const currentYear = new Date().getFullYear();
      expect(message.html).toContain(`&copy; ${currentYear}`);
      expect(message.html).toContain(colorPrimary);
      expect(message.html).not.toContain('#007bff');
    });
  });
});
