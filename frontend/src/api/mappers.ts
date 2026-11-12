import type {
  AppNotification,
  AttendanceDevice,
  AttendanceRecord,
  AuthSession,
  AuthTokens,
  CollectPaymentPayload,
  CreateMemberPayload,
  DashboardStats,
  DietAssignment,
  DietCheckoff,
  DietMeal,
  DietTemplate,
  DueItem,
  Exercise,
  FeeReport,
  GymProfile,
  Invoice,
  Member,
  Offer,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Plan,
  Role,
  StaffMember,
  UpdateMemberPayload,
  User,
  Weekday,
  WhatsAppMessage,
  WhatsAppSettings,
  WhatsAppTemplate,
  WorkoutAssignment,
  WorkoutCompletion,
  WorkoutDay,
  WorkoutPlan,
} from './types';

export function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v && 'toString' in v) {
    return Number((v as { toString(): string }).toString()) || 0;
  }
  return 0;
}

export function toIso(d: unknown): string {
  if (d == null) return new Date(0).toISOString();
  if (typeof d === 'string') return d;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

export function toIsoDate(d: unknown): string {
  return toIso(d).slice(0, 10);
}

function jwtExpiresAt(accessToken: string): number {
  try {
    const part = accessToken.split('.')[1];
    if (!part) return Date.now() + 15 * 60_000;
    const json = JSON.parse(
      atob(part.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return json.exp ? json.exp * 1000 : Date.now() + 15 * 60_000;
  } catch {
    return Date.now() + 15 * 60_000;
  }
}

function mapRole(role: unknown): Role {
  const r = String(role ?? 'member').toLowerCase();
  if (r === 'owner' || r === 'manager' || r === 'trainer' || r === 'receptionist' || r === 'member') {
    return r;
  }
  return 'member';
}

export function mapUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    name: String(raw.fullName ?? raw.name ?? 'User'),
    phone: String(raw.phone ?? ''),
    role: mapRole(raw.role),
    avatarUrl: raw.avatarUrl as string | undefined,
    gymId: String(raw.gymId ?? ''),
    memberId: raw.memberId as string | undefined,
    staffId: raw.staffId as string | undefined,
  };
}

type BackendAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user?: Record<string, unknown>;
  needsPassword?: boolean;
};

export function mapAuthSession(
  raw: BackendAuthResponse,
  existingUser?: User | null,
): AuthSession & { needsPassword?: boolean } {
  const user = raw.user ? mapUser(raw.user) : existingUser;
  if (!user) {
    throw new Error('Auth response missing user');
  }
  const tokens: AuthTokens = {
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresAt: jwtExpiresAt(raw.accessToken),
  };
  return { user, tokens, needsPassword: raw.needsPassword };
}

export function mapAuthTokensOnly(
  raw: { accessToken: string; refreshToken: string },
  existing: AuthTokens | null,
): AuthTokens {
  return {
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresAt: jwtExpiresAt(raw.accessToken),
  };
}

export function normalizeApiParams(
  params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = { ...params };
  if (out.pageSize != null && out.limit == null) {
    out.limit = out.pageSize;
    delete out.pageSize;
  }
  if (out.q != null && out.search == null) {
    out.search = out.q;
    delete out.q;
  }
  if (out.active != null && out.activeOnly == null) {
    out.activeOnly = out.active;
    delete out.active;
  }
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });
  return Object.keys(out).length ? out : undefined;
}

export function mapPaginated<TItem, TOut>(
  raw: unknown,
  mapItem: (item: TItem) => TOut,
): Paginated<TOut> {
  if (raw && typeof raw === 'object' && 'items' in (raw as object)) {
    const p = raw as Paginated<TItem>;
    return {
      items: p.items.map((i) => mapItem(i)),
      page: p.page,
      pageSize: p.pageSize,
      total: p.total,
      hasMore: p.hasMore,
    };
  }
  const bag = raw as {
    data?: TItem[];
    meta?: { page: number; limit: number; total: number; totalPages?: number };
  };
  const data = bag.data ?? [];
  const meta = bag.meta ?? { page: 1, limit: data.length, total: data.length, totalPages: 1 };
  const page = meta.page ?? 1;
  const pageSize = meta.limit ?? 20;
  const total = meta.total ?? data.length;
  const totalPages = meta.totalPages ?? (Math.ceil(total / pageSize) || 0);
  return {
    items: data.map((i) => mapItem(i)),
    page,
    pageSize,
    total,
    hasMore: page < totalPages,
  };
}

