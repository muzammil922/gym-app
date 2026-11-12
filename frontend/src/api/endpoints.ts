import { apiRequest, isMockMode } from './client';
import {
  mapAttendance,
  mapAttendanceDevice,
  mapAuthSession,
  mapCollectPaymentPayload,
  mapCreateMemberPayload,
  mapDashboard,
  mapDietScheduleToAssignments,
  mapDietTemplate,
  mapDietTemplateCreatePayload,
  mapDueItem,
  mapExercise,
  mapFeeReport,
  mapGym,
  mapGymPayload,
  mapInvoiceFromBackend,
  mapMember,
  mapNotification,
  mapOffer,
  mapOfferPayload,
  mapPaginated,
  mapPayment,
  mapPlan,
  mapPlanPayload,
  mapStaff,
  mapStaffPayload,
  mapUpdateMemberPayload,
  mapWhatsAppMessage,
  mapWhatsAppSettings,
  mapWhatsAppTemplate,
  mapWorkoutAssignmentsFromLogs,
  mapWorkoutPlan,
  mapWorkoutPlanPayload,
  settingsToAutomationUpdates,
} from './mappers';
import type {
  AppNotification,
  AttendanceDevice,
  AttendanceRecord,
  CollectPaymentPayload,
  CreateMemberPayload,
  DashboardStats,
  UpdateMemberPayload,
  DietAssignment,
  DietTemplate,
  DueItem,
  Exercise,
  FeeReport,
  FreezePayload,
  GymProfile,
  Invoice,
  ManualCheckInPayload,
  UpdateAttendancePayload,
  Member,
  Offer,
  Paginated,
  Payment,
  Plan,
  RenewMemberPayload,
  StaffAttendance,
  StaffMember,
  WhatsAppMessage,
  WhatsAppSettings,
  WhatsAppTemplate,
  WorkoutAssignment,
  WorkoutPlan,
  Weekday,
} from './types';

async function real<T>(
  opts: Parameters<typeof apiRequest>[0],
  mapper: (raw: unknown) => T,
): Promise<T> {
  const raw = await apiRequest(opts);
  return mapper(raw);
}

export const authApi = {
  logout: () => apiRequest({ method: 'POST', path: '/auth/logout' }),
};

export const dashboardApi = {
  get: async (): Promise<DashboardStats> => {
    if (isMockMode()) {
      return apiRequest<DashboardStats>({ path: '/dashboard' });
    }
    const [kpis, live] = await Promise.all([
      apiRequest<Record<string, unknown>>({ path: '/dashboard/kpis' }),
      apiRequest<Record<string, unknown>[]>({ path: '/attendance/live', params: { limit: 8 } }).catch(
        () => [],
      ),
    ]);
    return mapDashboard(kpis, {
      recentCheckIns: (live ?? []).map((row) => mapAttendance(row)),
    });
  },
};

export const gymApi = {
  get: async (): Promise<GymProfile> => {
    if (isMockMode()) return apiRequest<GymProfile>({ path: '/gym' });
    return real({ path: '/gym' }, (raw) => mapGym(raw as Record<string, unknown>));
  },
  update: async (data: Partial<GymProfile>): Promise<GymProfile> => {
    if (isMockMode()) {
      return apiRequest<GymProfile>({ method: 'PUT', path: '/gym', data });
    }
    return real(
      { method: 'PATCH', path: '/gym', data: mapGymPayload(data) },
      (raw) => mapGym(raw as Record<string, unknown>),
    );
  },
};

