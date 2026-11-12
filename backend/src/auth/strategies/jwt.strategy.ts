import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

export interface JwtPayload {
  sub: string;
  gymId: string;
  role: Role;
  phone: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
      include: { member: true, staff: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');

    return {
      id: user.id,
      gymId: user.gymId,
      role: user.role as Role,
      phone: user.phone,
      fullName: user.fullName,
      memberId: user.member?.id,
      staffId: user.staff?.id,
    };
  }
}
