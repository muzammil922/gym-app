import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async list(user: AuthUser, page = 1, limit = 20, search?: string, role?: string) {
    const p = paginate(page, limit);
    const where: Prisma.StaffWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
    };
    if (role) where.role = role as Role;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true } } },
      }),
      this.prisma.staff.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }

  async create(
    user: AuthUser,
    data: {
      fullName: string;
      phone: string;
      email?: string;
      role: Role;
      salaryAmount?: number;
      password?: string;
      staffCode?: string;
      createLogin?: boolean;
    },
  ) {
    const allowed: Role[] = [Role.MANAGER, Role.TRAINER, Role.RECEPTIONIST, Role.OWNER];
    if (!allowed.includes(data.role)) {
      throw new BadRequestException('Invalid staff role');
    }
    const count = await this.prisma.staff.count({ where: { gymId: user.gymId } });
    const staffCode = data.staffCode || `S${String(count + 1).padStart(4, '0')}`;
    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);

    return this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      if (data.createLogin !== false) {
        const passwordHash = await bcrypt.hash(
          data.password || 'Staff@12345',
          rounds,
        );
        const u = await tx.user.create({
          data: {
            gymId: user.gymId,
            phone: data.phone,
            passwordHash,
            fullName: data.fullName,
            email: data.email,
            role: data.role,
          },
        });
        userId = u.id;
      }
      return tx.staff.create({
        data: {
          gymId: user.gymId,
          userId,
          staffCode,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          role: data.role,
          salaryAmount: data.salaryAmount,
          hireDate: new Date(),
        },
      });
    });
  }

  async update(user: AuthUser, id: string, data: Partial<{
    fullName: string;
    email: string;
    salaryAmount: number;
    isActive: boolean;
    notes: string;
  }>) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return this.prisma.staff.update({ where: { id }, data });
  }

  async softDelete(user: AuthUser, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return this.prisma.staff.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async assignTrainer(user: AuthUser, memberId: string, trainerStaffId: string | null) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId: user.gymId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (trainerStaffId) {
      const trainer = await this.prisma.staff.findFirst({
        where: {
          id: trainerStaffId,
          gymId: user.gymId,
          role: Role.TRAINER,
          deletedAt: null,
        },
      });
      if (!trainer) throw new NotFoundException('Trainer not found');
    }
    return this.prisma.member.update({
      where: { id: memberId },
      data: { trainerStaffId },
    });
  }

  async upsertSalary(
    user: AuthUser,
    data: {
      staffId: string;
      periodMonth: number;
      periodYear: number;
      amount: number;
      paidAmount?: number;
      status?: string;
      notes?: string;
    },
  ) {
    return this.prisma.staffSalary.upsert({
      where: {
        gymId_staffId_periodMonth_periodYear: {
          gymId: user.gymId,
          staffId: data.staffId,
          periodMonth: data.periodMonth,
          periodYear: data.periodYear,
        },
      },
      create: {
        gymId: user.gymId,
        staffId: data.staffId,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        amount: data.amount,
        paidAmount: data.paidAmount || 0,
        status: data.status || 'PENDING',
        notes: data.notes,
        paidAt: data.status === 'PAID' ? new Date() : undefined,
      },
      update: {
        amount: data.amount,
        paidAmount: data.paidAmount,
        status: data.status,
        notes: data.notes,
        paidAt: data.status === 'PAID' ? new Date() : undefined,
      },
    });
  }

  async listSalaries(user: AuthUser, year?: number, month?: number) {
    const where: Prisma.StaffSalaryWhereInput = { gymId: user.gymId };
    if (year) where.periodYear = year;
    if (month) where.periodMonth = month;
    return this.prisma.staffSalary.findMany({
      where,
      include: { staff: { select: { id: true, fullName: true, staffCode: true } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async listAttendance(user: AuthUser, date?: string, from?: string, to?: string) {
    const where: Prisma.StaffAttendanceWhereInput = { gymId: user.gymId };
    if (date) {
      const day = date.slice(0, 10);
      where.date = new Date(`${day}T00:00:00.000Z`);
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from.slice(0, 10));
      if (to) where.date.lte = new Date(to.slice(0, 10));
    }
    const rows = await this.prisma.staffAttendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { checkInAt: 'desc' }],
      include: { staff: { select: { id: true, fullName: true, staffCode: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff.fullName,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      checkInAt: r.checkInAt?.toISOString(),
      checkOutAt: r.checkOutAt?.toISOString(),
    }));
  }

  async markAttendance(
    user: AuthUser,
    data: {
      staffId: string;
      date: string;
      status?: string;
      checkInAt?: string;
      checkOutAt?: string;
    },
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, gymId: user.gymId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const day = new Date(`${data.date.slice(0, 10)}T00:00:00.000Z`);
    const record = await this.prisma.staffAttendance.upsert({
      where: {
        gymId_staffId_date: {
          gymId: user.gymId,
          staffId: data.staffId,
          date: day,
        },
      },
      create: {
        gymId: user.gymId,
        staffId: data.staffId,
        date: day,
        status: (data.status ?? 'present').toLowerCase(),
        checkInAt: data.checkInAt ? new Date(data.checkInAt) : undefined,
        checkOutAt: data.checkOutAt ? new Date(data.checkOutAt) : undefined,
      },
      update: {
        status: data.status ? data.status.toLowerCase() : undefined,
        checkInAt: data.checkInAt ? new Date(data.checkInAt) : undefined,
        checkOutAt: data.checkOutAt ? new Date(data.checkOutAt) : undefined,
      },
      include: { staff: { select: { fullName: true } } },
    });
    return {
      id: record.id,
      staffId: record.staffId,
      staffName: record.staff.fullName,
      date: record.date.toISOString().slice(0, 10),
      status: record.status,
      checkInAt: record.checkInAt?.toISOString(),
      checkOutAt: record.checkOutAt?.toISOString(),
    };
  }

  /** @deprecated Prefer GET /staff/attendance */
  async staffAttendanceSummary(user: AuthUser, from?: string, to?: string) {
    return this.listAttendance(user, undefined, from, to);
  }
}