export const membersApi = {
  list: async (params?: {
    q?: string;
    search?: string;
    status?: string;
    paymentStatus?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<Member>> => {
    if (isMockMode()) {
      return apiRequest<Paginated<Member>>({ path: '/members', params });
    }
    const normalized = { ...params, search: params?.search ?? params?.q };
    return real(
      { path: '/members', params: normalized as Record<string, unknown> },
      (raw) => mapPaginated(raw, (m) => mapMember(m as Record<string, unknown>)),
    );
  },
  get: async (id: string): Promise<Member> => {
    if (isMockMode()) return apiRequest<Member>({ path: `/members/${id}` });
    return real({ path: `/members/${id}` }, (raw) => mapMember(raw as Record<string, unknown>));
  },
  create: async (
    data: CreateMemberPayload,
  ): Promise<{ member: Member; whatsappNote: string }> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/members', data });
    }
    const raw = await apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/members/add',
      data: mapCreateMemberPayload(data),
    });
    const member = mapMember((raw.member ?? raw) as Record<string, unknown>);
    return {
      member,
      whatsappNote: data.whatsappOptIn
        ? 'Welcome message queued on WhatsApp.'
        : 'Member added successfully.',
    };
  },
  update: async (id: string, data: UpdateMemberPayload): Promise<Member> => {
    if (isMockMode()) {
      return apiRequest<Member>({
        method: 'PATCH',
        path: `/members/${id}`,
        data,
      });
    }
    return real(
      {
        method: 'PATCH',
        path: `/members/${id}`,
        data: mapUpdateMemberPayload(data),
      },
      (raw) => mapMember(raw as Record<string, unknown>),
    );
  },
  remove: (id: string) =>
    isMockMode()
      ? apiRequest({ method: 'DELETE', path: `/members/${id}` })
      : apiRequest({ method: 'DELETE', path: `/members/${id}` }),
  resync: async (id: string): Promise<Member> => {
    if (isMockMode()) {
      return apiRequest<Member>({ method: 'POST', path: `/members/${id}/resync` });
    }
    await apiRequest({ method: 'POST', path: `/attendance/sync/${id}` });
    return membersApi.get(id);
  },
  freeze: async (data: FreezePayload): Promise<Member> => {
    if (isMockMode()) {
      return apiRequest({
        method: 'POST',
        path: `/members/${data.memberId}/freeze`,
        data,
      });
    }
    return real(
      {
        method: 'POST',
        path: `/members/${data.memberId}/freeze`,
        data: { days: data.days, reason: data.reason },
      },
      (raw) => mapMember(raw as Record<string, unknown>),
    );
  },
  unfreeze: async (id: string): Promise<Member> => {
    if (isMockMode()) {
      return apiRequest<Member>({ method: 'POST', path: `/members/${id}/unfreeze` });
    }
    return real(
      { method: 'POST', path: `/members/${id}/unfreeze` },
      (raw) => mapMember(raw as Record<string, unknown>),
    );
  },
  renew: async (
    data: RenewMemberPayload,
  ): Promise<{ member: Member; payment: Payment }> => {
    if (isMockMode()) {
      return apiRequest({
        method: 'POST',
        path: `/members/${data.memberId}/renew`,
        data,
      });
    }
    const raw = await apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: `/members/${data.memberId}/renew`,
      data: {
        planId: data.planId,
        offerId: data.offerId,
        paidAmount: data.paymentPkr,
        paymentMethod: data.method.toUpperCase(),
        startDate: data.startDate,
      },
    });
    return {
      member: mapMember((raw.member ?? raw) as Record<string, unknown>),
      payment: mapPayment((raw.payment ?? raw) as Record<string, unknown>),
    };
  },
  setReminders: async (id: string, enabled: boolean): Promise<Member> => {
    if (isMockMode()) {
      return apiRequest({
        method: 'PATCH',
        path: `/members/${id}/reminders`,
        data: { enabled },
      });
    }
    await apiRequest({
      method: 'PUT',
      path: `/whatsapp/automation/reminders`,
      data: { enabled, config: { memberId: id } },
    });
    return membersApi.get(id);
  },
  attendance: async (id: string): Promise<AttendanceRecord[]> => {
    if (isMockMode()) {
      return apiRequest<AttendanceRecord[]>({ path: `/members/${id}/attendance` });
    }
    const raw = await apiRequest({ path: `/attendance/calendar/${id}` });
    if (Array.isArray(raw)) return raw.map((r) => mapAttendance(r as Record<string, unknown>));
    const page = mapPaginated(raw, (r) => mapAttendance(r as Record<string, unknown>));
    return page.items;
  },
  payments: async (id: string): Promise<Payment[]> => {
    if (isMockMode()) {
      return apiRequest<Payment[]>({ path: `/members/${id}/payments` });
    }
    const page = await real(
      { path: '/payments', params: { memberId: id, limit: 50 } },
      (raw) => mapPaginated(raw, (p) => mapPayment(p as Record<string, unknown>)),
    );
    return page.items;
  },
};

