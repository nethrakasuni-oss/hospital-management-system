import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    const channel = dto.channel ?? 'IN_APP';
    if (channel === 'IN_APP' && dto.userId === undefined) throw new BadRequestException('userId is required for in-app notifications');
    if (channel === 'EMAIL' && !dto.recipientEmail) throw new BadRequestException('recipientEmail is required for email notifications');
    if (channel === 'SMS' && !dto.recipientPhone) throw new BadRequestException('recipientPhone is required for SMS notifications');
    if (dto.userId !== undefined) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
      if (!user) throw new NotFoundException('Notification recipient user not found');
    }
    const inApp = channel === 'IN_APP';
    return this.prisma.notification.create({
      data: {
        title: dto.title.trim(),
        message: dto.message.trim(),
        type: (dto.type ?? 'SYSTEM') as never,
        channel: channel as never,
        status: (inApp ? 'SENT' : 'PENDING') as never,
        ...(inApp ? { sentAt: new Date() } : {}),
        userId: dto.userId ?? null,
        recipientEmail: dto.recipientEmail?.trim().toLowerCase() ?? null,
        recipientPhone: dto.recipientPhone?.trim() ?? null,
        metadata: dto.metadata === undefined ? Prisma.JsonNull : dto.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: NotificationQueryDto, userId: number, canViewAll: boolean) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.NotificationWhereInput = {
      ...(canViewAll ? {} : { userId }),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.channel ? { channel: query.channel as never } : {}),
      ...(query.type ? { type: query.type as never } : {}),
    };
    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...(canViewAll ? {} : { userId }), channel: 'IN_APP', status: { not: 'READ' } } }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, unreadCount };
  }

  async findOne(id: number, userId: number, canViewAll: boolean) {
    const item = await this.prisma.notification.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Notification not found');
    if (!canViewAll && item.userId !== userId) throw new ForbiddenException('You cannot access this notification');
    return item;
  }

  async markRead(id: number, userId: number, canViewAll: boolean) {
    const item = await this.findOne(id, userId, canViewAll);
    if (item.channel !== 'IN_APP') throw new BadRequestException('Only in-app notifications can be marked as read');
    if (item.status === 'READ') return item;
    return this.prisma.notification.update({ where: { id }, data: { status: 'READ', readAt: new Date() } });
  }

  async markAllRead(userId: number) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { userId, channel: 'IN_APP', status: { not: 'READ' } },
      data: { status: 'READ', readAt: now },
    });
    return { updatedCount: result.count, readAt: now };
  }

  async unreadCount(userId: number) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, channel: 'IN_APP', status: { not: 'READ' } },
    });
    return { unreadCount };
  }

  async statistics() {
    const [total, pending, sent, read, failed, groups] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { status: 'PENDING' } }),
      this.prisma.notification.count({ where: { status: 'SENT' } }),
      this.prisma.notification.count({ where: { status: 'READ' } }),
      this.prisma.notification.count({ where: { status: 'FAILED' } }),
      this.prisma.notification.groupBy({ by: ['channel'], _count: { _all: true } }),
    ]);
    return { total, pending, sent, read, failed, byChannel: groups.map(x => ({ channel: x.channel, count: x._count._all })) };
  }
}
