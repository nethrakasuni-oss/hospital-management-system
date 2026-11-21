
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy/jwt.strategy.js';

import { UsersModule } from '../users/users.module.js';
import { PermissionsGuard } from './permissions/permissions.guard.js';
import { EmailService } from './email/email.service.js';

import { PasswordResetService } from './password-reset/password-reset.service.js';
@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
    PermissionsGuard,
    EmailService,
    PasswordResetService,
  ],

  exports: [PermissionsGuard],
})
export class AuthModule {}
