import type { Role } from '@/src/api/types';

export type Permission =
  | 'dashboard'
  | 'members'
  | 'members.write'
  | 'attendance'
  | 'attendance.devices'
  | 'fees'
  | 'plans'
  | 'offers'
  | 'diet'
  | 'workout'
  | 'staff'
  | 'whatsapp'
  | 'reports'
  | 'settings'
  | 'notifications';

const matrix: Record<Role, Permission[]> = {
  owner: [
    'dashboard',
    'members',
    'members.write',
    'attendance',
    'attendance.devices',
    'fees',
    'plans',
    'offers',
    'diet',
    'workout',
    'staff',
    'whatsapp',
    'reports',
    'settings',
    'notifications',
  ],
  manager: [
    'dashboard',
    'members',
    'members.write',
    'attendance',
    'attendance.devices',
    'fees',
    'plans',
    'offers',
    'diet',
    'workout',
    'staff',
    'whatsapp',
    'reports',
    'settings',
    'notifications',
  ],
  trainer: [
    'dashboard',
    'members',
    'attendance',
    'diet',
    'workout',
    'notifications',
    'settings',
  ],
  receptionist: [
    'dashboard',
    'members',
    'members.write',
    'attendance',
    'fees',
    'offers',
    'notifications',
    'settings',
  ],
  member: ['diet', 'workout', 'notifications', 'settings', 'attendance'],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return matrix[role]?.includes(permission) ?? false;
}

export function staffRoles(): Role[] {
  return ['owner', 'manager', 'trainer', 'receptionist'];
}

export function isStaff(role?: Role) {
  return !!role && role !== 'member';
}
