import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import {
  ChangePasswordDto,
  LoginDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { Role } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private wa: WhatsAppService,
  ) {}

  async login(dto: LoginDto) {
    const where: { phone: string; deletedAt: null; gymId?: string } = {
      phone: dto.phone,
      deletedAt: null,
    };
    if (dto.gymId) where.gymId = dto.gymId;

    const user = await this.prisma.user.findFirst({
      where,
      include: { member: true, staff: true, gym: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid phone or password');

    if (user.otpEnabled) {
      // Optional OTP flag — generate code but still return tokens for MVP
      // when OTP flow UI is not yet wired; flag is persisted for clients.
    }

    const tokens = await this.issueTokens(user.id, user.gymId, user.role as Role, user.phone);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'user',
      entityId: user.id,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        gymId: user.gymId,
        gymName: user.gym.name,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        memberId: user.member?.id,
        staffId: user.staff?.id,
        otpEnabled: user.otpEnabled,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; gymId: string; role: Role; phone: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
    });
    if (!user?.refreshToken) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const match = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!match) throw new UnauthorizedException('Refresh token mismatch');

    const tokens = await this.issueTokens(
      user.id,
      user.gymId,
      user.role as Role,
      user.phone,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });
    return tokens;
  }

  async logout(userId: string, gymId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    await this.audit.log({
      gymId,
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'user',
      entityId: userId,
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshToken: null },
    });
    return { success: true };
  }

  async toggleOtp(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { otpEnabled: enabled },
    });
    return { otpEnabled: enabled };
  }

  /**
   * Member login step 1: phone number → 6-digit OTP over WhatsApp.
   * Staff accounts keep using phone + password.
   */
  async requestOtp(dto: RequestOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        phone: dto.phone,
        deletedAt: null,
        isActive: true,
        ...(dto.gymId ? { gymId: dto.gymId } : {}),
      },
    });
    if (!user) throw new NotFoundException('Phone not registered');
    if (user.role !== 'MEMBER') {
      throw new BadRequestException('Staff accounts sign in with a password');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: await bcrypt.hash(code, 10),
        otpExpiresAt: expiresAt,
        otpEnabled: true,
      },
    });

    await this.wa.enqueue({
      gymId: user.gymId,
      toPhone: user.phone,
      templateKey: 'login_otp',
      body: `${code} is your IronForge login code. It expires in 5 minutes.`,
      idempotencyKey: `login-otp-${user.id}-${expiresAt.getTime()}`,
    });

    // The OTP is never returned in production; the mock/dev client shows it.
    return {
      ok: true,
      expiresInSeconds: 300,
      ...(this.config.get('NODE_ENV') !== 'production' ? { demoOtp: code } : {}),
    };
  }

  /** Member login step 2: verify OTP → session tokens. */
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        phone: dto.phone,
        deletedAt: null,
        isActive: true,
        ...(dto.gymId ? { gymId: dto.gymId } : {}),
      },
      include: { member: true, staff: true, gym: true },
    });
    if (!user || !user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('Request a new code');
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Code expired, request a new one');
    }
    const ok = await bcrypt.compare(dto.otp, user.otpCode);
    if (!ok) throw new BadRequestException('Invalid code');

    const tokens = await this.issueTokens(
      user.id,
      user.gymId,
      user.role as Role,
      user.phone,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'user',
      entityId: user.id,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      // Members choose a password right after their first OTP login.
      needsPassword: !user.passwordSetAt,
      user: {
        id: user.id,
        gymId: user.gymId,
        gymName: user.gym.name,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        memberId: user.member?.id,
        staffId: user.staff?.id,
        otpEnabled: true,
      },
    };
  }

  /** Member sets their own password after the first OTP login. */
  async setPassword(userId: string, newPassword: string) {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS') || 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, rounds),
        passwordSetAt: new Date(),
      },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { gym: true, member: true, staff: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      gymId: user.gymId,
      gymName: user.gym.name,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      otpEnabled: user.otpEnabled,
      memberId: user.member?.id,
      staffId: user.staff?.id,
    };
  }

  private async issueTokens(
    userId: string,
    gymId: string,
    role: Role,
    phone: string,
  ) {
    const payload = { sub: userId, gymId, role, phone };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') || '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES') || '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
