import nodemailer from 'nodemailer';
import winston from 'winston';
import sendEmail, { EmailMessage, MailAttachment } from './EmailService';

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({ error: jest.fn(), info: jest.fn() })),
  format: { json: jest.fn(() => ({})) },
  transports: { Console: jest.fn() },
}));

jest.mock('nodemailer');

const mockNodemailer = jest.mocked(nodemailer);
// EmailService builds its logger once at module load; grab that instance here.
const mockLogger = jest.mocked(winston.createLogger).mock.results[0].value;

describe('EmailService', () => {
  let mockSendMail: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nodemailer's Transporter has 25+ internal fields irrelevant to this mock
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up env vars for SMTP provider
    process.env.MAIL_HOST = 'localhost';
    process.env.MAIL_PORT = '1025';
    delete process.env.MAIL_USERNAME;
    delete process.env.MAIL_PASSWORD;
    process.env.MAIL_SECURE = 'false';
    process.env.EMAIL_SENDER = 'noreply@example.com';
    process.env.DEFAULT_EMAIL_PROVIDER = 'smtp';

    // Mock transporter and sendMail
    mockSendMail = jest.fn((mailOptions, callback) => {
      // Call callback synchronously with success response
      callback(null, { response: 'OK' });
    });

    mockTransporter = {
      sendMail: mockSendMail,
    };

    mockNodemailer.createTransport.mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_PORT;
    delete process.env.MAIL_USERNAME;
    delete process.env.MAIL_PASSWORD;
    delete process.env.MAIL_SECURE;
    delete process.env.EMAIL_SENDER;
    delete process.env.DEFAULT_EMAIL_PROVIDER;
  });

  describe('sendEmail with plain-text and html', () => {
    it('should send email with both html and text parts', async () => {
      const message: EmailMessage = {
        html: '<h1>Welcome</h1>',
        text: 'Welcome',
      };

      await sendEmail('user@example.com', 'Welcome', message);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toBe('<h1>Welcome</h1>');
      expect(mailOptions.text).toBe('Welcome');
      expect(mailOptions.to).toBe('user@example.com');
      expect(mailOptions.subject).toBe('Welcome');
      expect(mailOptions.from).toBe('noreply@example.com');
    });

    it('should not include attachments field when none are provided', async () => {
      const message: EmailMessage = {
        html: '<h1>Welcome</h1>',
        text: 'Welcome',
      };

      await sendEmail('user@example.com', 'Welcome', message);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.attachments).toBeUndefined();
    });
  });

  describe('sendEmail attachment pass-through', () => {
    it('should pass through single attachment to nodemailer unchanged', async () => {
      const attachment: MailAttachment = {
        filename: 'logo.png',
        content: Buffer.from('fake-png-data'),
        cid: 'company-logo',
      };

      const message: EmailMessage = {
        html: '<img src="cid:company-logo" alt="Logo" />',
        text: 'Logo image',
        attachments: [attachment],
      };

      await sendEmail('user@example.com', 'Test', message);

      const mailOptions = mockSendMail.mock.calls[0][0];
      // Verify the sender forwards html, text, and attachments unchanged.
      expect(mailOptions.html).toBe(message.html);
      expect(mailOptions.text).toBe(message.text);
      expect(mailOptions.attachments).toEqual(message.attachments);
      // CID linkage invariant (every attachment referenced, every reference attached)
      // is owned by the shell, not the sender. See assertCidLinkage in email-shell.
    });

    it('should pass through multiple attachments to nodemailer unchanged', async () => {
      const attachments: MailAttachment[] = [
        {
          filename: 'logo.png',
          content: Buffer.from('logo-data'),
          cid: 'logo',
        },
        {
          filename: 'footer.jpg',
          content: Buffer.from('footer-data'),
          cid: 'footer',
        },
      ];

      const message: EmailMessage = {
        html: '<img src="cid:logo" /><img src="cid:footer" />',
        text: 'Multi-attachment email',
        attachments,
      };

      await sendEmail('user@example.com', 'Test', message);

      const mailOptions = mockSendMail.mock.calls[0][0];
      // Verify the sender forwards html, text, and attachments unchanged.
      expect(mailOptions.html).toBe(message.html);
      expect(mailOptions.text).toBe(message.text);
      expect(mailOptions.attachments).toEqual(message.attachments);
    });
  });

  describe('sendEmail with recipient addressing', () => {
    it('should handle single recipient as string', async () => {
      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      await sendEmail('single@example.com', 'Subject', message);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe('single@example.com');
    });

    it('should join multiple recipients with comma', async () => {
      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      await sendEmail(
        ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        'Subject',
        message,
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe(
        'user1@example.com,user2@example.com,user3@example.com',
      );
    });
  });

  describe('sendEmail integration', () => {
    it('should create transport once per invocation and send mail', async () => {
      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      await sendEmail('user@example.com', 'Subject', message);

      expect(mockNodemailer.createTransport).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('should use configured email sender', async () => {
      process.env.EMAIL_SENDER = 'custom-sender@example.com';

      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      await sendEmail('user@example.com', 'Subject', message);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('custom-sender@example.com');
    });
  });

  describe('sendEmail SMTP auth configuration', () => {
    it('should construct transport with auth: undefined when credentials are not set', async () => {
      // beforeEach deletes MAIL_USERNAME and MAIL_PASSWORD via delete (not = undefined)
      // so they should be undefined, and auth should be omitted or undefined
      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      await sendEmail('user@example.com', 'Subject', message);

      const createTransportCall = mockNodemailer.createTransport.mock
        .calls[0][0] as Record<string, unknown>;
      expect(createTransportCall.auth).toBeUndefined();
    });
  });

  describe('sendEmail delivery failure', () => {
    it('should resolve successfully even when transporter callback receives an error', async () => {
      // This test pins current behavior: sendEmail resolves (does not reject)
      // when the underlying transporter.sendMail callback reports a delivery error.
      // See issue #409.
      const deliveryError = new Error('SMTP connection failed');
      mockSendMail = jest.fn((mailOptions, callback) => {
        // Simulate a delivery failure by calling callback with an error
        callback(deliveryError, null);
      });

      mockTransporter = {
        sendMail: mockSendMail,
      };

      mockNodemailer.createTransport.mockReturnValue(mockTransporter);

      const message: EmailMessage = {
        html: '<p>Test</p>',
        text: 'Test',
      };

      // This should not throw or reject, even though the callback received an error
      await expect(
        sendEmail('user@example.com', 'Subject', message),
      ).resolves.toBeUndefined();

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(deliveryError);
    });
  });
});
