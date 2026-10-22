import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PatientsModule } from './patients/patients.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PatientsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
