import { Injectable, NotFoundException } from '@nestjs/common';
import { DietMealType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DietService {
  constructor(private prisma: PrismaService) {}

  async listTemplates(user: AuthUser, page = 1, limit = 20, search?: string) {
    const p = paginate(page, limit);
    const where: Prisma.DietTemplateWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.dietTemplate.findMany({
        where,
        skip: p.skip,
        take: p.take,
        include: { meals: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dietTemplate.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }

  async createTemplate(
    user: AuthUser,
    data: {
      name: string;
      description?: string;
      calories?: number;
      meals?: Array<{
        mealType: string;
        dayOfWeek?: number;
        title: string;
        foods: string;
        calories?: number;
        proteinG?: number;
        carbsG?: number;
        fatsG?: number;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.prisma.dietTemplate.create({
      data: {
        gymId: user.gymId,
        name: data.name,
        description: data.description,
        calories: data.calories,
        meals: data.meals
          ? {
              create: data.meals.map((m, i) => ({
                gymId: user.gymId,
                mealType: m.mealType as DietMealType,
                dayOfWeek: m.dayOfWeek,
                title: m.title,
                foods: m.foods,
                calories: m.calories,
                proteinG: m.proteinG,
                carbsG: m.carbsG,
                fatsG: m.fatsG,
                sortOrder: m.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: { meals: true },
    });
  }

  async assign(
    user: AuthUser,
    data: {
      memberId: string;
      templateId: string;
      startDate: string;
      endDate?: string;
      notes?: string;
      rebuildDays?: number;
    },
  ) {
    const template = await this.prisma.dietTemplate.findFirst({
      where: { id: data.templateId, gymId: user.gymId, deletedAt: null },
      include: { meals: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    const assignment = await this.prisma.dietAssignment.create({
      data: {
        gymId: user.gymId,
        memberId: data.memberId,
        templateId: data.templateId,
        assignedBy: user.staffId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
      },
    });

    await this.rebuildSchedule(
      user.gymId,
      assignment.id,
      data.memberId,
      template.meals,
      new Date(data.startDate),
      data.rebuildDays ?? 14,
    );

    return this.prisma.dietAssignment.findUnique({
      where: { id: assignment.id },
      include: { template: true, schedules: { take: 50 } },
    });
  }

  async rebuildSchedule(
    gymId: string,
    assignmentId: string,
    memberId: string,
    meals: Array<{
      mealType: DietMealType;
      dayOfWeek: number | null;
      title: string;
      foods: string;
      calories: number | null;
    }>,
    startDate: Date,
    days: number,
  ) {
    await this.prisma.memberDietSchedule.deleteMany({
      where: { assignmentId, scheduleDate: { gte: startDate } },
    });

    const rows: Prisma.MemberDietScheduleCreateManyInput[] = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + d);
      const dow = date.getUTCDay();
      const dayMeals = meals.filter(
        (m) => m.dayOfWeek === null || m.dayOfWeek === undefined || m.dayOfWeek === dow,
      );
      for (const meal of dayMeals) {
        rows.push({
          gymId,
          memberId,
          assignmentId,
          scheduleDate: date,
          mealType: meal.mealType,
          title: meal.title,
          foods: meal.foods,
          calories: meal.calories ?? undefined,
        });
      }
    }
    if (rows.length) {
      await this.prisma.memberDietSchedule.createMany({ data: rows });
    }
    return { created: rows.length };
  }

  async memberSchedule(user: AuthUser, memberId: string, from?: string, to?: string) {
    if (user.role === Role.MEMBER) memberId = user.memberId || memberId;
    const where: Prisma.MemberDietScheduleWhereInput = {
      gymId: user.gymId,
      memberId,
    };
    if (from || to) {
      where.scheduleDate = {};
      if (from) where.scheduleDate.gte = new Date(from);
      if (to) where.scheduleDate.lte = new Date(to);
    }
    return this.prisma.memberDietSchedule.findMany({
      where,
      orderBy: [{ scheduleDate: 'asc' }, { mealType: 'asc' }],
    });
  }

  async deleteTemplate(user: AuthUser, id: string) {
    const template = await this.prisma.dietTemplate.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.dietTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { success: true };
  }

  async deleteAssignment(user: AuthUser, id: string) {
    const assignment = await this.prisma.dietAssignment.findFirst({
      where: { id, gymId: user.gymId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.$transaction([
      this.prisma.memberDietSchedule.deleteMany({ where: { assignmentId: id } }),
      this.prisma.dietAssignment.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async markComplete(user: AuthUser, scheduleId: string, completed = true) {
    const row = await this.prisma.memberDietSchedule.findFirst({
      where: { id: scheduleId, gymId: user.gymId },
    });
    if (!row) throw new NotFoundException();
    if (user.role === Role.MEMBER && row.memberId !== user.memberId) {
      throw new NotFoundException();
    }
    return this.prisma.memberDietSchedule.update({
      where: { id: scheduleId },
      data: { completed },
    });
  }
}
