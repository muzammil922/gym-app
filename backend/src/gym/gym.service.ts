import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { UpdateGymDto } from './dto/gym.dto';

type GymPaymentSettings = {
  easypaisaNumber?: string;
  jazzcashNumber?: string;
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNumber?: string;
  iban?: string;
};

@Injectable()
export class GymService {
  constructor(private prisma: PrismaService) {}

  async getProfile(user: AuthUser) {
    const gym = await this.prisma.gym.findFirst({
      where: { id: user.gymId, deletedAt: null },
      include: {
        paymentAccounts: {
          where: { deletedAt: null, isActive: true },
        },
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    return this.toProfile(gym);
  }

  async updateProfile(user: AuthUser, dto: UpdateGymDto) {
    const gym = await this.prisma.gym.findFirst({
      where: { id: user.gymId, deletedAt: null },
    });
    if (!gym) throw new NotFoundException('Gym not found');

    const {
      easypaisaNumber,
      jazzcashNumber,
      bankName,
      bankAccountTitle,
      bankAccountNumber,
      iban,
      settings: settingsPatch,
      ...scalar
    } = dto;

    const paymentFields: GymPaymentSettings = {};
    if (easypaisaNumber !== undefined) paymentFields.easypaisaNumber = easypaisaNumber;
    if (jazzcashNumber !== undefined) paymentFields.jazzcashNumber = jazzcashNumber;
    if (bankName !== undefined) paymentFields.bankName = bankName;
    if (bankAccountTitle !== undefined) paymentFields.bankAccountTitle = bankAccountTitle;
    if (bankAccountNumber !== undefined) paymentFields.bankAccountNumber = bankAccountNumber;
    if (iban !== undefined) paymentFields.iban = iban;

    const prevSettings =
      gym.settings && typeof gym.settings === 'object' && !Array.isArray(gym.settings)
        ? (gym.settings as Record<string, unknown>)
        : {};

    const nextSettings = {
      ...prevSettings,
      ...paymentFields,
      ...(settingsPatch || {}),
    };

    const updated = await this.prisma.gym.update({
      where: { id: user.gymId },
      data: {
        ...scalar,
        settings:
          Object.keys(nextSettings).length > 0
            ? (nextSettings as Prisma.InputJsonValue)
            : undefined,
      },
      include: {
        paymentAccounts: {
          where: { deletedAt: null, isActive: true },
        },
      },
    });

    await this.syncPaymentAccounts(user.gymId, paymentFields);

    return this.toProfile(updated);
  }

  private toProfile(
    gym: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
      city: string | null;
      logoUrl: string | null;
      timezone: string;
      currency: string;
      settings: Prisma.JsonValue;
      paymentAccounts?: Array<{
        type: string;
        name: string;
        details: Prisma.JsonValue;
      }>;
    },
  ) {
    const settings = this.readPaymentSettings(gym.settings, gym.paymentAccounts);
    return {
      id: gym.id,
      name: gym.name,
      phone: gym.phone || '',
      email: gym.email || undefined,
      address: gym.address || '',
      city: gym.city || '',
      logoUrl: gym.logoUrl || undefined,
      timezone: gym.timezone as 'Asia/Karachi',
      currency: gym.currency as 'PKR',
      ...settings,
    };
  }

  private readPaymentSettings(
    settingsJson: Prisma.JsonValue,
    accounts?: Array<{ type: string; name: string; details: Prisma.JsonValue }>,
  ): GymPaymentSettings {
    const out: GymPaymentSettings = {};
    if (settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)) {
      const s = settingsJson as Record<string, unknown>;
      for (const key of [
        'easypaisaNumber',
        'jazzcashNumber',
        'bankName',
        'bankAccountTitle',
        'bankAccountNumber',
        'iban',
      ] as const) {
        if (typeof s[key] === 'string') out[key] = s[key];
      }
    }

    for (const acc of accounts || []) {
      const details =
        acc.details && typeof acc.details === 'object' && !Array.isArray(acc.details)
          ? (acc.details as Record<string, string>)
          : {};
      if (acc.type === 'easypaisa' && !out.easypaisaNumber) {
        out.easypaisaNumber = details.number || details.accountNumber || acc.name;
      }
      if (acc.type === 'jazzcash' && !out.jazzcashNumber) {
        out.jazzcashNumber = details.number || details.accountNumber || acc.name;
      }
      if (acc.type === 'bank') {
        out.bankName ||= details.bankName || acc.name;
        out.bankAccountTitle ||= details.accountTitle;
        out.bankAccountNumber ||= details.accountNumber;
        out.iban ||= details.iban;
      }
    }

    return out;
  }

  private async syncPaymentAccounts(gymId: string, fields: GymPaymentSettings) {
    const upsert = async (type: string, name: string, details: Record<string, string>) => {
      const existing = await this.prisma.paymentAccount.findFirst({
        where: { gymId, type, deletedAt: null },
      });
      if (existing) {
        await this.prisma.paymentAccount.update({
          where: { id: existing.id },
          data: { name, details, isActive: true },
        });
        return;
      }
      await this.prisma.paymentAccount.create({
        data: { gymId, type, name, details },
      });
    };

    if (fields.easypaisaNumber !== undefined) {
      await upsert('easypaisa', 'Easypaisa', { number: fields.easypaisaNumber });
    }
    if (fields.jazzcashNumber !== undefined) {
      await upsert('jazzcash', 'JazzCash', { number: fields.jazzcashNumber });
    }
    if (
      fields.bankName !== undefined ||
      fields.bankAccountNumber !== undefined ||
      fields.iban !== undefined
    ) {
      await upsert('bank', fields.bankName || 'Bank', {
        bankName: fields.bankName || '',
        accountTitle: fields.bankAccountTitle || '',
        accountNumber: fields.bankAccountNumber || '',
        iban: fields.iban || '',
      });
    }
  }
}