function activeSubscription(raw: Record<string, unknown>) {
  const subs = raw.subscriptions as Record<string, unknown>[] | undefined;
  if (!subs?.length) return undefined;
  return subs[0];
}

export function mapMember(raw: Record<string, unknown>): Member {
  const sub = activeSubscription(raw);
  const plan = sub?.plan as Record<string, unknown> | undefined;
  const trainer = raw.trainer as Record<string, unknown> | undefined;
  const status = String(raw.status ?? 'ACTIVE').toLowerCase();
  const normalizedStatus =
    status === 'pending' ? 'active' : (status as Member['status']);

  let enrollmentStatus: Member['enrollmentStatus'] = 'pending';
  const maps = raw.deviceUserMaps as { syncStatus?: string }[] | undefined;
  if (maps?.length) {
    const st = String(maps[0].syncStatus ?? '').toUpperCase();
    enrollmentStatus = st === 'SYNCED' || st === 'OK' ? 'synced' : st === 'FAILED' ? 'failed' : 'pending';
  }

  const outstanding =
    toNumber(raw.outstandingPkr) ||
    toNumber(raw.dueAmount) ||
    toNumber((raw._sum as Record<string, unknown> | undefined)?.dueAmount);

  let paymentStatus: PaymentStatus = 'unpaid';
  if (outstanding <= 0) paymentStatus = 'paid';
  else if (toNumber(raw.paidAmount) > 0 || toNumber(sub?.paidAmount) > 0) paymentStatus = 'partial';

  return {
    id: String(raw.id),
    name: String(raw.fullName ?? raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    whatsappPhone: String(raw.whatsappPhone ?? raw.phone ?? ''),
    photoUrl: raw.photoUrl as string | undefined,
    gender: (String(raw.gender ?? 'other').toLowerCase() as Member['gender']) || 'other',
    dateOfBirth: raw.dateOfBirth ? toIsoDate(raw.dateOfBirth) : '',
    planId: String(sub?.planId ?? plan?.id ?? raw.planId ?? ''),
    planName: String(plan?.name ?? raw.planName ?? ''),
    startDate: sub?.startDate ? toIsoDate(sub.startDate) : toIsoDate(raw.startDate ?? raw.joinDate),
    endDate: sub?.endDate ? toIsoDate(sub.endDate) : toIsoDate(raw.endDate ?? raw.joinDate),
    trainerId: (raw.trainerStaffId ?? trainer?.id) as string | undefined,
    trainerName: trainer?.fullName as string | undefined,
    offerId: raw.offerId as string | undefined,
    offerTitle: raw.offerTitle as string | undefined,
    status: normalizedStatus,
    paymentStatus,
    outstandingPkr: outstanding,
    whatsappOptIn: Boolean(raw.whatsappOptIn ?? true),
    remindersEnabled: Boolean(raw.remindersEnabled ?? true),
    enrollmentStatus,
    lastSyncedAt: raw.lastSyncedAt ? toIso(raw.lastSyncedAt) : undefined,
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
  };
}

export function mapCreateMemberPayload(data: CreateMemberPayload): Record<string, unknown> {
  return {
    fullName: data.name,
    phone: data.phone,
    gender: data.gender,
    dateOfBirth: data.dateOfBirth,
    planId: data.planId,
    offerId: data.offerId,
    trainerStaffId: data.trainerId,
    paidAmount: data.openingPaymentPkr + (data.advancePkr ?? 0),
    paymentMethod: data.paymentMethod.toUpperCase(),
    startDate: data.startDate,
  };
}

export function mapUpdateMemberPayload(data: UpdateMemberPayload): Record<string, unknown> {
  return {
    fullName: data.name,
    phone: data.phone,
    gender: data.gender,
    dateOfBirth: data.dateOfBirth || undefined,
    trainerStaffId: data.trainerId,
  };
}

export function mapPlan(raw: Record<string, unknown>): Plan {
  return {
    id: String(raw.id),
    name: String(raw.name),
    durationDays: Number(raw.durationDays ?? 0),
    pricePkr: toNumber(raw.price ?? raw.pricePkr),
    description: raw.description as string | undefined,
    isActive: Boolean(raw.isActive ?? true),
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
  };
}

export function mapPlanPayload(data: Partial<Plan>): Record<string, unknown> {
  return {
    name: data.name,
    description: data.description,
    durationDays: data.durationDays,
    price: data.pricePkr,
    isActive: data.isActive,
  };
}

export function mapOffer(raw: Record<string, unknown>): Offer {
  const type = String(raw.type ?? '').toUpperCase();
  const value = toNumber(raw.value);
  return {
    id: String(raw.id),
    title: String(raw.name ?? raw.title ?? ''),
    description: String(raw.description ?? ''),
    discountPercent: type === 'PERCENT' ? value : undefined,
    discountAmountPkr: type === 'FIXED' ? value : undefined,
    validFrom: toIso(raw.validFrom),
    validTo: toIso(raw.validTo),
    planIds: raw.planId ? [String(raw.planId)] : ((raw.planIds as string[]) ?? []),
    isActive: Boolean(raw.isActive ?? true),
    autoSuggest: Boolean(raw.autoSuggest ?? true),
  };
}

export function mapOfferPayload(data: Partial<Offer>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: data.title,
    description: data.description,
    validFrom: data.validFrom,
    validTo: data.validTo,
    isActive: data.isActive,
    planId: data.planIds?.[0],
  };
  if (data.discountPercent != null) {
    body.type = 'PERCENT';
    body.value = data.discountPercent;
  } else if (data.discountAmountPkr != null) {
    body.type = 'FIXED';
    body.value = data.discountAmountPkr;
  }
  return body;
}

