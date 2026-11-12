import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    gymId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        gymId: params.gymId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before as Prisma.InputJsonValue,
        after: params.after as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}
