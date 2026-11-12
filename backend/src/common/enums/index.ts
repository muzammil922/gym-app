export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  TRAINER = 'TRAINER',
  RECEPTIONIST = 'RECEPTIONIST',
  MEMBER = 'MEMBER',
}

/** Permission matrix: resource.action → allowed roles */
export const PERMISSIONS: Record<string, Role[]> = {
  'dashboard.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST, Role.TRAINER],
  'members.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST, Role.TRAINER],
  'members.write': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'members.delete': [Role.OWNER, Role.MANAGER],
  'plans.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'plans.write': [Role.OWNER, Role.MANAGER],
  'payments.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'payments.write': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'invoices.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST, Role.MEMBER],
  'invoices.write': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'offers.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'offers.write': [Role.OWNER, Role.MANAGER],
  'attendance.read': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST, Role.TRAINER, Role.MEMBER],
  'attendance.write': [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST],
  'devices.read': [Role.OWNER, Role.MANAGER],
  'devices.write': [Role.OWNER, Role.MANAGER],
  'diet.read': [Role.OWNER, Role.MANAGER, Role.TRAINER, Role.MEMBER],
  'diet.write': [Role.OWNER, Role.MANAGER, Role.TRAINER],
  'workout.read': [Role.OWNER, Role.MANAGER, Role.TRAINER, Role.MEMBER],
  'workout.write': [Role.OWNER, Role.MANAGER, Role.TRAINER],
  'staff.read': [Role.OWNER, Role.MANAGER],
  'staff.write': [Role.OWNER, Role.MANAGER],
  'whatsapp.read': [Role.OWNER, Role.MANAGER],
  'whatsapp.write': [Role.OWNER, Role.MANAGER],
  'reports.read': [Role.OWNER, Role.MANAGER],
  'audit.read': [Role.OWNER, Role.MANAGER],
  'settings.write': [Role.OWNER],
};

export function hasPermission(role: Role, permission: string): boolean {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}