export function mapPayment(raw: Record<string, unknown>): Payment {
  const member = raw.member as Record<string, unknown> | undefined;
  const invoice = raw.invoice as Record<string, unknown> | undefined;
  const amount = toNumber(raw.amount ?? raw.amountPkr);
  return {
    id: String(raw.id),
    invoiceId: (raw.invoiceId ?? invoice?.id) as string | undefined,
    memberId: String(raw.memberId ?? member?.id ?? ''),
    memberName: String(member?.fullName ?? raw.memberName ?? ''),
    memberPhotoUrl: (member?.photoUrl ?? raw.memberPhotoUrl) as string | undefined,
    invoiceNumber: String(invoice?.invoiceNumber ?? raw.invoiceNumber ?? raw.reference ?? ''),
    amountPkr: amount,
    discountPkr: toNumber(raw.discount ?? raw.discountPkr),
    paidPkr: amount,
    duePkr: toNumber(raw.duePkr ?? raw.dueAmount),
    method: String(raw.method ?? 'cash').toLowerCase() as PaymentMethod,
    status: String(raw.status ?? 'paid').toLowerCase() as PaymentStatus,
    planId: raw.planId as string | undefined,
    planName: raw.planName as string | undefined,
    offerId: raw.offerId as string | undefined,
    notes: raw.notes as string | undefined,
    collectedBy: String(raw.collectedBy ?? raw.createdById ?? 'Staff'),
    paidAt: toIso(raw.paidAt ?? raw.createdAt),
    createdAt: toIso(raw.createdAt),
  };
}

export function mapCollectPaymentPayload(data: CollectPaymentPayload): Record<string, unknown> {
  return {
    memberId: data.memberId,
    amount: data.amountPkr,
    method: data.method.toUpperCase(),
    notes: data.notes,
    subscriptionId: undefined,
    invoiceId: undefined,
  };
}

export function mapDueItem(raw: Record<string, unknown>): DueItem {
  const member = raw.member as Record<string, unknown> | undefined;
  const due = toNumber(raw.dueAmount ?? raw.outstandingPkr);
  const dueDate = raw.dueDate ? new Date(toIso(raw.dueDate)) : new Date();
  const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86_400_000));
  return {
    memberId: String(raw.memberId ?? member?.id ?? ''),
    memberName: String(member?.fullName ?? raw.memberName ?? ''),
    phone: String(member?.phone ?? raw.phone ?? ''),
    outstandingPkr: due,
    planName: String(raw.planName ?? ''),
    endDate: toIsoDate(raw.dueDate ?? raw.endDate),
    daysOverdue,
  };
}

