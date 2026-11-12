import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CURRENT_USER_KEY = 'user';
