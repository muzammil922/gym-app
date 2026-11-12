import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AuditAction,
  InvoiceStatus,
  MemberStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import {
  paginate,
  paginatedResponse,
} from '../common/dto/pagination.dto';
import {
  AddMemberDto,
  ChangePlanDto,
  CreateMemberDto,
  FreezeMemberDto,
  MemberQueryDto,
  RenewMemberDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { QUEUES } from '../queues/queue.constants';

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    @InjectQueue(QUEUES.DEVICE_SYNC) private deviceQueue: Queue,
    @InjectQueue(QUEUES.WHATSAPP) private waQueue: Queue,
  ) {}

  private scopeMemberFilter(user: AuthUser): Prisma.MemberWhereInput {
    if (user.role === Role.MEMBER) {
      return { id: user.memberId || '__none__' };
    }
    if (user.role === Role.TRAINER) {
      return { trainerStaffId: user.staffId || '__none__' };
    }
    return {};
  }

  async list(user: AuthUser, query: MemberQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.MemberWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
      ...this.scopeMemberFilter(user),
    };
    if (query.status) where.status = query.status as MemberStatus;
    if (query.trainerStaffId && user.role !== Role.TRAINER) {
      where.trainerStaffId = query.trainerStaffId;
    }
    if (query.gender) where.gender = query.gender;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { memberCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' },
        include: {
          trainer: { select: { id: true, fullName: true } },
          subscriptions: {
            where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] } },
            take: 1,
            orderBy: { endDate: 'desc' },
            include: { plan: true },
          },
        },
      }),
      this.prisma.member.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async get(user: AuthUser, id: string) {
    const member = await this.prisma.member.findFirst({
      where: {
        id,
        gymId: user.gymId,
        deletedAt: null,
        ...this.scopeMemberFilter(user),
      },
      include: {
        trainer: true,
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { paidAt: 'desc' }, take: 20 },
        invoices: { orderBy: { issueDate: 'desc' }, take: 20 },
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async profile(user: AuthUser, id: string) {
    const member = await this.get(user, id);
    const [attendanceCount, workoutStreak, dues] = await Promise.all([
      this.prisma.attendanceLog.count({
        where: { gymId: user.gymId, memberId: id, isMapped: true },
      }),
      this.computeStreak(user.gymId, id),
      this.prisma.invoice.aggregate({
        where: {
          gymId: user.gymId,
          memberId: id,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        },
        _sum: { dueAmount: true },
      }),
    ]);
    return {
      member,
      stats: {
        attendanceCount,
        workoutStreak,
        dueAmount: dues._sum.dueAmount || 0,
      },
    };
  }

  async create(user: AuthUser, dto: CreateMemberDto) {
    const code = dto.memberCode || (await this.nextMemberCode(user.gymId));
    const devicePin = await this.nextDevicePin(user.gymId);
    try {
      const member = await this.prisma.member.create({
        data: {
          gymId: user.gymId,
          memberCode: code,
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address,
          emergencyContact: dto.emergencyContact,
          emergencyPhone: dto.emergencyPhone,
          notes: dto.notes,
          trainerStaffId: dto.trainerStaffId,
          devicePin,
          status: MemberStatus.PENDING,
        },
      });
      return member;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Phone or member code already exists');
      }
      throw e;
    }
  }

  /**
   * ONE transaction: member + subscription + offer + payment + invoice
   * + enqueue device sync + welcome WhatsApp
   */
  async addMember(user: AuthUser, dto: AddMemberDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { gymId: user.gymId, idempotencyKey: dto.idempotencyKey },
        include: { member: true, invoice: true },
      });
      if (existing) {
        return { member: existing.member, payment: existing, invoice: existing.invoice, idempotent: true };
      }
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, gymId: user.gymId, deletedAt: null, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    let discount = new Decimal(0);
    let offerId: string | undefined;
    if (dto.offerId) {
      const offer = await this.prisma.offer.findFirst({
        where: {
          id: dto.offerId,
          gymId: user.gymId,
          isActive: true,
          deletedAt: null,
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      });
      if (!offer) throw new BadRequestException('Offer not valid');
      if (offer.planId && offer.planId !== plan.id) {
        throw new BadRequestException('Offer not applicable to this plan');
      }
      if (offer.maxRedemptions && offer.usedCount >= offer.maxRedemptions) {
        throw new BadRequestException('Offer fully redeemed');
      }
      offerId = offer.id;
      if (offer.type === 'PERCENT') {
        discount = plan.price.mul(offer.value).div(100);
      } else if (offer.type === 'FIXED') {
        discount = offer.value;
      }
    }

    const finalAmount = Decimal.max(plan.price.sub(discount), new Decimal(0));
    const paidAmount = new Decimal(dto.paidAmount ?? 0);
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays);

    const code = dto.memberCode || (await this.nextMemberCode(user.gymId));
    const devicePin = await this.nextDevicePin(user.gymId);
    const invoiceNumber = await this.nextInvoiceNumber(user.gymId);

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          gymId: user.gymId,
          memberCode: code,
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address,
          emergencyContact: dto.emergencyContact,
          emergencyPhone: dto.emergencyPhone,
          notes: dto.notes,
          trainerStaffId: dto.trainerStaffId,
          devicePin,
          status: MemberStatus.ACTIVE,
        },
      });

      const subscription = await tx.memberSubscription.create({
        data: {
          gymId: user.gymId,
          memberId: member.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          price: plan.price,
          discount,
          finalAmount,
        },
      });

      if (offerId) {
        await tx.offerRedemption.create({
          data: {
            gymId: user.gymId,
            offerId,
            memberId: member.id,
            amount: discount,
          },
        });
        await tx.offer.update({
          where: { id: offerId },
          data: { usedCount: { increment: 1 } },
        });
      }

      const dueAmount = Decimal.max(finalAmount.sub(paidAmount), new Decimal(0));
      const invoiceStatus =
        dueAmount.eq(0)
          ? InvoiceStatus.PAID
          : paidAmount.gt(0)
            ? InvoiceStatus.PARTIAL
            : InvoiceStatus.ISSUED;

      const invoice = await tx.invoice.create({
        data: {
          gymId: user.gymId,
          memberId: member.id,
          subscriptionId: subscription.id,
          invoiceNumber,
          status: invoiceStatus,
          subtotal: plan.price,
          discount,
          total: finalAmount,
          paidAmount,
          dueAmount,
          dueDate: endDate,
          items: {
            create: [
              {
                gymId: user.gymId,
                description: `Membership — ${plan.name}`,
                quantity: 1,
                unitPrice: plan.price,
                amount: plan.price,
              },
            ],
          },
        },
        include: { items: true },
      });

      let payment = null;
      if (paidAmount.gt(0)) {
        payment = await tx.payment.create({
          data: {
            gymId: user.gymId,
            memberId: member.id,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            paymentAccountId: dto.paymentAccountId,
            amount: paidAmount,
            status: PaymentStatus.PAID,
            method: dto.paymentMethod || 'CASH',
            idempotencyKey: dto.idempotencyKey,
            createdById: user.id,
          },
        });
      }

      return { member, subscription, invoice, payment };
    });

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'member',
      entityId: result.member.id,
      after: result.member,
    });

    await this.deviceQueue.add('sync-member', {
      gymId: user.gymId,
      memberId: result.member.id,
    });
    await this.waQueue.add('welcome', {
      gymId: user.gymId,
      memberId: result.member.id,
      phone: result.member.phone,
      fullName: result.member.fullName,
    });

    return result;
  }

  async update(user: AuthUser, id: string, dto: UpdateMemberDto) {
    await this.get(user, id);
    return this.prisma.member.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async softDelete(user: AuthUser, id: string) {
    if (![Role.OWNER, Role.MANAGER].includes(user.role)) {
      throw new ForbiddenException();
    }
    const member = await this.get(user, id);
    const updated = await this.prisma.member.update({
      where: { id },
      data: { deletedAt: new Date(), status: MemberStatus.CANCELLED },
    });
    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.DELETE,
      entityType: 'member',
      entityId: id,
      before: member,
    });
    await this.deviceQueue.add('delete-member', {
      gymId: user.gymId,
      memberId: id,
      devicePin: member.devicePin,
    });
    return updated;
  }

  async freeze(user: AuthUser, id: string, dto: FreezeMemberDto) {
    const member = await this.get(user, id);
    const sub = await this.prisma.memberSubscription.findFirst({
      where: {
        gymId: user.gymId,
        memberId: id,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { endDate: 'desc' },
    });
    if (!sub) throw new BadRequestException('No active subscription');

    const freezeStart = dto.freezeStart ? new Date(dto.freezeStart) : new Date();
    const freezeEnd = new Date(dto.freezeEnd);
    const freezeDays = Math.ceil(
      (freezeEnd.getTime() - freezeStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (freezeDays < 1) throw new BadRequestException('Invalid freeze period');

    const newEnd = new Date(sub.endDate);
    newEnd.setUTCDate(newEnd.getUTCDate() + freezeDays);

    const [updatedSub, updatedMember] = await this.prisma.$transaction([
      this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.FROZEN,
          freezeStart,
          freezeEnd,
          freezeDays: sub.freezeDays + freezeDays,
          endDate: newEnd,
        },
      }),
      this.prisma.member.update({
        where: { id },
        data: { status: MemberStatus.FROZEN },
      }),
    ]);

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.FREEZE,
      entityType: 'member',
      entityId: id,
      after: { freezeStart, freezeEnd, reason: dto.reason },
    });

    return { member: updatedMember, subscription: updatedSub };
  }

  async unfreeze(user: AuthUser, id: string) {
    await this.get(user, id);
    const sub = await this.prisma.memberSubscription.findFirst({
      where: {
        gymId: user.gymId,
        memberId: id,
        status: SubscriptionStatus.FROZEN,
      },
      orderBy: { endDate: 'desc' },
    });
    if (!sub) throw new BadRequestException('No frozen subscription');

    const [updatedSub, updatedMember] = await this.prisma.$transaction([
      this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          freezeStart: null,
          freezeEnd: null,
        },
      }),
      this.prisma.member.update({
        where: { id },
        data: { status: MemberStatus.ACTIVE },
      }),
    ]);

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.UNFREEZE,
      entityType: 'member',
      entityId: id,
    });

    return { member: updatedMember, subscription: updatedSub };
  }

  async renew(user: AuthUser, id: string, dto: RenewMemberDto) {
    await this.get(user, id);
    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, gymId: user.gymId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { gymId: user.gymId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return { payment: existing, idempotent: true };
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays);
    const paidAmount = new Decimal(dto.paidAmount ?? plan.price);
    const invoiceNumber = await this.nextInvoiceNumber(user.gymId);

    const result = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.memberSubscription.create({
        data: {
          gymId: user.gymId,
          memberId: id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          price: plan.price,
          discount: 0,
          finalAmount: plan.price,
        },
      });
      const dueAmount = Decimal.max(plan.price.sub(paidAmount), new Decimal(0));
      const invoice = await tx.invoice.create({
        data: {
          gymId: user.gymId,
          memberId: id,
          subscriptionId: subscription.id,
          invoiceNumber,
          status: dueAmount.eq(0) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL,
          subtotal: plan.price,
          total: plan.price,
          paidAmount,
          dueAmount,
          dueDate: endDate,
          items: {
            create: [
              {
                gymId: user.gymId,
                description: `Renewal — ${plan.name}`,
                quantity: 1,
                unitPrice: plan.price,
                amount: plan.price,
              },
            ],
          },
        },
      });
      const payment = await tx.payment.create({
        data: {
          gymId: user.gymId,
          memberId: id,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          amount: paidAmount,
          status: PaymentStatus.PAID,
          method: 'CASH',
          idempotencyKey: dto.idempotencyKey,
          createdById: user.id,
        },
      });
      await tx.member.update({
        where: { id },
        data: { status: MemberStatus.ACTIVE },
      });
      return { subscription, invoice, payment };
    });

    return result;
  }

  async changePlan(user: AuthUser, id: string, dto: ChangePlanDto) {
    await this.get(user, id);
    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, gymId: user.gymId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const sub = await this.prisma.memberSubscription.findFirst({
      where: {
        gymId: user.gymId,
        memberId: id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
      },
      orderBy: { endDate: 'desc' },
    });
    if (!sub) throw new BadRequestException('No active subscription');

    const daysLeft = Math.max(
      0,
      Math.ceil((sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
    const newEnd = new Date();
    newEnd.setUTCDate(newEnd.getUTCDate() + Math.max(daysLeft, plan.durationDays));

    return this.prisma.memberSubscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        price: plan.price,
        finalAmount: plan.price,
        endDate: newEnd,
        notes: dto.reason,
      },
      include: { plan: true },
    });
  }

  async setPhoto(user: AuthUser, id: string, photoUrl: string) {
    await this.get(user, id);
    return this.prisma.member.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async listPayments(user: AuthUser, memberId: string) {
    await this.get(user, memberId);
    const payments = await this.prisma.payment.findMany({
      where: { gymId: user.gymId, memberId },
      orderBy: { paidAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, photoUrl: true } },
        subscription: { include: { plan: { select: { id: true, name: true } } } },
        invoice: { select: { invoiceNumber: true, total: true, dueAmount: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return payments.map((p) => {
      const invoiceTotal = p.invoice ? Number(p.invoice.total) : Number(p.amount);
      const due = p.invoice ? Number(p.invoice.dueAmount) : 0;
      return {
        id: p.id,
        memberId: p.memberId,
        memberName: p.member.fullName,
        memberPhotoUrl: p.member.photoUrl || undefined,
        invoiceNumber: p.invoice?.invoiceNumber || p.reference || p.id.slice(0, 8),
        amountPkr: invoiceTotal,
        discountPkr: 0,
        paidPkr: Number(p.amount),
        duePkr: due,
        method: (p.method || 'cash').toLowerCase(),
        status: p.status.toLowerCase(),
        planId: p.subscription?.plan?.id,
        planName: p.subscription?.plan?.name,
        notes: p.notes || undefined,
        collectedBy: p.createdBy?.fullName || 'Staff',
        paidAt: p.paidAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  async listAttendance(user: AuthUser, memberId: string) {
    await this.get(user, memberId);
    const logs = await this.prisma.attendanceLog.findMany({
      where: { gymId: user.gymId, memberId, isMapped: true },
      orderBy: { punchedAt: 'desc' },
      include: {
        member: { select: { fullName: true, photoUrl: true } },
        device: { select: { id: true, name: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      memberId: log.memberId || memberId,
      memberName: log.member?.fullName || '',
      memberPhotoUrl: log.member?.photoUrl || undefined,
      checkedInAt: log.punchedAt.toISOString(),
      source: log.isManual ? ('manual' as const) : ('device' as const),
      deviceId: log.deviceId || undefined,
      deviceName: log.device?.name,
      direction:
        log.direction === 'IN'
          ? ('in' as const)
          : log.direction === 'OUT'
            ? ('out' as const)
            : undefined,
      status: 'check_in' as const,
      reason: log.alertReason || undefined,
      recordedBy: log.createdBy?.fullName,
    }));
  }

  async updateReminders(user: AuthUser, memberId: string, enabled: boolean) {
    await this.get(user, memberId);
    return this.prisma.member.update({
      where: { id: memberId },
      data: { remindersEnabled: enabled },
    });
  }

  private async nextMemberCode(gymId: string) {
    const count = await this.prisma.member.count({ where: { gymId } });
    return `M${String(count + 1).padStart(5, '0')}`;
  }

  private async nextDevicePin(gymId: string) {
    const count = await this.prisma.member.count({ where: { gymId } });
    return String(1001 + count);
  }

  private async nextInvoiceNumber(gymId: string) {
    const count = await this.prisma.invoice.count({ where: { gymId } });
    const year = new Date().getUTCFullYear();
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async computeStreak(gymId: string, memberId: string) {
    const logs = await this.prisma.workoutLog.findMany({
      where: { gymId, memberId },
      orderBy: { loggedAt: 'desc' },
      take: 60,
      select: { loggedAt: true },
    });
    if (!logs.length) return 0;
    let streak = 0;
    let cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    const days = new Set(
      logs.map((l) => l.loggedAt.toISOString().slice(0, 10)),
    );
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }
}