export function mapFeeReport(raw: Record<string, unknown>): FeeReport {
  const byMethod = ((raw.byMethod as Record<string, unknown>[]) ?? []).map((row) => {
    const sum = row._sum as Record<string, unknown> | undefined;
    return {
      label: String(row.method ?? row.label ?? 'Other'),
      amountPkr: toNumber(sum?.amount ?? row.amount ?? row.amountPkr),
    };
  });
  return {
    totalCollectedPkr: toNumber(raw.totalCollected ?? raw.totalCollectedPkr),
    totalDuePkr: toNumber(raw.totalDues ?? raw.totalDuePkr),
    byMethod,
    byDay: ((raw.byDay as FeeReport['byDay']) ?? []),
    period: String(raw.period ?? 'custom'),
  };
}

const DAY_NUM_TO_WEEKDAY: Record<number, Weekday> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
  0: 'sun',
};

export function mapAttendance(raw: Record<string, unknown>): AttendanceRecord {
  const member = raw.member as Record<string, unknown> | undefined;
  const device = raw.device as Record<string, unknown> | undefined;
  const direction = String(raw.direction ?? 'UNKNOWN').toLowerCase();
  return {
    id: String(raw.id),
    memberId: String(raw.memberId ?? member?.id ?? ''),
    memberName: String(member?.fullName ?? raw.memberName ?? 'Unknown'),
    memberPhotoUrl: member?.photoUrl as string | undefined,
    checkedInAt: toIso(raw.punchedAt ?? raw.checkedInAt),
    source: raw.isManual ? 'manual' : 'device',
    deviceId: device?.id as string | undefined,
    deviceName: device?.name as string | undefined,
    direction: direction === 'in' || direction === 'out' ? direction : undefined,
    status: mapAttendanceStatus(raw, member),
    reason: (raw.alertReason ?? raw.reason) as string | undefined,
    recordedBy: raw.createdById as string | undefined,
  };
}

function mapAttendanceStatus(
  raw: Record<string, unknown>,
  member?: Record<string, unknown>,
): AttendanceRecord['status'] {
  const alert = String(raw.alertReason ?? '').toLowerCase();
  if (alert.includes('frozen')) return 'frozen';
  if (alert.includes('unpaid')) return 'unpaid';
  if (alert.includes('expired')) return 'expired';
  const memberStatus = String(member?.status ?? '').toLowerCase();
  if (memberStatus === 'frozen') return 'frozen';
  if (memberStatus === 'expired') return 'expired';
  return raw.isMapped === false ? 'unpaid' : 'valid';
}

export function mapAttendanceDevice(raw: Record<string, unknown>): AttendanceDevice {
  const lastSeen = raw.lastSeenAt ? toIso(raw.lastSeenAt) : '';
  const online =
    lastSeen && Date.now() - new Date(lastSeen).getTime() < 5 * 60_000;
  return {
    id: String(raw.id),
    name: String(raw.name),
    serialNumber: String(raw.serialNumber),
    location: String(raw.location ?? ''),
    isOnline: Boolean(raw.isOnline ?? online),
    lastSeenAt: lastSeen || new Date().toISOString(),
    enrolledCount: Number(raw.enrolledCount ?? 0),
  };
}

export function mapGym(raw: Record<string, unknown>): GymProfile {
  const settings = (raw.settings ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id),
    name: String(raw.name),
    phone: String(raw.phone ?? ''),
    email: raw.email as string | undefined,
    address: String(raw.address ?? ''),
    city: String(raw.city ?? 'Karachi'),
    logoUrl: raw.logoUrl as string | undefined,
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    easypaisaNumber: (settings.easypaisaNumber ?? raw.easypaisaNumber) as string | undefined,
    jazzcashNumber: (settings.jazzcashNumber ?? raw.jazzcashNumber) as string | undefined,
    bankName: (settings.bankName ?? raw.bankName) as string | undefined,
    bankAccountTitle: (settings.bankAccountTitle ?? raw.bankAccountTitle) as string | undefined,
    bankAccountNumber: (settings.bankAccountNumber ?? raw.bankAccountNumber) as string | undefined,
    iban: (settings.iban ?? raw.iban) as string | undefined,
  };
}

export function mapGymPayload(data: Partial<GymProfile>): Record<string, unknown> {
  return {
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    logoUrl: data.logoUrl,
    settings: {
      easypaisaNumber: data.easypaisaNumber,
      jazzcashNumber: data.jazzcashNumber,
      bankName: data.bankName,
      bankAccountTitle: data.bankAccountTitle,
      bankAccountNumber: data.bankAccountNumber,
      iban: data.iban,
    },
  };
}

