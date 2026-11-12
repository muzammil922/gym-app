import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreatePaymentDto, PaymentQueryDto } from './dto/payment.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private whatsapp: WhatsAppService,
  ) {}

  async list(user: AuthUser, query: PaymentQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.PaymentWhereInput = { gymId: user.gymId };
    if (user.role === Role.MEMBER) where.memberId = user.memberId;
    if (query.memberId) where.memberId = query.memberId;
    if (query.from || query.to) {
      where.paidAt = {};
      if (query.from) where.paidAt.gte = new Date(query.from);
      if (query.to) where.paidAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { member: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { paidAt: 'desc' },
        include: {
          member: { select: { id: true, fullName: true, phone: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async create(user: AuthUser, dto: CreatePaymentDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { gymId: user.gymId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return { ...existing, idempotent: true };
    }

    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, gymId: user.gymId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Member not found');

    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be > 0');

    const payment = await this.prisma.$transaction(async (tx) => {
      let invoiceId = dto.invoiceId;
      if (invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, gymId: user.gymId },
        });
        if (!invoice) throw new NotFoundException('Invoice not found');
        const newPaid = invoice.paidAmount.add(amount);
        const newDue = Decimal.max(invoice.total.sub(newPaid), new Decimal(0));
        const status = newDue.eq(0)
          ? InvoiceStatus.PAID
          : newPaid.gt(0)
            ? InvoiceStatus.PARTIAL
            : invoice.status;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: newPaid, dueAmount: newDue, status },
        });
      }

      return tx.payment.create({
        data: {
          gymId: user.gymId,
          memberId: dto.memberId,
          subscriptionId: dto.subscriptionId,
          invoiceId,
          paymentAccountId: dto.paymentAccountId,
          amount,
          method: dto.method || 'CASH',
          reference: dto.reference,
          notes: dto.notes,
          status: PaymentStatus.PAID,
          idempotencyKey: dto.idempotencyKey,
          createdById: user.id,
        },
      });
    });

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.PAYMENT,
      entityType: 'payment',
      entityId: payment.id,
      after: payment,
    });

    return payment;
  }

  async dues(user: AuthUser, query: PaymentQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.InvoiceWhereInput = {
      gymId: user.gymId,
      dueAmount: { gt: 0 },
      status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
    };
    if (user.role === Role.MEMBER) where.memberId = user.memberId;
    if (query.memberId) where.memberId = query.memberId;
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { member: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { dueDate: 'asc' },
        include: {
          member: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async getInvoiceForPayment(user: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, gymId: user.gymId },
      include: {
        member: { select: { id: true, fullName: true, phone: true } },
        invoice: { include: { items: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.invoice) throw new NotFoundException('Invoice not linked to this payment');
    return payment.invoice;
  }

  async sendPaymentWhatsApp(user: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, gymId: user.gymId },
      include: {
        member: { select: { phone: true, fullName: true } },
        invoice: { select: { invoiceNumber: true, total: true, dueAmount: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.member?.phone) {
      throw new BadRequestException('Member has no phone number');
    }
    const inv = payment.invoice;
    const body = inv
      ? `Payment received: PKR ${payment.amount}. Invoice ${inv.invoiceNumber}. Total PKR ${inv.total}, balance due PKR ${inv.dueAmount}.`
      : `Payment received: PKR ${payment.amount}. Thank you, ${payment.member.fullName}.`;
    return this.whatsapp.enqueue({
      gymId: user.gymId,
      toPhone: payment.member.phone,
      body,
      templateKey: 'payment_receipt',
      idempotencyKey: `payment-wa-${payment.id}`,
    });
  }

  async report(user: AuthUser, from?: string, to?: string) {
    const paidAt: Prisma.DateTimeFilter = {};
    if (from) paidAt.gte = new Date(from);
    if (to) paidAt.lte = new Date(to);
    const where: Prisma.PaymentWhereInput = { gymId: user.gymId };
    if (from || to) where.paidAt = paidAt;

    const [sum, count, byMethod] = await Promise.all([
      this.prisma.payment.aggregate({ where, _sum: { amount: true } }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const dues = await this.prisma.invoice.aggregate({
      where: {
        gymId: user.gymId,
        dueAmount: { gt: 0 },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      },
      _sum: { dueAmount: true },
      _count: true,
    });

    return {
      currency: 'PKR',
      totalCollected: sum._sum.amount || 0,
      paymentCount: count,
      byMethod,
      totalDues: dues._sum.dueAmount || 0,
      duesCount: dues._count,
    };
  }
}
