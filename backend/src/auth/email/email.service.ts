import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'in-v3.mailjet.com',
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
  ): Promise<void> {
    try {
      const sender = process.env.MAIL_FROM;

      if (!sender || !process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
        throw new Error('Mailjet SMTP environment variables are missing');
      }

      await this.transporter.sendMail({
        from: `"MediCore Hospital" <${sender}>`,
        to: email,
        subject: 'MediCore - Password Reset Request',
        text: [
          'You requested a password reset for your MediCore account.',
          '',
          `Reset your password using this link: ${resetUrl}`,
          '',
          'This link expires in 15 minutes.',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;color:#334155">
            <h2 style="color:#142b49">MediCore Hospital</h2>
            <h3>Password Reset Request</h3>
            <p>We received a request to reset your MediCore account password.</p>
            <p style="margin:30px 0">
              <a href="${resetUrl}"
                 style="background:#0f766e;color:white;padding:14px 24px;text-decoration:none;border-radius:8px">
                Reset My Password
              </a>
            </p>
            <p>This link expires in 15 minutes and can only be used once.</p>
            <p>If you did not request this, please ignore this email.</p>
            <hr />
            <small>MediCore Hospital Management System</small>
          </div>
        `,
      });

      this.logger.log('Password reset email successfully sent.');
    } catch (error) {
      this.logger.error(
        'Unable to send password reset email.',
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Unable to process the email request. Please try again later.',
      );
    }
  }
}
