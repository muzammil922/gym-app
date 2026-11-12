import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../enums';

export interface AuthUser {
  id: string;
  gymId: string;
  role: Role;
  phone: string;
  fullName: string;
  memberId?: string;
  staffId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
