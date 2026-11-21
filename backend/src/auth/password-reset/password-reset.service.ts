
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../dto/reset-password.dto.js';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericResponse = {
      message:
        'If an account exists for this email, password reset instructions will be sent.',
    };

    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    // Do not reveal whether an account exists or is active.
    if (!user || user.status !== 'ACTIVE') {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiryMinutes = Math.min(
      60,
      Math.max(
        1,
        Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || 15),
      ),
    );

    const expiresAt = new Date(
      Date.now() + expiryMinutes * 60 * 1000,
    );

    // Invalidate previous outstanding reset tokens and create a new one.
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });

      this.logger.error('FRONTEND_URL is not configured.');
      return genericResponse;
    }

    const resetUrl = new URL(
      '/reset-password',
      frontendUrl,
    );

    resetUrl.searchParams.set('token', rawToken);

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        resetUrl.toString(),
      );
    } catch {
      // Do not leave an unusable token active if email delivery fails.
      await this.prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      });

      this.logger.error('Password reset email delivery failed.');
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Conditional update ensures the token can only be consumed once,
        // including when two requests attempt to use it concurrently.
        const consumed = await tx.passwordResetToken.updateMany({
          where: {
            tokenHash,
            usedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            usedAt: now,
          },
        });

        if (consumed.count !== 1) {
          throw new BadRequestException(
            'Invalid or expired password reset link.',
          );
        }

        const resetToken = await tx.passwordResetToken.findUnique({
          where: { tokenHash },
          select: { userId: true },
        });

        if (!resetToken) {
          throw new BadRequestException(
            'Invalid or expired password reset link.',
          );
        }

        const updated = await tx.user.updateMany({
          where: {
            id: resetToken.userId,
            status: 'ACTIVE',
          },
          data: {
            passwordHash,
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            'Unable to reset this account password.',
          );
        }

        // Invalidate every other outstanding reset token for this user.
        await tx.passwordResetToken.updateMany({
          where: {
            userId: resetToken.userId,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        });
      });

      return {
        message: 'Password successfully reset. You can now log in.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        'Password reset operation failed.',
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
