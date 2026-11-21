
import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from './roles/roles.guard.js';
import { Roles } from './roles/roles.decorator.js';

import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PasswordResetService } from './password-reset/password-reset.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
forgotPassword(@Body() dto: ForgotPasswordDto) {
  return this.passwordResetService.forgotPassword(dto);
}

@Post('reset-password')
resetPassword(@Body() dto: ResetPasswordDto) {
  return this.passwordResetService.resetPassword(dto);
}
}
