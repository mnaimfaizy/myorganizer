import dotenv from 'dotenv';
import nodemailer, { SendMailOptions } from 'nodemailer';
import winston from 'winston';
dotenv.config();

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

interface EmailOptions {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    // do not fail on invalid certs
    rejectUnauthorized: boolean;
  };
}

class EmailService {
  private transporter: any;

  constructor(private options: EmailOptions) {
    this.transporter = nodemailer.createTransport(options);
  }

  public async sendMail(mailOptions: SendMailOptions): Promise<void> {
    await this.transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.error(error);
      } else {
        logger.info('Email sent: ' + info.response);
      }
    });
  }
}

const getEmailService = (): EmailService => {
  const emailProviders: { [key: string]: () => EmailService } = {
    gmail: () =>
      new EmailService({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USERNAME,
          pass: process.env.GMAIL_PASSWORD,
        },
      }),
    smtp: () => {
      const hostFromEnv = process.env.MAIL_HOST?.trim();
      const host =
        hostFromEnv ||
        (process.env.NODE_ENV === 'production' ? undefined : 'localhost');

      const portRaw = process.env.MAIL_PORT?.trim();
      const portFromEnv = portRaw ? Number.parseInt(portRaw, 10) : undefined;
      const port =
        Number.isFinite(portFromEnv) && portFromEnv
          ? portFromEnv
          : process.env.NODE_ENV === 'production'
          ? undefined
          : 1025;

      const secure = (process.env.MAIL_SECURE ?? '').toLowerCase() === 'true';

      const user = process.env.MAIL_USERNAME;
      const pass = process.env.MAIL_PASSWORD;
      const auth = user && pass ? { user, pass } : undefined;

      return new EmailService({
        host,
        port,
        secure,
        auth,
        tls: {
          rejectUnauthorized: false,
        },
      });
    },
  };

  const defaultEmailProvider =
    process.env.DEFAULT_EMAIL_PROVIDER?.toLowerCase() || 'smtp';

  if (!emailProviders[defaultEmailProvider]) {
    throw new Error(
      `Invalid email provider '${defaultEmailProvider}'. Supported providers are ${Object.keys(
        emailProviders
      ).join(', ')}`
    );
  }

  return emailProviders[defaultEmailProvider]();
};

const sendEmail = async (
  to: string | string[],
  subject: string,
  html: string
): Promise<void> => {
  const emailService = getEmailService();

  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to: Array.isArray(to) ? to.join(',') : to,
    subject: subject,
    html: html,
  };

  logger.info(`Sending mail to - ${to}`);
  await emailService.sendMail(mailOptions);
};

export default sendEmail;
