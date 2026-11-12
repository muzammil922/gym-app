import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class WorkoutsService {
  constructor(private prisma: PrismaService) {}

  // Exercises
  async listExercises(user: AuthUser, page = 1, limit = 50, search?: string) {
    const p = paginate(page, limit);
    const where: Prisma.ExerciseWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
      isActive: true,
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.exercise.findMany({ where, skip: p.skip, take: p.take, orderBy: { name: 'asc' } }),
      this.prisma.exercise.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }

  createExercise(
    user: AuthUser,
    data: {
      name: string;
      category?: string;
      muscleGroup?: string;
      equipment?: string;
      instructions?: string;
      videoUrl?: string;
    },
  ) {
    return this.prisma.exercise.create({
      data: { gymId: user.gymId, ...data },
    });
  }

  // Plans
  async listPlans(user: AuthUser, page = 1, limit = 20) {
    const p = paginate(page, limit);
    const where = { gymId: user.gymId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.workoutPlan.findMany({
        where,
        skip: p.skip,
        take: p.take,
        include: { days: { orderBy: { dayNumber: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workoutPlan.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }

  createPlan(
    user: AuthUser,
    data: {
      name: string;
      description?: string;
      difficulty?: string;
      durationWeeks?: number;
      days?: Array<{ dayNumber: number; name: string; exercises: unknown; notes?: string }>;
    },
  ) {
    return this.prisma.workoutPlan.create({
      data: {
        gymId: user.gymId,
        name: data.name,
        description: data.description,
        difficulty: data.difficulty,
        durationWeeks: data.durationWeeks,
        days: data.days
          ? {
              create: data.days.map((d) => ({
                gymId: user.gymId,
                dayNumber: d.dayNumber,
                name: d.name,
                exercises: d.exercises as Prisma.InputJsonValue,
                notes: d.notes,
              })),
            }
          : undefined,
      },
      include: { days: true },
    });
  }

  async updatePlan(
    user: AuthUser,
    id: string,
    data: {
      name?: string;
      description?: string;
      difficulty?: string;
      durationWeeks?: number;
      days?: Array<{ dayNumber: number; name: string; exercises: unknown; notes?: string }>;
    },
  ) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');

    return this.prisma.$transaction(async (tx) => {
      if (data.days) {
        await tx.workoutPlanDay.deleteMany({ where: { workoutPlanId: id } });
        await tx.workoutPlanDay.createMany({
          data: data.days.map((d) => ({
            gymId: user.gymId,
            workoutPlanId: id,
            dayNumber: d.dayNumber,
            name: d.name,
            exercises: d.exercises as Prisma.InputJsonValue,
            notes: d.notes,
          })),
        });
      }
      return tx.workoutPlan.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          difficulty: data.difficulty,
          durationWeeks: data.durationWeeks,
        },
        include: { days: { orderBy: { dayNumber: 'asc' } } },
      });
    });
  }

  async assign(
    user: AuthUser,
    data: {
      memberId: string;
      workoutPlanId: string;
      startDate: string;
      endDate?: string;
    },
  ) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id: data.workoutPlanId, gymId: user.gymId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return this.prisma.workoutAssignment.create({
      data: {
        gymId: user.gymId,
        memberId: data.memberId,
        workoutPlanId: data.workoutPlanId,
        assignedById: user.staffId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: { workoutPlan: { include: { days: true } } },
    });
  }

  async logWorkout(
    user: AuthUser,
    data: {
      memberId: string;
      assignmentId?: string;
      exercises: unknown;
      durationMin?: number;
      notes?: string;
      loggedAt?: string;
    },
  ) {
    const memberId =
      user.role === Role.MEMBER ? user.memberId || data.memberId : data.memberId;
    return this.prisma.workoutLog.create({
      data: {
        gymId: user.gymId,
        memberId,
        assignmentId: data.assignmentId,
        exercises: data.exercises as Prisma.InputJsonValue,
        durationMin: data.durationMin,
        notes: data.notes,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      },
    });
  }

  async streak(user: AuthUser, memberId: string) {
    if (user.role === Role.MEMBER) memberId = user.memberId || memberId;
    const logs = await this.prisma.workoutLog.findMany({
      where: { gymId: user.gymId, memberId },
      orderBy: { loggedAt: 'desc' },
      take: 90,
      select: { loggedAt: true },
    });
    const days = new Set(logs.map((l) => l.loggedAt.toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return { memberId, streak, totalLogs: logs.length };
  }

  async memberLogs(user: AuthUser, memberId: string, page = 1, limit = 20) {
    if (user.role === Role.MEMBER) memberId = user.memberId || memberId;
    const p = paginate(page, limit);
    const where = { gymId: user.gymId, memberId };
    const [data, total] = await Promise.all([
      this.prisma.workoutLog.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.workoutLog.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }
}
