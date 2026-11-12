import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { STORAGE_ADAPTER } from '../storage/storage.module';
import { StorageAdapter } from '../storage/storage.interface';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private pdf: InvoicePdfService,
    @Inject(STORAGE_ADAPTER) private storage: StorageAdapter,
  ) {}

  async list(user: AuthUser, query: PaginationQueryDto & { status?: string; memberId?: string }) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.InvoiceWhereInput = { gymId: user.gymId };
    if (user.role === Role.MEMBER) where.memberId = user.memberId;
    if (query.memberId) where.memberId = query.memberId;
    if (query.status) where.status = query.status as never;
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
        orderBy: { issueDate: 'desc' },
        include: {
          member: { select: { id: true, fullName: true, phone: true } },
          items: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async get(user: AuthUser, id: string) {
    const where: Prisma.InvoiceWhereInput = { id, gymId: user.gymId };
    if (user.role === Role.MEMBER) where.memberId = user.memberId;
    const invoice = await this.prisma.invoice.findFirst({
      where,
      include: { items: true, member: true, payments: true, gym: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async generatePdf(user: AuthUser, id: string) {
    const invoice = await this.get(user, id);
    const buffer = await this.pdf.generate(invoice);
    const key = `invoices/${user.gymId}/${invoice.invoiceNumber}.pdf`;
    const stored = await this.storage.upload(key, buffer, 'application/pdf');
    await this.prisma.invoice.update({
      where: { id },
      data: { pdfUrl: stored.url },
    });
    return { url: stored.url, buffer };
  }
}