export const attendanceApi = {
  live: async (params?: { page?: number; pageSize?: number; q?: string }) => {
    if (isMockMode()) {
      return apiRequest<Paginated<AttendanceRecord>>({ path: '/attendance/live', params });
    }
    const rows = await apiRequest<Record<string, unknown>[]>({
      path: '/attendance/live',
      params: { limit: params?.pageSize ?? 50 },
    });
    const items = rows.map((r) => mapAttendance(r));
    return {
      items,
      page: 1,
      pageSize: items.length,
      total: items.length,
      hasMore: false,
    } satisfies Paginated<AttendanceRecord>;
  },
  byDate: async (date: string, params?: { page?: number; pageSize?: number; q?: string }) => {
    if (isMockMode()) {
      return apiRequest<Paginated<AttendanceRecord>>({
        path: '/attendance',
        params: { date, ...params },
      });
    }
    return real(
      { path: '/attendance', params: { date, ...params } as Record<string, unknown> },
      (raw) => mapPaginated(raw, (r) => mapAttendance(r as Record<string, unknown>)),
    );
  },
  range: async (params: {
    from: string;
    to: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }) => {
    if (isMockMode()) {
      return apiRequest<Paginated<AttendanceRecord>>({ path: '/attendance', params });
    }
    return real(
      { path: '/attendance', params: params as Record<string, unknown> },
      (raw) => mapPaginated(raw, (r) => mapAttendance(r as Record<string, unknown>)),
    );
  },
  manual: async (data: ManualCheckInPayload): Promise<AttendanceRecord> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/attendance/manual', data });
    }
    return real(
      {
        method: 'POST',
        path: '/attendance/manual',
        data: {
          memberId: data.memberId,
          punchedAt: data.checkedInAt,
          direction: data.direction?.toUpperCase(),
          notes: data.reason,
        },
      },
      (raw) => mapAttendance(raw as Record<string, unknown>),
    );
  },
  update: async (id: string, data: UpdateAttendancePayload) => {
    if (isMockMode()) {
      return apiRequest<AttendanceRecord>({ method: 'PATCH', path: `/attendance/${id}`, data });
    }
    return real(
      {
        method: 'PATCH',
        path: `/attendance/${id}`,
        data: {
          punchedAt: data.checkedInAt,
          direction: data.direction?.toUpperCase(),
          notes: data.reason,
        },
      },
      (raw) => mapAttendance(raw as Record<string, unknown>),
    );
  },
  remove: async (id: string) => {
    if (isMockMode()) {
      return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/attendance/${id}` });
    }
    return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/attendance/${id}` });
  },
  devices: async (): Promise<AttendanceDevice[]> => {
    if (isMockMode()) return apiRequest({ path: '/attendance/devices' });
    const rows = await apiRequest<Record<string, unknown>[]>({ path: '/attendance/devices' });
    return rows.map((d) => mapAttendanceDevice(d));
  },
  pingDevice: async (id: string): Promise<AttendanceDevice> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: `/attendance/devices/${id}/ping` });
    }
    return real(
      { method: 'POST', path: `/attendance/devices/${id}/ping` },
      (raw) => mapAttendanceDevice(raw as Record<string, unknown>),
    );
  },
};

export const plansApi = {
  list: async (): Promise<Plan[]> => {
    if (isMockMode()) return apiRequest<Plan[]>({ path: '/plans' });
    const page = await real(
      { path: '/plans', params: { limit: 100 } },
      (raw) => mapPaginated(raw, (p) => mapPlan(p as Record<string, unknown>)),
    );
    return page.items;
  },
  create: async (data: Partial<Plan>): Promise<Plan> => {
    if (isMockMode()) return apiRequest({ method: 'POST', path: '/plans', data });
    return real(
      { method: 'POST', path: '/plans', data: mapPlanPayload(data) },
      (raw) => mapPlan(raw as Record<string, unknown>),
    );
  },
  update: async (id: string, data: Partial<Plan>): Promise<Plan> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: `/plans/${id}`, data });
    }
    return real(
      { method: 'PATCH', path: `/plans/${id}`, data: mapPlanPayload(data) },
      (raw) => mapPlan(raw as Record<string, unknown>),
    );
  },
  remove: (id: string) =>
    isMockMode()
      ? apiRequest({ method: 'DELETE', path: `/plans/${id}` })
      : apiRequest({ method: 'DELETE', path: `/plans/${id}` }),
};

