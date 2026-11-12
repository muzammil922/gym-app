import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OfferType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateOfferDto, OfferQueryDto, UpdateOfferDto } from './dto/offer.dto';

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  async list(user: AuthUser, query: OfferQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.OfferWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
    };
    if (query.activeOnly) {
      where.isActive = true;
      where.validFrom = { lte: new Date() };
      where.validTo = { gte: new Date() };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.offer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.offer.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async get(user: AuthUser, id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, gymId: user.gymId, deletedAt: null },
      include: { redemptions: { take: 20, orderBy: { redeemedAt: 'desc' } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  create(user: AuthUser, dto: CreateOfferDto) {
    return this.prisma.offer.create({
      data: {
        gymId: user.gymId,
        planId: dto.planId,
        name: dto.name,
        description: dto.description,
        type: dto.type as OfferType,
        value: dto.value,
        code: dto.code,
        maxRedemptions: dto.maxRedemptions,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateOfferDto) {
    await this.get(user, id);
    return this.prisma.offer.update({
      where: { id },
      data: {
        ...dto,
        type: dto.type as OfferType | undefined,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  async softDelete(user: AuthUser, id: string) {
    await this.get(user, id);
    return this.prisma.offer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async applicable(user: AuthUser, planId: string, code?: string) {
    const now = new Date();
    const where: Prisma.OfferWhereInput = {
      gymId: user.gymId,
      deletedAt: null,
      isActive: true,
      validFrom: { lte: now },
      validTo: { gte: now },
      OR: [{ planId: null }, { planId }],
    };
    if (code) where.code = code;
    const offers = await this.prisma.offer.findMany({ where });
    return offers.filter(
      (o) => !o.maxRedemptions || o.usedCount < o.maxRedemptions,
    );
  }

  async redeem(user: AuthUser, offerId: string, memberId: string, amount: number) {
    const offer = await this.get(user, offerId);
    if (!offer.isActive) throw new BadRequestException('Offer inactive');
    if (offer.maxRedemptions && offer.usedCount >= offer.maxRedemptions) {
      throw new BadRequestException('Offer fully redeemed');
    }
    const [redemption] = await this.prisma.$transaction([
      this.prisma.offerRedemption.create({
        data: {
          gymId: user.gymId,
          offerId,
          memberId,
          amount,
        },
      }),
      this.prisma.offer.update({
        where: { id: offerId },
        data: { usedCount: { increment: 1 } },
      }),
    ]);
    return redemption;
  }
}
