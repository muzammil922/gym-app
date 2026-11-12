import type {
  AppNotification,
  AttendanceDevice,
  AttendanceRecord,
  DietAssignment,
  DietTemplate,
  Exercise,
  GymProfile,
  Member,
  Offer,
  Payment,
  Plan,
  StaffAttendance,
  StaffMember,
  WhatsAppMessage,
  WhatsAppSettings,
  WorkoutAssignment,
  WorkoutPlan,
} from '@/src/api/types';
import {
  seedAttendance,
  seedDevices,
  seedDietAssignments,
  seedDietTemplates,
  seedExercises,
  seedGym,
  seedMembers,
  seedMessages,
  seedNotifications,
  seedOffers,
  seedPayments,
  seedPlans,
  seedStaff,
  seedStaffAttendance,
  seedUsers,
  seedWhatsAppSettings,
  seedWhatsAppTemplates,
  seedWorkoutAssignments,
  seedWorkoutPlans,
} from './seed';

/** In-memory mutable mock database */
export const db = {
  gym: { ...seedGym } as GymProfile,
  users: seedUsers.map((u) => ({ ...u })),
  /** phone → pending OTP code */
  otpCodes: new Map<string, string>(),
  /** Users who already chose their own password after the first OTP login. */
  usersWithPassword: new Set<string>(),
  plans: seedPlans.map((p) => ({ ...p })),
  offers: seedOffers.map((o) => ({ ...o })),
  members: seedMembers.map((m) => ({ ...m })),
  staff: seedStaff.map((s) => ({ ...s })),
  devices: seedDevices.map((d) => ({ ...d })),
  attendance: seedAttendance.map((a) => ({ ...a })),
  payments: seedPayments.map((p) => ({ ...p })),
  dietTemplates: seedDietTemplates.map((t) => ({
    ...t,
    meals: t.meals.map((m) => ({ ...m })),
  })),
  dietAssignments: seedDietAssignments.map((a) => ({
    ...a,
    checkoffs: a.checkoffs.map((c) => ({ ...c })),
  })),
  exercises: seedExercises.map((e) => ({ ...e })),
  workoutPlans: seedWorkoutPlans.map((p) => ({
    ...p,
    days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
  })),
  workoutAssignments: seedWorkoutAssignments.map((a) => ({
    ...a,
    completions: a.completions.map((c) => ({ ...c })),
  })),
  staffAttendance: seedStaffAttendance.map((s) => ({ ...s })),
  whatsappSettings: { ...seedWhatsAppSettings } as WhatsAppSettings,
  whatsappTemplates: seedWhatsAppTemplates.map((t) => ({ ...t })),
  messages: seedMessages.map((m) => ({ ...m })),
  notifications: seedNotifications.map((n) => ({ ...n })),
};

export type MockDb = typeof db;

let idCounter = 1000;
export function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function cloneMember(m: Member): Member {
  return { ...m };
}

export function clonePayment(p: Payment): Payment {
  return { ...p };
}

export function cloneAttendance(a: AttendanceRecord): AttendanceRecord {
  return { ...a };
}

export function clonePlan(p: Plan): Plan {
  return { ...p };
}

export function cloneOffer(o: Offer): Offer {
  return { ...o };
}

export function cloneDevice(d: AttendanceDevice): AttendanceDevice {
  return { ...d };
}

export function cloneStaff(s: StaffMember): StaffMember {
  return { ...s, assignedMemberIds: [...s.assignedMemberIds] };
}

export function cloneStaffAttendance(s: StaffAttendance): StaffAttendance {
  return { ...s };
}

export function cloneDietTemplate(t: DietTemplate): DietTemplate {
  return { ...t, meals: t.meals.map((m) => ({ ...m })) };
}

export function cloneDietAssignment(a: DietAssignment): DietAssignment {
  return { ...a, checkoffs: a.checkoffs.map((c) => ({ ...c })) };
}

export function cloneExercise(e: Exercise): Exercise {
  return { ...e };
}

export function cloneWorkoutPlan(p: WorkoutPlan): WorkoutPlan {
  return {
    ...p,
    days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
  };
}

export function cloneWorkoutAssignment(a: WorkoutAssignment): WorkoutAssignment {
  return { ...a, completions: a.completions.map((c) => ({ ...c })) };
}

export function cloneMessage(m: WhatsAppMessage): WhatsAppMessage {
  return { ...m };
}

export function cloneNotification(n: AppNotification): AppNotification {
  return { ...n, data: n.data ? { ...n.data } : undefined };
}