export const paymentsApi = {
  list: async (params?: { page?: number; pageSize?: number; q?: string }) =>
    isMockMode()
      ? apiRequest<Paginated<Payment>>({ path: '/payments', params })
      : real(
          { path: '/payments', params: params as Record<string, unknown> },
          (raw) => mapPaginated(raw, (p) => mapPayment(p as Record<string, unknown>)),
        ),
  collect: async (
    data: CollectPaymentPayload,
  ): Promise<{ payment: Payment; invoice: Invoice }> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/payments', data });
    }
    const raw = await apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/payments',
      data: mapCollectPaymentPayload(data),
    });
    const payment = mapPayment(raw);
    if (payment.invoiceId) {
      const invRaw = await apiRequest<Record<string, unknown>>({
        path: `/invoices/${payment.invoiceId}`,
      });
      return { payment, invoice: mapInvoiceFromBackend(invRaw, undefined, payment) };
    }
    return {
      payment,
      invoice: mapInvoiceFromBackend(
        {
          id: payment.id,
          invoiceNumber: payment.invoiceNumber,
          memberId: payment.memberId,
          total: payment.paidPkr,
          paidAmount: payment.paidPkr,
          status: payment.status,
        },
        undefined,
        payment,
      ),
    };
  },
  invoice: async (id: string): Promise<Invoice> => {
    if (isMockMode()) {
      return apiRequest({ path: `/payments/${id}/invoice` });
    }
    try {
      const invRaw = await apiRequest<Record<string, unknown>>({ path: `/payments/${id}/invoice` });
      return mapInvoiceFromBackend(invRaw);
    } catch {
      const invRaw = await apiRequest<Record<string, unknown>>({ path: `/invoices/${id}` });
      return mapInvoiceFromBackend(invRaw);
    }
  },
  sendWhatsApp: async (id: string): Promise<WhatsAppMessage> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: `/payments/${id}/whatsapp` });
    }
    return real(
      { method: 'POST', path: `/payments/${id}/whatsapp` },
      (raw) => mapWhatsAppMessage(raw as Record<string, unknown>),
    );
  },
  dues: async (): Promise<DueItem[]> => {
    if (isMockMode()) return apiRequest({ path: '/dues' });
    const page = await real(
      { path: '/payments/dues', params: { limit: 200 } },
      (raw) => mapPaginated(raw, (d) => mapDueItem(d as Record<string, unknown>)),
    );
    return page.items;
  },
  report: async (params?: { from?: string; to?: string }): Promise<FeeReport> => {
    if (isMockMode()) {
      return apiRequest({ path: '/reports/fees', params });
    }
    return real(
      { path: '/payments/reports/summary', params: params as Record<string, unknown> },
      (raw) => mapFeeReport(raw as Record<string, unknown>),
    );
  },
};

export const offersApi = {
  list: async (params?: {
    active?: boolean;
    page?: number;
    pageSize?: number;
    q?: string;
    status?: string;
  }) =>
    isMockMode()
      ? apiRequest<Paginated<Offer>>({ path: '/offers', params })
      : real(
          { path: '/offers', params: { ...params, activeOnly: params?.active } as Record<string, unknown> },
          (raw) => mapPaginated(raw, (o) => mapOffer(o as Record<string, unknown>)),
        ),
  suggest: async (planId: string): Promise<Offer[]> => {
    if (isMockMode()) {
      return apiRequest({ path: '/offers/suggest', params: { planId } });
    }
    const rows = await apiRequest<Record<string, unknown>[]>({
      path: '/offers/applicable',
      params: { planId },
    });
    return rows.map((o) => mapOffer(o));
  },
  create: async (data: Partial<Offer>): Promise<Offer> => {
    if (isMockMode()) return apiRequest({ method: 'POST', path: '/offers', data });
    return real(
      { method: 'POST', path: '/offers', data: mapOfferPayload(data) },
      (raw) => mapOffer(raw as Record<string, unknown>),
    );
  },
  update: async (id: string, data: Partial<Offer>): Promise<Offer> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: `/offers/${id}`, data });
    }
    return real(
      { method: 'PATCH', path: `/offers/${id}`, data: mapOfferPayload(data) },
      (raw) => mapOffer(raw as Record<string, unknown>),
    );
  },
  remove: (id: string) =>
    isMockMode()
      ? apiRequest({ method: 'DELETE', path: `/offers/${id}` })
      : apiRequest({ method: 'DELETE', path: `/offers/${id}` }),
};

