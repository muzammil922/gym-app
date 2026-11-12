import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(user: AuthUser, page = 1, limit = 20) {
    const p = paginate(page, limit);
    const where = {
      gymId: user.gymId,
      OR: [{ userId: null }, { userId: user.id }],
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    const data = rows.map((n) => this.mapNotification(n));
    return paginatedResponse(data, total, p.page, p.limit);
  }

  async markRead(user: AuthUser, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: {
        id,
        gymId: user.gymId,
        OR: [{ userId: null }, { userId: user.id }],
      },
    });
    if (!row) throw new NotFoundException('Notification not found');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return this.mapNotification(updated);
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: {
        gymId: user.gymId,
        isRead: false,
        OR: [{ userId: null }, { userId: user.id }],
      },
      data: { isRead: true },
    });
    return { ok: true };
  }

  private mapNotification(n: {
    id: string;
    title: string;
    body: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: Date;
    data: unknown;
  }) {
    const data =
      n.data && typeof n.data === 'object' && !Array.isArray(n.data)
        ? Object.fromEntries(
            Object.entries(n.data as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v),
            ]),
          )
        : undefined;
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      type: this.mapType(n.type),
      read: n.isRead,
      createdAt: n.createdAt.toISOString(),
      data,
    };
  }

  private mapType(type: NotificationType): string {
    switch (type) {
      case NotificationType.WARNING:
        return 'expiry';
      case NotificationType.ALERT:
        return 'payment';
      case NotificationType.SYSTEM:
        return 'system';
      default:
        return 'attendance';
    }
  }
}
