import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, hasPermission } from '../enums';
import {
  PERMISSION_KEY,
  ROLES_KEY,
} from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    if (permission && !hasPermission(user.role, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return true;
  }
}