export function mapDashboard(
  raw: Record<string, unknown>,
  extras?: {
    recentCheckIns?: AttendanceRecord[];
    expiringMembers?: DashboardStats['expiringMembers'];
    todayCollectionPkr?: number;
  },
): DashboardStats {
  const members = (raw.members ?? {}) as Record<string, unknown>;
  const attendance = (raw.attendance ?? {}) as Record<string, unknown>;
  const finance = (raw.finance ?? {}) as Record<string, unknown>;
  const subscriptions = (raw.subscriptions ?? {}) as Record<string, unknown>;

  return {
    todayCheckIns: Number(attendance.todayCheckIns ?? raw.todayCheckIns ?? 0),
    activeMembers: Number(members.active ?? raw.activeMembers ?? 0),
    expiringIn7Days: Number(subscriptions.expiringIn7Days ?? raw.expiringIn7Days ?? 0),
    todayCollectionPkr: Number(extras?.todayCollectionPkr ?? raw.todayCollectionPkr ?? 0),
    pendingDuesPkr: toNumber(finance.openDues ?? raw.pendingDuesPkr),
    pendingEnrollments: Number(raw.pendingEnrollments ?? 0),
    recentCheckIns: extras?.recentCheckIns ?? (raw.recentCheckIns as AttendanceRecord[]) ?? [],
    expiringMembers: extras?.expiringMembers ?? (raw.expiringMembers as DashboardStats['expiringMembers']) ?? [],
  };
}

