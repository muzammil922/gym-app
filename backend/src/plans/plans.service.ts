import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreatePlanDto, PlanQueryDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async list(user: AuthUser, query: PlanQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.PlanWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
    };
    if (query.activeOnly !== false) where.isActive = true;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    const [data, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.plan.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async get(user: AuthUser, id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  create(user: AuthUser, dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        gymId: user.gymId,
        name: dto.name,
        description: dto.description,
        durationDays: dto.durationDays,
        price: dto.price,
        features: dto.features as Prisma.InputJsonValue | undefined,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdatePlanDto) {
    await this.get(user, id);
    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        durationDays: dto.durationDays,
        price: dto.price,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        features: dto.features as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async softDelete(user: AuthUser, id: string) {
    await this.get(user, id);
    return this.prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
