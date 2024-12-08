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
  auth: {
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
    smtp: () =>
      new EmailService({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT as unknown as number,
        auth: {
          user: process.env.MAIL_USERNAME,
          pass: process.env.MAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }),
  };

  const defaultEmailProvider =
    process.env.DEFAULT_EMAIL_PROVIDER?.toLowerCase() || 'mailtrap';

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