export function mapStaff(raw: Record<string, unknown>): StaffMember {
  const role = mapRole(raw.role);
  const staffRole = (role === 'member' ? 'trainer' : role) as StaffMember['role'];
  return {
    id: String(raw.id),
    name: String(raw.fullName ?? raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    role: staffRole,
    designation: raw.designation as string | undefined,
    salaryPkr: toNumber(raw.salaryAmount ?? raw.salaryPkr),
    salaryStatus: String(raw.salaryStatus ?? 'unpaid').toLowerCase() as StaffMember['salaryStatus'],
    joinDate: toIsoDate(raw.hireDate ?? raw.joinDate ?? raw.createdAt),
    isActive: Boolean(raw.isActive ?? true),
    assignedMemberIds: [],
    photoUrl: raw.photoUrl as string | undefined,
  };
}

export function mapStaffPayload(data: Partial<StaffMember>): Record<string, unknown> {
  return {
    fullName: data.name,
    phone: data.phone,
    role: data.role?.toUpperCase(),
    salaryAmount: data.salaryPkr,
    createLogin: true,
  };
}

export function mapWhatsAppTemplate(raw: Record<string, unknown>): WhatsAppTemplate {
  return {
    id: String(raw.id ?? raw.key),
    key: String(raw.key),
    name: String(raw.name),
    body: String(raw.body),
    language: String(raw.language ?? 'en'),
    metaTplId: raw.metaTplId as string | undefined,
    isActive: Boolean(raw.isActive ?? true),
    updatedAt: raw.updatedAt ? toIso(raw.updatedAt) : undefined,
  };
}

export function mapWhatsAppMessage(raw: Record<string, unknown>): WhatsAppMessage {
  const status = String(raw.status ?? 'pending').toLowerCase();
  return {
    id: String(raw.id),
    memberId: raw.memberId as string | undefined,
    memberName: raw.memberName as string | undefined,
    phone: String(raw.toPhone ?? raw.phone ?? ''),
    template: String(raw.templateKey ?? raw.template ?? ''),
    body: String(raw.body ?? ''),
    status: status as WhatsAppMessage['status'],
    createdAt: toIso(raw.createdAt ?? raw.sentAt),
    error: raw.error as string | undefined,
  };
}

export function mapWhatsAppSettings(
  automation: Array<{ key: string; enabled: boolean; config?: Record<string, unknown> }>,
  templates: WhatsAppTemplate[],
  connection?: { connected?: boolean },
): WhatsAppSettings {
  const byKey = Object.fromEntries(automation.map((a) => [a.key, a.enabled]));
  const tplKeys = new Set(templates.filter((t) => t.isActive).map((t) => t.key));
  const cfg = (key: string) => Boolean(byKey[key]);
  return {
    enabled: cfg('master') || cfg('whatsapp') || automation.some((a) => a.enabled),
    providerConnected: Boolean(connection?.connected ?? cfg('provider_connected')),
    welcomeTemplateReady: tplKeys.has('welcome'),
    paymentReminderTemplateReady: tplKeys.has('payment_reminder'),
    expiryReminderTemplateReady: tplKeys.has('expiry_reminder'),
    dietReminderTemplateReady: tplKeys.has('diet_reminder'),
    paymentDetailsInclude: cfg('payment_details') || cfg('include_payment_details'),
    gymInfoInclude: cfg('gym_info') || cfg('include_gym_info'),
  };
}

export function settingsToAutomationUpdates(
  prev: WhatsAppSettings,
  next: Partial<WhatsAppSettings>,
): Array<{ key: string; enabled: boolean }> {
  const rows: Array<{ key: string; enabled: boolean }> = [];
  if (next.enabled !== undefined && next.enabled !== prev.enabled) {
    rows.push({ key: 'master', enabled: next.enabled });
  }
  if (next.paymentDetailsInclude !== undefined && next.paymentDetailsInclude !== prev.paymentDetailsInclude) {
    rows.push({ key: 'payment_details', enabled: next.paymentDetailsInclude });
  }
  if (next.gymInfoInclude !== undefined && next.gymInfoInclude !== prev.gymInfoInclude) {
    rows.push({ key: 'gym_info', enabled: next.gymInfoInclude });
  }
  return rows;
}

export function mapNotification(raw: Record<string, unknown>): AppNotification {
  const type = String(raw.type ?? 'system').toLowerCase();
  const normalizedType =
    type === 'attendance' || type === 'payment' || type === 'expiry' || type === 'whatsapp'
      ? type
      : 'system';
  return {
    id: String(raw.id),
    title: String(raw.title),
    body: String(raw.body),
    type: normalizedType as AppNotification['type'],
    read: Boolean(raw.read ?? raw.isRead ?? false),
    createdAt: toIso(raw.createdAt),
    data: raw.data as Record<string, string> | undefined,
  };
}

export function mapDietTemplate(raw: Record<string, unknown>): DietTemplate {
  const meals = (raw.meals as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: String(raw.description ?? ''),
    meals: meals.map(
      (m, idx): DietMeal => ({
        id: String(m.id ?? idx),
        name: String(m.title ?? m.name ?? `Meal ${idx + 1}`),
        calories: toNumber(m.calories),
        proteinG: toNumber(m.proteinG),
        carbsG: toNumber(m.carbsG),
        fatsG: toNumber(m.fatsG),
        notes: String(m.foods ?? m.notes ?? ''),
      }),
    ),
    createdBy: String(raw.createdById ?? raw.createdBy ?? ''),
    updatedAt: toIso(raw.updatedAt),
  };
}

export function mapDietScheduleToAssignments(
  memberId: string,
  schedules: Record<string, unknown>[],
): DietAssignment[] {
  if (!schedules.length) return [];
  const memberName = '';
  const templateName = 'Diet schedule';
  const checkoffs: DietCheckoff[] = schedules.map((s, idx) => ({
    id: String(s.id ?? idx),
    date: toIsoDate(s.scheduleDate ?? s.date),
    mealId: String(s.id ?? idx),
    mealName: String(s.title ?? s.mealType ?? 'Meal'),
    completed: Boolean(s.completed),
    completedAt: s.completedAt ? toIso(s.completedAt) : undefined,
  }));
  const dates = checkoffs.map((c) => c.date).sort();
  return [
    {
      id: `schedule-${memberId}`,
      memberId,
      memberName,
      templateId: '',
      templateName,
      startDate: dates[0] ?? toIsoDate(new Date()),
      whatsappReminders: false,
      checkoffs,
    },
  ];
}

export function mapDietTemplateCreatePayload(data: Partial<DietTemplate>): Record<string, unknown> {
  return {
    name: data.name,
    description: data.description,
    calories: data.meals?.reduce((s, m) => s + (m.calories || 0), 0),
    meals: data.meals?.map((m, i) => ({
      mealType: 'CUSTOM',
      title: m.name,
      foods: m.notes ?? '',
      calories: m.calories,
      proteinG: m.proteinG,
      carbsG: m.carbsG,
      fatsG: m.fatsG,
      sortOrder: i,
    })),
  };
}

export function mapExercise(raw: Record<string, unknown>): Exercise {
  return {
    id: String(raw.id),
    name: String(raw.name),
    muscleGroup: String(raw.muscleGroup ?? raw.category ?? ''),
    equipment: raw.equipment as string | undefined,
    instructions: raw.instructions as string | undefined,
    imageUrl: raw.imageUrl as string | undefined,
    videoUrl: raw.videoUrl as string | undefined,
  };
}

export function mapWorkoutPlan(raw: Record<string, unknown>): WorkoutPlan {
  const daysRaw = (raw.days as Record<string, unknown>[] | undefined) ?? [];
  const days: WorkoutDay[] = daysRaw.map((d) => {
    const dayNum = Number(d.dayNumber ?? 1);
    const wk = DAY_NUM_TO_WEEKDAY[dayNum % 7] ?? 'mon';
    const exercisesJson = (d.exercises ?? []) as Record<string, unknown>[];
    return {
      day: (d.day as Weekday) ?? wk,
      title: d.name as string | undefined,
      notes: d.notes as string | undefined,
      exercises: exercisesJson.map((ex, idx) => ({
        exerciseId: String(ex.exerciseId ?? ex.id ?? idx),
        exerciseName: String(ex.exerciseName ?? ex.name ?? ''),
        sets: Number(ex.sets ?? 3),
        reps: String(ex.reps ?? '10'),
        restSec: ex.restSec as number | undefined,
        muscleGroup: ex.muscleGroup as string | undefined,
        instructions: ex.instructions as string | undefined,
        imageUrl: ex.imageUrl as string | undefined,
        videoUrl: ex.videoUrl as string | undefined,
      })),
    };
  });
  if (!days.length) {
    DAYS_WEEK.forEach((day) => days.push({ day, exercises: [] }));
  }
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: String(raw.description ?? ''),
    days,
    createdBy: String(raw.createdById ?? ''),
    updatedAt: toIso(raw.updatedAt),
  };
}

