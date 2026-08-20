import nodemailer from 'nodemailer';
import sendEmail, { EmailMessage, MailAttachment } from './EmailService';

jest.mock('nodemailer');

const mockNodemailer = jest.mocked(nodemailer);

describe('EmailService', () => {
  let mockSendMail: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nodemailer's Transporter has 25+ internal fields irrelevant to this mock
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up env vars for SMTP provider
    process.env.MAIL_HOST = 'localhost';
    process.env.MAIL_PORT = '1025';
    process.env.MAIL_USERNAME = undefined;
    process.env.MAIL_PASSWORD = undefined;
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

  describe('sendEmail with CID attachments', () => {
    it('should attach CID attachments and preserve html references', async () => {
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
      expect(mailOptions.attachments).toBeDefined();
      expect(mailOptions.attachments).toHaveLength(1);
      expect(mailOptions.attachments[0]).toEqual(attachment);
      expect(mailOptions.html).toContain('cid:company-logo');
    });

    it('should pass through multiple attachments', async () => {
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
      expect(mailOptions.attachments).toHaveLength(2);
      expect(mailOptions.attachments[0].cid).toBe('logo');
      expect(mailOptions.attachments[1].cid).toBe('footer');
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
});