export const dietApi = {
  templates: async (): Promise<DietTemplate[]> => {
    if (isMockMode()) return apiRequest({ path: '/diet/templates' });
    const page = await real(
      { path: '/diet/templates', params: { limit: 100 } },
      (raw) => mapPaginated(raw, (t) => mapDietTemplate(t as Record<string, unknown>)),
    );
    return page.items;
  },
  createTemplate: async (data: Partial<DietTemplate>): Promise<DietTemplate> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/diet/templates', data });
    }
    return real(
      { method: 'POST', path: '/diet/templates', data: mapDietTemplateCreatePayload(data) },
      (raw) => mapDietTemplate(raw as Record<string, unknown>),
    );
  },
  deleteTemplate: async (id: string) => {
    if (isMockMode()) {
      return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/diet/templates/${id}` });
    }
    return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/diet/templates/${id}` });
  },
  assignments: async (memberId?: string): Promise<DietAssignment[]> => {
    if (isMockMode()) {
      return apiRequest({
        path: '/diet/assignments',
        params: memberId ? { memberId } : undefined,
      });
    }
    if (!memberId) return [];
    const rows = await apiRequest<Record<string, unknown>[]>({
      path: `/diet/schedule/${memberId}`,
    });
    return mapDietScheduleToAssignments(memberId, rows);
  },
  assign: async (data: {
    memberId: string;
    templateId: string;
    whatsappReminders?: boolean;
  }): Promise<DietAssignment> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/diet/assignments', data });
    }
    await apiRequest({
      method: 'POST',
      path: '/diet/assign',
      data: {
        memberId: data.memberId,
        templateId: data.templateId,
        startDate: new Date().toISOString(),
      },
    });
    const assignments = await dietApi.assignments(data.memberId);
    return (
      assignments[0] ?? {
        id: 'pending',
        memberId: data.memberId,
        memberName: '',
        templateId: data.templateId,
        templateName: '',
        startDate: new Date().toISOString().slice(0, 10),
        whatsappReminders: data.whatsappReminders ?? false,
        checkoffs: [],
      }
    );
  },
  deleteAssignment: async (id: string) => {
    if (isMockMode()) {
      return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/diet/assignments/${id}` });
    }
    return apiRequest<{ success: boolean }>({ method: 'DELETE', path: `/diet/assignments/${id}` });
  },
  toggleCheckoff: async (id: string): Promise<DietAssignment> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: `/diet/checkoffs/${id}/toggle` });
    }
    await apiRequest({ method: 'POST', path: `/diet/schedule/${id}/complete`, data: { completed: true } });
    const assignments = await dietApi.assignments();
    return (
      assignments.find((a) => a.checkoffs.some((c) => c.id === id)) ??
      assignments[0] ?? {
        id,
        memberId: '',
        memberName: '',
        templateId: '',
        templateName: '',
        startDate: new Date().toISOString().slice(0, 10),
        whatsappReminders: false,
        checkoffs: [],
      }
    );
  },
};

export const workoutApi = {
  exercises: async (): Promise<Exercise[]> => {
    if (isMockMode()) return apiRequest({ path: '/workout/exercises' });
    const page = await real(
      { path: '/workouts/exercises', params: { limit: 200 } },
      (raw) => mapPaginated(raw, (e) => mapExercise(e as Record<string, unknown>)),
    );
    return page.items;
  },
  createExercise: async (data: Partial<Exercise>): Promise<Exercise> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/workout/exercises', data });
    }
    return real(
      { method: 'POST', path: '/workouts/exercises', data },
      (raw) => mapExercise(raw as Record<string, unknown>),
    );
  },
  plans: async (): Promise<WorkoutPlan[]> => {
    if (isMockMode()) return apiRequest({ path: '/workout/plans' });
    const page = await real(
      { path: '/workouts/plans', params: { limit: 50 } },
      (raw) => mapPaginated(raw, (p) => mapWorkoutPlan(p as Record<string, unknown>)),
    );
    return page.items;
  },
  createPlan: async (data: Partial<WorkoutPlan>): Promise<WorkoutPlan> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/workout/plans', data });
    }
    return real(
      { method: 'POST', path: '/workouts/plans', data: mapWorkoutPlanPayload(data) },
      (raw) => mapWorkoutPlan(raw as Record<string, unknown>),
    );
  },
  updatePlan: async (id: string, data: Partial<WorkoutPlan>): Promise<WorkoutPlan> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: `/workout/plans/${id}`, data });
    }
    return real(
      { method: 'PATCH', path: `/workouts/plans/${id}`, data: mapWorkoutPlanPayload(data) },
      (raw) => mapWorkoutPlan(raw as Record<string, unknown>),
    );
  },
  addExerciseToDay: async (data: {
    planId?: string;
    day: Weekday;
    dayTitle?: string;
    dayNotes?: string;
    exercise: {
      exerciseName: string;
      muscleGroup?: string;
      sets: number;
      reps: string;
      restSec?: number;
      instructions?: string;
      imageUrl?: string;
      videoUrl?: string;
    };
  }) => {
    if (isMockMode()) {
      return apiRequest<WorkoutPlan>({ method: 'POST', path: '/workout/day-exercise', data });
    }
    const plans = await workoutApi.plans();
    const plan = plans.find((p) => p.id === data.planId) ?? plans[0];
    if (!plan) throw new Error('No workout plan found');
    const days = plan.days.map((d) =>
      d.day === data.day
        ? {
            ...d,
            title: data.dayTitle ?? d.title,
            notes: data.dayNotes ?? d.notes,
            exercises: [
              ...d.exercises,
              {
                exerciseId: data.exercise.exerciseName,
                ...data.exercise,
              },
            ],
          }
        : d,
    );
    return workoutApi.updatePlan(plan.id, { ...plan, days });
  },
  deleteDayExercise: async (planId: string, day: Weekday, exerciseIndex: number) => {
    if (isMockMode()) {
      return apiRequest<WorkoutPlan>({
        method: 'DELETE',
        path: `/workout/plans/${planId}/day/${day}/exercise/${exerciseIndex}`,
      });
    }
    const plans = await workoutApi.plans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    const days = plan.days.map((d) =>
      d.day === day
        ? { ...d, exercises: d.exercises.filter((_, idx) => idx !== exerciseIndex) }
        : d,
    );
    return workoutApi.updatePlan(planId, { ...plan, days });
  },
  assignments: async (memberId?: string): Promise<WorkoutAssignment[]> => {
    if (isMockMode()) {
      return apiRequest({
        path: '/workout/assignments',
        params: memberId ? { memberId } : undefined,
      });
    }
    if (!memberId) return [];
    const [streak, logs] = await Promise.all([
      apiRequest<Record<string, unknown>>({ path: `/workouts/streak/${memberId}` }),
      apiRequest({ path: `/workouts/logs/${memberId}`, params: { limit: 30 } }),
    ]);
    return mapWorkoutAssignmentsFromLogs(memberId, streak, logs);
  },
  assign: async (data: { memberId: string; planId: string }) => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/workout/assignments', data });
    }
    await apiRequest({
      method: 'POST',
      path: '/workouts/assign',
      data: {
        memberId: data.memberId,
        workoutPlanId: data.planId,
        startDate: new Date().toISOString().slice(0, 10),
      },
    });
    const assignments = await workoutApi.assignments(data.memberId);
    return assignments[0];
  },
  complete: async (id: string, data: { day: string; completedBy?: 'member' | 'trainer' }) => {
    if (isMockMode()) {
      return apiRequest({
        method: 'POST',
        path: `/workout/assignments/${id}/complete`,
        data,
      });
    }
    const memberId = id.replace(/^logs-/, '');
    await apiRequest({
      method: 'POST',
      path: '/workouts/logs',
      data: { memberId, notes: data.day, loggedAt: new Date().toISOString() },
    });
    const assignments = await workoutApi.assignments(memberId);
    return assignments[0];
  },
};

export const staffApi = {
  list: async (params?: { page?: number; pageSize?: number; q?: string; status?: string }) =>
    isMockMode()
      ? apiRequest<Paginated<StaffMember>>({ path: '/staff', params })
      : real(
          {
            path: '/staff',
            params: { ...params, search: params?.q } as Record<string, unknown>,
          },
          (raw) => mapPaginated(raw, (s) => mapStaff(s as Record<string, unknown>)),
        ),
  create: async (data: Partial<StaffMember>): Promise<StaffMember> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/staff', data });
    }
    return real(
      { method: 'POST', path: '/staff', data: mapStaffPayload(data) },
      (raw) => mapStaff(raw as Record<string, unknown>),
    );
  },
  update: async (id: string, data: Partial<StaffMember>): Promise<StaffMember> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: `/staff/${id}`, data });
    }
    return real(
      { method: 'PATCH', path: `/staff/${id}`, data: mapStaffPayload(data) },
      (raw) => mapStaff(raw as Record<string, unknown>),
    );
  },
  remove: (id: string) =>
    isMockMode()
      ? apiRequest({ method: 'DELETE', path: `/staff/${id}` })
      : apiRequest({ method: 'DELETE', path: `/staff/${id}` }),
  setSalary: async (id: string, status: 'paid' | 'unpaid'): Promise<StaffMember> => {
    if (isMockMode()) {
      return apiRequest<StaffMember>({
        method: 'POST',
        path: `/staff/${id}/salary`,
        data: { status },
      });
    }
    const now = new Date();
    await apiRequest({
      method: 'PUT',
      path: '/staff/salaries',
      data: {
        staffId: id,
        periodMonth: now.getUTCMonth() + 1,
        periodYear: now.getUTCFullYear(),
        amount: 0,
        paidAmount: 0,
        status: status.toUpperCase(),
      },
    });
    const page = await staffApi.list({ pageSize: 200 });
    const member = page.items.find((s) => s.id === id);
    if (!member) throw new Error('Staff member not found');
    return { ...member, salaryStatus: status };
  },
  attendance: async (date?: string): Promise<StaffAttendance[]> => {
    if (isMockMode()) {
      return apiRequest({
        path: '/staff/attendance',
        params: date ? { date } : undefined,
      });
    }
    const raw = await apiRequest<Record<string, unknown>[]>({
      path: '/staff/attendance',
      params: date ? { date } : undefined,
    });
    return (raw ?? []).map((row) => ({
      id: String(row.id ?? `${row.staffId}-${date ?? 'summary'}`),
      staffId: String(row.staffId ?? ''),
      staffName: String(row.staffName ?? row.fullName ?? ''),
      date: String(row.date ?? date ?? new Date().toISOString().slice(0, 10)),
      checkInAt: row.checkInAt as string | undefined,
      checkOutAt: row.checkOutAt as string | undefined,
      status: String(row.status ?? 'present').toLowerCase() as StaffAttendance['status'],
    }));
  },
  markAttendance: async (data: Partial<StaffAttendance>) => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/staff/attendance', data });
    }
    return apiRequest({
      method: 'POST',
      path: '/staff/attendance',
      data: {
        staffId: data.staffId,
        date: data.date,
        status: data.status,
        checkInAt: data.checkInAt,
        checkOutAt: data.checkOutAt,
      },
    });
  },
};

export type WhatsAppConnection = {
  connected: boolean;
  status: string;
  qrDataUrl?: string;
  provider?: string;
};

export const whatsappApi = {
  connection: async (): Promise<WhatsAppConnection> => {
    if (isMockMode()) {
      return apiRequest({
        path: '/whatsapp/connection',
      });
    }
    try {
      const raw = await apiRequest<Record<string, unknown>>({ path: '/whatsapp/connection' });
      return {
        connected: Boolean(raw.connected),
        status: String(raw.status ?? raw.state ?? 'disconnected'),
        qrDataUrl: (raw.qrDataUrl ?? raw.qrcode) as string | undefined,
        provider: raw.provider as string | undefined,
      };
    } catch {
      return { connected: false, status: 'unavailable' };
    }
  },
  connect: async (): Promise<WhatsAppConnection> => {
    if (isMockMode()) {
      return apiRequest({ method: 'POST', path: '/whatsapp/connect' });
    }
    const raw = await apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/whatsapp/connect',
    });
    return {
      connected: Boolean(raw.connected),
      status: String(raw.status ?? raw.state ?? 'disconnected'),
      qrDataUrl: (raw.qrDataUrl ?? raw.qrcode) as string | undefined,
      provider: raw.provider as string | undefined,
    };
  },
  settings: async (): Promise<WhatsAppSettings> => {
    if (isMockMode()) return apiRequest({ path: '/whatsapp/settings' });
    const [automation, templates, connection] = await Promise.all([
      apiRequest<Array<{ key: string; enabled: boolean; config?: Record<string, unknown> }>>({
        path: '/whatsapp/automation',
      }),
      apiRequest<Record<string, unknown>[]>({ path: '/whatsapp/templates' }),
      whatsappApi.connection(),
    ]);
    return mapWhatsAppSettings(
      automation,
      templates.map((t) => mapWhatsAppTemplate(t)),
      { connected: connection.connected },
    );
  },
  updateSettings: async (data: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: '/whatsapp/settings', data });
    }
    const current = await whatsappApi.settings();
    const updates = settingsToAutomationUpdates(current, data);
    await Promise.all(
      updates.map((row) =>
        apiRequest({
          method: 'PUT',
          path: `/whatsapp/automation/${row.key}`,
          data: { enabled: row.enabled },
        }),
      ),
    );
    if (data.providerConnected !== undefined && data.providerConnected !== current.providerConnected) {
      if (data.providerConnected) await whatsappApi.connect();
    }
    return whatsappApi.settings();
  },
  messages: async (params?: { page?: number; pageSize?: number }) =>
    isMockMode()
      ? apiRequest<Paginated<WhatsAppMessage>>({ path: '/whatsapp/messages', params })
      : real(
          { path: '/whatsapp/logs', params: params as Record<string, unknown> },
          (raw) => mapPaginated(raw, (m) => mapWhatsAppMessage(m as Record<string, unknown>)),
        ),
  templates: async (): Promise<WhatsAppTemplate[]> => {
    if (isMockMode()) return apiRequest({ path: '/whatsapp/templates' });
    const rows = await apiRequest<Record<string, unknown>[]>({ path: '/whatsapp/templates' });
    return rows.map((t) => mapWhatsAppTemplate(t));
  },
  saveTemplate: async (data: {
    key: string;
    name: string;
    body: string;
    language?: string;
  }): Promise<WhatsAppTemplate> => {
    if (isMockMode()) {
      return apiRequest({ method: 'PUT', path: '/whatsapp/templates', data });
    }
    return real(
      { method: 'PUT', path: '/whatsapp/templates', data },
      (raw) => mapWhatsAppTemplate(raw as Record<string, unknown>),
    );
  },
};

export const notificationsApi = {
  list: async (params?: { page?: number; pageSize?: number }) =>
    isMockMode()
      ? apiRequest<Paginated<AppNotification>>({ path: '/notifications', params })
      : real(
          { path: '/notifications', params: params as Record<string, unknown> },
          (raw) => mapPaginated(raw, (n) => mapNotification(n as Record<string, unknown>)),
        ),
  read: async (id: string) => {
    if (isMockMode()) {
      return apiRequest<AppNotification>({ method: 'POST', path: `/notifications/${id}/read` });
    }
    return real(
      { method: 'POST', path: `/notifications/${id}/read` },
      (raw) => mapNotification(raw as Record<string, unknown>),
    );
  },
  readAll: () =>
    isMockMode()
      ? apiRequest({ method: 'POST', path: '/notifications/read-all' })
      : apiRequest({ method: 'POST', path: '/notifications/read-all' }),
};