const DAYS_WEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function mapWorkoutPlanPayload(data: Partial<WorkoutPlan>): Record<string, unknown> {
  const days = data.days?.map((d, idx) => ({
    dayNumber: DAYS_WEEK.indexOf(d.day) >= 0 ? DAYS_WEEK.indexOf(d.day) + 1 : idx + 1,
    name: d.title ?? d.day,
    notes: d.notes,
    exercises: d.exercises,
  }));
  return {
    name: data.name,
    description: data.description,
    days,
  };
}

export function mapWorkoutAssignmentsFromLogs(
  memberId: string,
  streakRaw: Record<string, unknown>,
  logsRaw: unknown,
): WorkoutAssignment[] {
  const paginated = mapPaginated<Record<string, unknown>, WorkoutCompletion>(logsRaw, (log) => ({
    id: String(log.id),
    date: toIsoDate(log.loggedAt ?? log.date),
    day: 'mon',
    completed: true,
    completedAt: toIso(log.loggedAt),
    notes: log.notes as string | undefined,
  }));
  if (!paginated.items.length && !streakRaw.streak) return [];
  return [
    {
      id: `logs-${memberId}`,
      memberId,
      memberName: '',
      planId: '',
      planName: 'Workout log',
      startDate: paginated.items[0]?.date ?? toIsoDate(new Date()),
      streakDays: Number(streakRaw.streak ?? 0),
      completions: paginated.items,
    },
  ];
}

export function mapInvoiceFromBackend(
  raw: Record<string, unknown>,
  gym?: GymProfile,
  payment?: Payment,
): Invoice {
  const member = raw.member as Record<string, unknown> | undefined;
  const pay =
    payment ??
    mapPayment({
      id: String(raw.id),
      memberId: String(raw.memberId ?? member?.id ?? ''),
      amount: raw.paidAmount ?? raw.total,
      invoiceNumber: raw.invoiceNumber,
      paidAt: raw.issueDate,
      createdAt: raw.createdAt,
      method: 'cash',
      status: String(raw.status ?? 'paid').toLowerCase(),
      member,
    });
  return {
    payment: pay,
    gym: gym ?? mapGym((raw.gym as Record<string, unknown>) ?? { id: '', name: 'Gym' }),
    member: {
      id: String(member?.id ?? pay.memberId),
      name: String(member?.fullName ?? pay.memberName),
      phone: String(member?.phone ?? ''),
      planName: pay.planName ?? '',
    },
  };
}
