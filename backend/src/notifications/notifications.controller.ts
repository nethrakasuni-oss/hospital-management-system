import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  create(@Body() dto: CreateNotificationDto) { return this.service.create(dto); }

  @Get()
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  findAll(@Query() query: NotificationQueryDto, @Req() req: any) {
    return this.service.findAll(query, req.user.userId, ['ADMIN','HR_MANAGER'].includes(req.user.role));
  }

  @Get('unread-count')
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  unreadCount(@Req() req: any) { return this.service.unreadCount(req.user.userId); }

  @Get('statistics/overview')
  @Roles('ADMIN','HR_MANAGER')
  statistics() { return this.service.statistics(); }

  @Get(':id')
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user.userId, ['ADMIN','HR_MANAGER'].includes(req.user.role));
  }

  @Patch(':id/read')
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.markRead(id, req.user.userId, ['ADMIN','HR_MANAGER'].includes(req.user.role));
  }

  @Patch('read-all')
  @Roles('ADMIN','HR_MANAGER','RECEPTIONIST','ACCOUNTANT','DOCTOR','NURSE')
  markAllRead(@Req() req: any) { return this.service.markAllRead(req.user.userId); }
}
