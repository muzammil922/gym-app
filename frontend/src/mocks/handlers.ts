import type {
  AuthSession,
  CollectPaymentPayload,
  CreateMemberPayload,
  DashboardStats,
  DueItem,
  FeeReport,
  FreezePayload,
  LoginPayload,
  ManualCheckInPayload,
  OtpRequestPayload,
  OtpVerifyPayload,
  Paginated,
  RenewMemberPayload,
  Role,
} from '@/src/api/types';
import { addDaysIso, daysUntil, todayIso } from '@/src/utils/date';
import {
  cloneAttendance,
  cloneDevice,
  cloneDietAssignment,
  cloneDietTemplate,
  cloneExercise,
  cloneMember,
  cloneMessage,
  cloneNotification,
  cloneOffer,
  clonePayment,
  clonePlan,
  cloneStaff,
  cloneStaffAttendance,
  cloneWorkoutAssignment,
  cloneWorkoutPlan,
  db,
  nextId,
} from './db';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    pageSize,
    total: items.length,
    hasMore: start + pageSize < items.length,
  };
}

function makeSession(userId: string): AuthSession {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw { status: 401, message: 'User not found' };
  const { password: _p, ...safe } = user;
  return {
    user: safe,
    tokens: {
      accessToken: `access_${user.id}_${Date.now()}`,
      refreshToken: `refresh_${user.id}`,
      expiresAt: Date.now() + 1000 * 60 * 55,
    },
  };
}

export async function mockRequest<T>(
  method: string,
  path: string,
  data?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  await delay();
  const m = method.toUpperCase();
  const p = path.replace(/\/+$/, '') || '/';

  // Auth
  if (m === 'POST' && p === '/auth/login') {
    const body = data as LoginPayload;
    const user = db.users.find((u) => u.phone === body.phone && u.password === body.password);
    if (!user) throw { status: 401, message: 'Invalid phone or password' };
    return makeSession(user.id) as T;
  }
  if (m === 'POST' && p === '/auth/otp/request') {
    const body = data as OtpRequestPayload;
    const user = db.users.find((u) => u.phone === body.phone);
    if (!user) throw { status: 404, message: 'Phone not registered' };
    if (user.role !== 'member') {
      throw { status: 400, message: 'Staff accounts sign in with a password' };
    }
    db.otpCodes.set(body.phone, '123456');
    return { ok: true, demoOtp: '123456', expiresInSeconds: 300 } as T;
  }
  if (m === 'POST' && p === '/auth/otp/verify') {
    const body = data as OtpVerifyPayload;
    const expected = db.otpCodes.get(body.phone);
    if (!expected || expected !== body.otp) {
      throw { status: 400, message: 'Invalid OTP' };
    }
    const user = db.users.find((u) => u.phone === body.phone);
    if (!user) throw { status: 404, message: 'Phone not registered' };
    db.otpCodes.delete(body.phone);
    const session = makeSession(user.id);
    const needsPassword = !db.usersWithPassword.has(user.id);
    return { ...session, needsPassword } as T;
  }
  if (m === 'POST' && p === '/auth/password') {
    const body = data as { newPassword?: string; userId?: string };
    if (!body?.newPassword || body.newPassword.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters' };
    }
    const userId = String(body.userId ?? params?.userId ?? 'u_member');
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.password = body.newPassword;
      db.usersWithPassword.add(user.id);
    }
    return { success: true } as T;
  }
  if (m === 'POST' && p === '/auth/refresh') {
    const refresh = (data as { refreshToken?: string })?.refreshToken ?? '';
    const userId = refresh.replace('refresh_', '');
    return makeSession(userId) as T;
  }
  if (m === 'POST' && p === '/auth/logout') return { ok: true } as T;
  if (m === 'GET' && p === '/auth/me') {
    const role = (params?.role as Role) || 'owner';
    const user = db.users.find((u) => u.role === role) ?? db.users[0];
    const { password: _p, ...safe } = user;
    return safe as T;
  }

  // Gym / settings
  if (m === 'GET' && p === '/gym') return { ...db.gym } as T;
  if (m === 'PUT' && p === '/gym') {
    db.gym = { ...db.gym, ...(data as object) };
    return { ...db.gym } as T;
  }

  // Dashboard
  if (m === 'GET' && p === '/dashboard') {
    const today = todayIso();
    const todayCheckIns = db.attendance.filter((a) => a.checkedInAt.startsWith(today));
    const activeMembers = db.members.filter((x) => x.status === 'active').length;
    const expiring = db.members.filter(
      (x) => x.status === 'active' && daysUntil(x.endDate) >= 0 && daysUntil(x.endDate) <= 7,
    );
    const todayPayments = db.payments.filter((pay) => pay.paidAt.startsWith(today));
    const stats: DashboardStats = {
      todayCheckIns: todayCheckIns.length,
      activeMembers,
      expiringIn7Days: expiring.length,
      todayCollectionPkr: todayPayments.reduce((s, pay) => s + pay.paidPkr, 0),
      pendingDuesPkr: db.members.reduce((s, mem) => s + mem.outstandingPkr, 0),
      pendingEnrollments: db.members.filter((x) => x.enrollmentStatus === 'pending').length,
      recentCheckIns: todayCheckIns.slice(0, 8).map((a) => {
        const member = db.members.find((m) => m.id === a.memberId);
        return {
          ...cloneAttendance(a),
          memberPhotoUrl: a.memberPhotoUrl ?? member?.photoUrl,
        };
      }),
      expiringMembers: expiring.map((x) => ({
        id: x.id,
        name: x.name,
        endDate: x.endDate,
        planName: x.planName,
        photoUrl: x.photoUrl,
      })),
    };
    return stats as T;
  }

  // Members
  if (m === 'GET' && p === '/members') {
    let items = [...db.members];
    const q = String(params?.q ?? '').toLowerCase();
    const status = params?.status as string | undefined;
    const paymentStatus = params?.paymentStatus as string | undefined;
    if (q) {
      items = items.filter(
        (x) => x.name.toLowerCase().includes(q) || x.phone.includes(q),
      );
    }
    if (status) items = items.filter((x) => x.status === status);
    if (paymentStatus) items = items.filter((x) => x.paymentStatus === paymentStatus);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const result = paginate(items.map(cloneMember), page, pageSize);
    return result as T;
  }
  if (m === 'GET' && p.startsWith('/members/') && !p.includes('/')) {
    // handled below with more segments
  }
  const memberMatch = p.match(/^\/members\/([^/]+)(.*)$/);
  if (memberMatch) {
    const memberId = memberMatch[1];
    const rest = memberMatch[2] || '';
    const member = db.members.find((x) => x.id === memberId);
    if (!member && m !== 'POST') throw { status: 404, message: 'Member not found' };

    if (m === 'GET' && rest === '') return cloneMember(member!) as T;
    if (m === 'DELETE' && rest === '') {
      db.members = db.members.filter((x) => x.id !== memberId);
      return { ok: true } as T;
    }
    if (m === 'PATCH' && rest === '') {
      const body = data as {
        name?: string;
        phone?: string;
        whatsappPhone?: string;
        photoUri?: string;
        gender?: 'male' | 'female' | 'other';
        dateOfBirth?: string;
        trainerId?: string;
        whatsappOptIn?: boolean;
      };
      if (body.name != null) member!.name = body.name;
      if (body.phone != null) member!.phone = body.phone;
      if (body.whatsappPhone != null) member!.whatsappPhone = body.whatsappPhone;
      if (body.photoUri != null) member!.photoUrl = body.photoUri;
      if (body.gender != null) member!.gender = body.gender;
      if (body.dateOfBirth != null) member!.dateOfBirth = body.dateOfBirth;
      if (body.whatsappOptIn != null) member!.whatsappOptIn = body.whatsappOptIn;
      if (body.trainerId !== undefined) {
        const trainer = db.staff.find((s) => s.id === body.trainerId);
        member!.trainerId = body.trainerId || undefined;
        member!.trainerName = trainer?.name;
      }
      member!.updatedAt = new Date().toISOString();
      return cloneMember(member!) as T;
    }
    if (m === 'POST' && rest === '/resync') {
      member!.enrollmentStatus = 'synced';
      member!.lastSyncedAt = new Date().toISOString();
      return cloneMember(member!) as T;
    }
    if (m === 'POST' && rest === '/freeze') {
      const body = data as FreezePayload;
      member!.status = 'frozen';
      member!.endDate = addDaysIso(member!.endDate, body.days);
      member!.updatedAt = new Date().toISOString();
      return cloneMember(member!) as T;
    }
    if (m === 'POST' && rest === '/unfreeze') {
      member!.status = 'active';
      member!.updatedAt = new Date().toISOString();
      return cloneMember(member!) as T;
    }
    if (m === 'POST' && rest === '/renew') {
      const body = data as RenewMemberPayload;
      const plan = db.plans.find((x) => x.id === body.planId);
      if (!plan) throw { status: 400, message: 'Invalid plan' };
      const start = body.startDate || todayIso();
      member!.planId = plan.id;
      member!.planName = plan.name;
      member!.startDate = start;
      member!.endDate = addDaysIso(start, plan.durationDays);
      member!.status = 'active';
      member!.offerId = body.offerId;
      member!.offerTitle = db.offers.find((o) => o.id === body.offerId)?.title;
      const due = Math.max(0, plan.pricePkr - body.paymentPkr);
      member!.outstandingPkr = due;
      member!.paymentStatus = due === 0 ? 'paid' : body.paymentPkr > 0 ? 'partial' : 'unpaid';
      member!.updatedAt = new Date().toISOString();
      const payment = {
        id: nextId('pay'),
        memberId: member!.id,
        memberName: member!.name,
        invoiceNumber: `INV-${1000 + db.payments.length + 1}`,
        amountPkr: plan.pricePkr,
        discountPkr: 0,
        paidPkr: body.paymentPkr,
        duePkr: due,
        method: body.method,
        status: member!.paymentStatus,
        planId: plan.id,
        planName: plan.name,
        offerId: body.offerId,
        collectedBy: 'Staff',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      db.payments.unshift(payment);
      return { member: cloneMember(member!), payment: clonePayment(payment) } as T;
    }
    if (m === 'PATCH' && rest === '/reminders') {
      member!.remindersEnabled = Boolean((data as { enabled: boolean }).enabled);
      return cloneMember(member!) as T;
    }
    if (m === 'GET' && rest === '/attendance') {
      return db.attendance
        .filter((a) => a.memberId === memberId)
        .map(cloneAttendance) as T;
    }
    if (m === 'GET' && rest === '/payments') {
      return db.payments
        .filter((pay) => pay.memberId === memberId)
        .map((pay) => ({
          ...clonePayment(pay),
          memberPhotoUrl: pay.memberPhotoUrl ?? member?.photoUrl,
        })) as T;
    }
  }

  if (m === 'POST' && p === '/members') {
    const body = data as CreateMemberPayload;
    const plan = db.plans.find((x) => x.id === body.planId);
    if (!plan) throw { status: 400, message: 'Invalid plan' };
    const trainer = db.staff.find((s) => s.id === body.trainerId);
    const offer = db.offers.find((o) => o.id === body.offerId);
    const opening = Math.max(0, body.openingPaymentPkr || 0);
    const advance = Math.max(0, body.advancePkr || 0);
    const totalPaid = opening + advance;
    // Advance also counts toward plan; leftover advance sits as paid credit in notes
    const due = Math.max(0, plan.pricePkr - totalPaid);
    const member = {
      id: nextId('m'),
      name: body.name,
      phone: body.phone,
      whatsappPhone: body.whatsappPhone,
      photoUrl: body.photoUri,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth,
      planId: plan.id,
      planName: plan.name,
      startDate: body.startDate,
      endDate: addDaysIso(body.startDate, plan.durationDays),
      trainerId: trainer?.id,
      trainerName: trainer?.name,
      offerId: offer?.id,
      offerTitle: offer?.title,
      status: 'active' as const,
      paymentStatus: (due === 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid') as
        | 'paid'
        | 'partial'
        | 'unpaid',
      outstandingPkr: due,
      whatsappOptIn: body.whatsappOptIn,
      remindersEnabled: body.whatsappOptIn,
      enrollmentStatus: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.members.unshift(member);
    // One combined invoice for opening + advance
    if (totalPaid > 0) {
      const billed = plan.pricePkr + (totalPaid > plan.pricePkr ? totalPaid - plan.pricePkr : 0);
      db.payments.unshift({
        id: nextId('pay'),
        memberId: member.id,
        memberName: member.name,
        memberPhotoUrl: member.photoUrl,
        invoiceNumber: `INV-${1000 + db.payments.length + 1}`,
        amountPkr: billed,
        discountPkr: 0,
        paidPkr: totalPaid,
        duePkr: due,
        method: body.paymentMethod,
        status: member.paymentStatus,
        planId: plan.id,
        planName: plan.name,
        offerId: offer?.id,
        notes: [
          opening > 0 ? `Opening ${opening}` : null,
          advance > 0 ? `Advance ${advance}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        collectedBy: 'Staff',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (body.whatsappOptIn) {
      db.messages.unshift({
        id: nextId('msg'),
        memberId: member.id,
        memberName: member.name,
        phone: member.whatsappPhone,
        template: 'welcome',
        body: `Welcome to ${db.gym.name}, ${member.name}! Your ${plan.name} is active.`,
        status: 'queued',
        createdAt: new Date().toISOString(),
      });
    }
    return {
      member: cloneMember(member),
      whatsappNote: body.whatsappOptIn
        ? 'WhatsApp welcome message has been queued for delivery.'
        : 'Member created. WhatsApp welcome skipped (opt-in off).',
    } as T;
  }

  // Attendance
  if (m === 'GET' && p === '/attendance/live') {
    const today = todayIso();
    const q = String(params?.q ?? '').toLowerCase();
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    let items = db.attendance
      .filter((a) => a.checkedInAt.startsWith(today))
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .map((a) => {
        const member = db.members.find((mem) => mem.id === a.memberId);
        return {
          ...cloneAttendance(a),
          memberPhotoUrl: a.memberPhotoUrl ?? member?.photoUrl,
        };
      });
    if (q) {
      items = items.filter(
        (a) =>
          a.memberName.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          (a.deviceName || '').toLowerCase().includes(q),
      );
    }
    return paginate(items, page, pageSize) as T;
  }
  if (m === 'GET' && p === '/attendance') {
    // Support either a single day (`date`) or a range (`from` + `to`).
    const date = params?.date ? String(params.date) : undefined;
    const from = params?.from ? String(params.from).slice(0, 10) : undefined;
    const to = params?.to ? String(params.to).slice(0, 10) : undefined;
    const q = String(params?.q ?? '').toLowerCase();
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);

    const inRange = (iso: string) => {
      const day = iso.slice(0, 10);
      if (date) return day === date;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    };

    let items = db.attendance
      .filter((a) => inRange(a.checkedInAt))
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .map((a) => {
        const member = db.members.find((mem) => mem.id === a.memberId);
        return {
          ...cloneAttendance(a),
          memberPhotoUrl: a.memberPhotoUrl ?? member?.photoUrl,
        };
      });
    if (q) {
      items = items.filter((a) => a.memberName.toLowerCase().includes(q));
    }
    return paginate(items, page, pageSize) as T;
  }
  if (m === 'POST' && p === '/attendance/manual') {
    const body = data as ManualCheckInPayload;
    let member = db.members.find((x) => x.id === body.memberId);
    if (!member) {
      const s = db.staff.find((x) => x.id === body.memberId);
      if (s) {
        member = {
          id: s.id,
          name: s.name,
          photoUrl: s.photoUrl,
          status: s.isActive ? 'active' : 'inactive',
          endDate: '2099-12-31',
          outstandingPkr: 0,
        } as any;
      }
    }
    if (!member) throw { status: 404, message: 'Member or employee not found' };
    const memberStatus =
      member.status === 'frozen'
        ? 'frozen'
        : member.status === 'expired' || daysUntil(member.endDate) < 0
          ? 'expired'
          : member.outstandingPkr > 0
            ? 'unpaid'
            : 'valid';
    const reqStatus = (body as any).status || ('check_in' as const);
    const reqDirection =
      (body as any).direction || (reqStatus === 'check_out' ? 'out' : 'in');
    const record = {
      id: nextId('att'),
      memberId: member.id,
      memberName: member.name,
      memberPhotoUrl: member.photoUrl,
      checkedInAt: (body as any).checkedInAt || new Date().toISOString(),
      source: 'manual' as const,
      status: reqStatus,
      direction: reqDirection,
      reason: body.reason,
      recordedBy: 'Staff',
    };
    db.attendance.unshift(record);
    if (memberStatus !== 'valid') {
      db.notifications.unshift({
        id: nextId('n'),
        title: `${memberStatus} check-in`,
        body: `${member.name} checked in (${memberStatus}).`,
        type: 'attendance',
        read: false,
        createdAt: new Date().toISOString(),
        data: { memberId: member.id },
      });
    }
    return cloneAttendance(record) as T;
  }
  if ((m === 'PATCH' || m === 'PUT') && /^\/attendance\/[^/]+$/.test(p)) {
    const id = p.split('/')[2];
    const idx = db.attendance.findIndex((x) => x.id === id);
    if (idx === -1) throw { status: 404, message: 'Attendance record not found' };
    const body = data as any;
    const existing = db.attendance[idx];
    const newStatus = body.status ?? existing.status;
    const newDirection =
      body.direction ?? (newStatus === 'check_out' ? 'out' : existing.direction ?? 'in');

    db.attendance[idx] = {
      ...existing,
      status: newStatus,
      direction: newDirection,
      checkedInAt: body.checkedInAt ?? existing.checkedInAt,
      reason: body.reason !== undefined ? body.reason : existing.reason,
    };
    return cloneAttendance(db.attendance[idx]) as T;
  }
  if (m === 'DELETE' && /^\/attendance\/[^/]+$/.test(p)) {
    const id = p.split('/')[2];
    const idx = db.attendance.findIndex((x) => x.id === id);
    if (idx !== -1) {
      db.attendance.splice(idx, 1);
    }
    return { success: true } as T;
  }
  if (m === 'GET' && p === '/attendance/devices') {
    return db.devices.map(cloneDevice) as T;
  }
  if (m === 'POST' && /^\/attendance\/devices\/[^/]+\/ping$/.test(p)) {
    const id = p.split('/')[3];
    const device = db.devices.find((d) => d.id === id);
    if (!device) throw { status: 404, message: 'Device not found' };
    device.isOnline = true;
    device.lastSeenAt = new Date().toISOString();
    return cloneDevice(device) as T;
  }

  // Plans
  if (m === 'GET' && p === '/plans') return db.plans.map(clonePlan) as T;
  if (m === 'POST' && p === '/plans') {
    const body = data as Partial<(typeof db.plans)[0]>;
    const plan = {
      id: nextId('plan'),
      name: body.name || 'New Plan',
      durationDays: body.durationDays || 30,
      pricePkr: body.pricePkr || 0,
      description: body.description,
      isActive: body.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.plans.push(plan);
    return clonePlan(plan) as T;
  }
  if ((m === 'PUT' || m === 'PATCH') && p.startsWith('/plans/')) {
    const id = p.split('/')[2];
    const idx = db.plans.findIndex((x) => x.id === id);
    if (idx < 0) throw { status: 404, message: 'Plan not found' };
    db.plans[idx] = { ...db.plans[idx], ...(data as object), updatedAt: new Date().toISOString() };
    return clonePlan(db.plans[idx]) as T;
  }
  if (m === 'DELETE' && p.startsWith('/plans/')) {
    const id = p.split('/')[2];
    db.plans = db.plans.filter((x) => x.id !== id);
    return { ok: true } as T;
  }

  // Payments / fees
  if (m === 'POST' && p === '/payments') {
    const body = data as CollectPaymentPayload;
    const member = db.members.find((x) => x.id === body.memberId);
    if (!member) throw { status: 404, message: 'Member not found' };
    const amount = body.amountPkr;
    const discount = body.discountPkr || 0;
    const netDue = Math.max(0, member.outstandingPkr - discount);
    const paid = Math.min(amount, netDue || amount);
    const newOutstanding = Math.max(0, (netDue || member.outstandingPkr) - paid);
    member.outstandingPkr = newOutstanding;
    member.paymentStatus = newOutstanding === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    if (body.renew && body.planId) {
      const plan = db.plans.find((x) => x.id === body.planId);
      if (plan) {
        member.planId = plan.id;
        member.planName = plan.name;
        member.startDate = todayIso();
        member.endDate = addDaysIso(todayIso(), plan.durationDays);
        member.status = 'active';
      }
    }
    const payment = {
      id: nextId('pay'),
      memberId: member.id,
      memberName: member.name,
      invoiceNumber: `INV-${1000 + db.payments.length + 1}`,
      amountPkr: amount + discount,
      discountPkr: discount,
      paidPkr: paid,
      duePkr: newOutstanding,
      method: body.method,
      status: member.paymentStatus,
      planId: body.planId || member.planId,
      planName: member.planName,
      offerId: body.offerId,
      notes: body.notes,
      collectedBy: 'Staff',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.payments.unshift(payment);
    return {
      payment: clonePayment(payment),
      invoice: {
        payment: clonePayment(payment),
        gym: { ...db.gym },
        member: {
          id: member.id,
          name: member.name,
          phone: member.phone,
          planName: member.planName,
        },
      },
    } as T;
  }
  if (m === 'GET' && p === '/payments') {
    const q = String(params?.q ?? '').toLowerCase();
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    let items = db.payments.map((pay) => {
      const member = db.members.find((x) => x.id === pay.memberId);
      return {
        ...clonePayment(pay),
        memberPhotoUrl: pay.memberPhotoUrl ?? member?.photoUrl,
        memberName: pay.memberName || member?.name || 'Member',
      };
    });
    if (q) {
      items = items.filter(
        (p) =>
          (p.memberName || '').toLowerCase().includes(q) ||
          p.method.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q),
      );
    }
    return paginate(items, page, pageSize) as T;
  }
  if (m === 'GET' && p.startsWith('/payments/') && p.endsWith('/invoice')) {
    const id = p.split('/')[2];
    const payment = db.payments.find((x) => x.id === id);
    if (!payment) throw { status: 404, message: 'Payment not found' };
    const member = db.members.find((x) => x.id === payment.memberId);
    return {
      payment: clonePayment(payment),
      gym: { ...db.gym },
      member: {
        id: member?.id || payment.memberId,
        name: member?.name || payment.memberName,
        phone: member?.phone || '',
        planName: member?.planName || payment.planName || '',
      },
    } as T;
  }
  if (m === 'POST' && p.startsWith('/payments/') && p.endsWith('/whatsapp')) {
    const id = p.split('/')[2];
    const payment = db.payments.find((x) => x.id === id);
    if (!payment) throw { status: 404, message: 'Payment not found' };
    const msg = {
      id: nextId('msg'),
      memberId: payment.memberId,
      memberName: payment.memberName,
      phone: db.members.find((x) => x.id === payment.memberId)?.whatsappPhone || '',
      template: 'invoice',
      body: `Invoice ${payment.invoiceNumber}: paid Rs ${payment.paidPkr}. Due Rs ${payment.duePkr}.`,
      status: 'sent' as const,
      createdAt: new Date().toISOString(),
    };
    db.messages.unshift(msg);
    return cloneMessage(msg) as T;
  }
  if (m === 'GET' && p === '/dues') {
    const dues: DueItem[] = db.members
      .filter((x) => x.outstandingPkr > 0)
      .map((x) => ({
        memberId: x.id,
        memberName: x.name,
        phone: x.phone,
        outstandingPkr: x.outstandingPkr,
        planName: x.planName,
        endDate: x.endDate,
        daysOverdue: Math.max(0, -daysUntil(x.endDate)),
      }));
    return dues as T;
  }
  if (m === 'GET' && p === '/reports/fees') {
    const from = params?.from ? String(params.from) : undefined;
    const to = params?.to ? String(params.to) : undefined;
    const inRange = (iso: string) => {
      const day = iso.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    };

    const payments = db.payments.filter((pay) => inRange(pay.paidAt || todayIso()));

    const byMethodMap = new Map<string, number>();
    payments.forEach((pay) => {
      byMethodMap.set(pay.method, (byMethodMap.get(pay.method) || 0) + pay.paidPkr);
    });

    // Group by day label (dd MMM) inside the selected range.
    const byDayMap = new Map<string, number>();
    payments.forEach((pay) => {
      const day = (pay.paidAt || todayIso()).slice(0, 10);
      const label = day.slice(8, 10) + ' ' + MONTHS[Number(day.slice(5, 7)) - 1];
      byDayMap.set(label, (byDayMap.get(label) || 0) + pay.paidPkr);
    });

    const report: FeeReport = {
      totalCollectedPkr: payments.reduce((s, pay) => s + pay.paidPkr, 0),
      totalDuePkr: db.members.reduce((s, mem) => s + mem.outstandingPkr, 0),
      byMethod: Array.from(byMethodMap.entries()).map(([label, amountPkr]) => ({
        label,
        amountPkr,
      })),
      byDay: Array.from(byDayMap.entries()).map(([label, amountPkr]) => ({
        label,
        amountPkr,
      })),
      period:
        from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Till ${to}` : 'All time',
    };
    return report as T;
  }

  // Offers
  if (m === 'GET' && p === '/offers') {
    const onlyActive = params?.active === true || params?.active === 'true';
    const q = String(params?.q ?? '').toLowerCase();
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    let items = db.offers.map(cloneOffer);
    if (onlyActive) {
      items = items.filter(
        (o) => o.isActive && o.validTo >= todayIso() && o.validFrom <= todayIso(),
      );
    }
    if (q) {
      items = items.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q),
      );
    }
    return paginate(items, page, pageSize) as T;
  }
  if (m === 'GET' && p === '/offers/suggest') {
    const planId = String(params?.planId ?? '');
    return db.offers
      .filter(
        (o) =>
          o.isActive &&
          o.autoSuggest &&
          o.validTo >= todayIso() &&
          (!planId || o.planIds.includes(planId)),
      )
      .map(cloneOffer) as T;
  }
  if (m === 'POST' && p === '/offers') {
    const body = data as Partial<(typeof db.offers)[0]>;
    const offer = {
      id: nextId('off'),
      title: body.title || 'Offer',
      description: body.description || '',
      discountPercent: body.discountPercent,
      discountAmountPkr: body.discountAmountPkr,
      validFrom: body.validFrom || todayIso(),
      validTo: body.validTo || addDaysIso(todayIso(), 30),
      planIds: body.planIds || [],
      isActive: body.isActive ?? true,
      autoSuggest: body.autoSuggest ?? true,
    };
    db.offers.unshift(offer);
    return cloneOffer(offer) as T;
  }
  if ((m === 'PUT' || m === 'PATCH') && p.startsWith('/offers/')) {
    const id = p.split('/')[2];
    const idx = db.offers.findIndex((x) => x.id === id);
    if (idx < 0) throw { status: 404, message: 'Offer not found' };
    db.offers[idx] = { ...db.offers[idx], ...(data as object) };
    return cloneOffer(db.offers[idx]) as T;
  }
  if (m === 'DELETE' && p.startsWith('/offers/')) {
    const id = p.split('/')[2];
    db.offers = db.offers.filter((x) => x.id !== id);
    return { ok: true } as T;
  }

  // Diet
  if (m === 'GET' && p === '/diet/templates') return db.dietTemplates.map(cloneDietTemplate) as T;
  if (m === 'POST' && p === '/diet/templates') {
    const body = data as Partial<(typeof db.dietTemplates)[0]>;
    const tpl = {
      id: nextId('dt'),
      name: body.name || 'Template',
      description: body.description || '',
      meals: body.meals || [],
      createdBy: 'Staff',
      updatedAt: new Date().toISOString(),
    };
    db.dietTemplates.unshift(tpl);
    return cloneDietTemplate(tpl) as T;
  }
  if (m === 'DELETE' && /^\/diet\/templates\/[^/]+$/.test(p)) {
    const id = p.split('/')[3];
    const idx = db.dietTemplates.findIndex((x) => x.id === id);
    if (idx >= 0) db.dietTemplates.splice(idx, 1);
    return { success: true } as T;
  }
  if (m === 'GET' && p === '/diet/assignments') {
    const memberId = params?.memberId as string | undefined;
    let items = db.dietAssignments;
    if (memberId) items = items.filter((a) => a.memberId === memberId);
    return items.map(cloneDietAssignment) as T;
  }
  if (m === 'DELETE' && /^\/diet\/assignments\/[^/]+$/.test(p)) {
    const id = p.split('/')[3];
    const idx = db.dietAssignments.findIndex((x) => x.id === id);
    if (idx >= 0) db.dietAssignments.splice(idx, 1);
    return { success: true } as T;
  }
  if (m === 'POST' && p === '/diet/assignments') {
    const body = data as {
      memberId: string;
      templateId: string;
      whatsappReminders?: boolean;
    };
    const member = db.members.find((x) => x.id === body.memberId);
    const tpl = db.dietTemplates.find((x) => x.id === body.templateId);
    if (!member || !tpl) throw { status: 400, message: 'Invalid member or template' };
    const assignment = {
      id: nextId('da'),
      memberId: member.id,
      memberName: member.name,
      templateId: tpl.id,
      templateName: tpl.name,
      startDate: todayIso(),
      whatsappReminders: body.whatsappReminders ?? false,
      checkoffs: tpl.meals.map((meal) => ({
        id: nextId('dc'),
        date: todayIso(),
        mealId: meal.id,
        mealName: meal.name,
        completed: false,
      })),
    };
    db.dietAssignments.unshift(assignment);
    return cloneDietAssignment(assignment) as T;
  }
  if (m === 'POST' && /^\/diet\/checkoffs\/[^/]+\/toggle$/.test(p)) {
    const id = p.split('/')[3];
    for (const a of db.dietAssignments) {
      const c = a.checkoffs.find((x) => x.id === id);
      if (c) {
        c.completed = !c.completed;
        c.completedAt = c.completed ? new Date().toISOString() : undefined;
        return cloneDietAssignment(a) as T;
      }
    }
    throw { status: 404, message: 'Checkoff not found' };
  }

  // Workout
  if (m === 'GET' && p === '/workout/exercises') return db.exercises.map(cloneExercise) as T;
  if (m === 'POST' && p === '/workout/exercises') {
    const body = data as Partial<(typeof db.exercises)[0]>;
    const ex = {
      id: nextId('ex'),
      name: body.name || 'Exercise',
      muscleGroup: body.muscleGroup || 'General',
      equipment: body.equipment,
      instructions: body.instructions,
    };
    db.exercises.push(ex);
    return cloneExercise(ex) as T;
  }
  if (m === 'GET' && p === '/workout/plans') return db.workoutPlans.map(cloneWorkoutPlan) as T;
  if (m === 'POST' && p === '/workout/plans') {
    const body = data as Partial<(typeof db.workoutPlans)[0]>;
    const plan = {
      id: nextId('wp'),
      name: body.name || 'Plan',
      description: body.description || '',
      days: body.days || [],
      createdBy: 'Staff',
      updatedAt: new Date().toISOString(),
    };
    db.workoutPlans.unshift(plan);
    return cloneWorkoutPlan(plan) as T;
  }
  if (m === 'PUT' && /^\/workout\/plans\/[^/]+$/.test(p)) {
    const id = p.split('/')[3];
    const plan = db.workoutPlans.find((x) => x.id === id);
    if (!plan) throw { status: 404, message: 'Plan not found' };
    const body = data as any;
    Object.assign(plan, body, { updatedAt: new Date().toISOString() });
    return cloneWorkoutPlan(plan) as T;
  }
  if (m === 'POST' && p === '/workout/day-exercise') {
    const body = data as any;
    let plan = db.workoutPlans.find((x) => x.id === body.planId) || db.workoutPlans[0];
    if (!plan) {
      plan = {
        id: nextId('wp'),
        name: 'Weekly Workout Routine',
        description: 'Day-wise gym routine',
        days: [
          { day: 'mon', exercises: [] },
          { day: 'tue', exercises: [] },
          { day: 'wed', exercises: [] },
          { day: 'thu', exercises: [] },
          { day: 'fri', exercises: [] },
          { day: 'sat', exercises: [] },
          { day: 'sun', exercises: [] },
        ],
        createdBy: 'Staff',
        updatedAt: new Date().toISOString(),
      };
      db.workoutPlans.unshift(plan);
    }
    let dayObj = plan.days.find((d: any) => d.day === body.day);
    if (!dayObj) {
      dayObj = { day: body.day, exercises: [] };
      plan.days.push(dayObj);
    }
    if (body.dayTitle) dayObj.title = body.dayTitle;
    if (body.dayNotes) dayObj.notes = body.dayNotes;

    const exId = nextId('ex');
    dayObj.exercises.push({
      exerciseId: exId,
      exerciseName: body.exercise.exerciseName,
      sets: body.exercise.sets || 3,
      reps: body.exercise.reps || '10-12',
      restSec: body.exercise.restSec || 60,
      muscleGroup: body.exercise.muscleGroup || 'General',
      instructions: body.exercise.instructions,
      imageUrl: body.exercise.imageUrl,
      videoUrl: body.exercise.videoUrl,
    });
    plan.updatedAt = new Date().toISOString();
    return cloneWorkoutPlan(plan) as T;
  }
  if (m === 'DELETE' && /^\/workout\/plans\/[^/]+\/day\/[^/]+\/exercise\/\d+$/.test(p)) {
    const parts = p.split('/');
    const planId = parts[3];
    const day = parts[5];
    const exIdx = parseInt(parts[7], 10);
    const plan = db.workoutPlans.find((x) => x.id === planId);
    if (plan) {
      const dayObj = plan.days.find((d: any) => d.day === day);
      if (dayObj && dayObj.exercises[exIdx]) {
        dayObj.exercises.splice(exIdx, 1);
        plan.updatedAt = new Date().toISOString();
      }
      return cloneWorkoutPlan(plan) as T;
    }
    throw { status: 404, message: 'Plan not found' };
  }
  if (m === 'GET' && p === '/workout/assignments') {
    const memberId = params?.memberId as string | undefined;
    let items = db.workoutAssignments;
    if (memberId) items = items.filter((a) => a.memberId === memberId);
    return items.map(cloneWorkoutAssignment) as T;
  }
  if (m === 'POST' && p === '/workout/assignments') {
    const body = data as { memberId: string; planId: string };
    const member = db.members.find((x) => x.id === body.memberId);
    const plan = db.workoutPlans.find((x) => x.id === body.planId);
    if (!member || !plan) throw { status: 400, message: 'Invalid member or plan' };
    const assignment = {
      id: nextId('wa'),
      memberId: member.id,
      memberName: member.name,
      planId: plan.id,
      planName: plan.name,
      startDate: todayIso(),
      streakDays: 0,
      completions: [],
    };
    db.workoutAssignments.unshift(assignment);
    return cloneWorkoutAssignment(assignment) as T;
  }
  if (m === 'POST' && /^\/workout\/assignments\/[^/]+\/complete$/.test(p)) {
    const id = p.split('/')[3];
    const a = db.workoutAssignments.find((x) => x.id === id);
    if (!a) throw { status: 404, message: 'Assignment not found' };
    const body = data as { day: string; completedBy?: 'member' | 'trainer' };
    a.completions.unshift({
      id: nextId('wc'),
      date: todayIso(),
      day: body.day as 'mon',
      completed: true,
      completedBy: body.completedBy || 'member',
      completedAt: new Date().toISOString(),
    });
    a.streakDays += 1;
    return cloneWorkoutAssignment(a) as T;
  }

  // Staff
  if (m === 'GET' && p === '/staff') {
    const q = String(params?.q ?? '').toLowerCase();
    const status = params?.status as string | undefined;
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    let items = db.staff.map(cloneStaff);
    if (status === 'active') {
      items = items.filter((s) => s.isActive !== false);
    } else if (status === 'inactive') {
      items = items.filter((s) => s.isActive === false);
    }
    if (q) {
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.role.toLowerCase().includes(q) ||
          (s.designation && s.designation.toLowerCase().includes(q)),
      );
    }
    return paginate(items, page, pageSize) as T;
  }
  if (m === 'POST' && p === '/staff') {
    const body = data as Partial<(typeof db.staff)[0]>;
    const staff = {
      id: nextId('st'),
      name: body.name || 'Staff',
      phone: body.phone || '',
      role: body.role || 'trainer',
      designation: body.designation || (body.role ? body.role.charAt(0).toUpperCase() + body.role.slice(1) : 'Staff'),
      salaryPkr: body.salaryPkr || 0,
      salaryStatus: body.salaryStatus || 'unpaid',
      joinDate: body.joinDate || todayIso(),
      isActive: body.isActive !== undefined ? body.isActive : true,
      assignedMemberIds: body.assignedMemberIds || [],
      photoUrl: body.photoUrl,
    };
    db.staff.unshift(staff);
    return cloneStaff(staff) as T;
  }
  if ((m === 'PUT' || m === 'PATCH') && p.startsWith('/staff/') && !p.includes('attendance') && !p.includes('salary')) {
    const id = p.split('/')[2];
    const idx = db.staff.findIndex((x) => x.id === id);
    if (idx < 0) throw { status: 404, message: 'Staff not found' };
    db.staff[idx] = { ...db.staff[idx], ...(data as object) };
    return cloneStaff(db.staff[idx]) as T;
  }
  if (m === 'DELETE' && p.startsWith('/staff/')) {
    const id = p.split('/')[2];
    db.staff = db.staff.filter((x) => x.id !== id);
    return { ok: true } as T;
  }
  if (m === 'POST' && /^\/staff\/[^/]+\/salary$/.test(p)) {
    const id = p.split('/')[2];
    const staff = db.staff.find((x) => x.id === id);
    if (!staff) throw { status: 404, message: 'Staff not found' };
    staff.salaryStatus = (data as { status: 'paid' | 'unpaid' }).status;
    return cloneStaff(staff) as T;
  }
  if (m === 'GET' && p === '/staff/attendance') {
    const date = String(params?.date ?? todayIso());
    return db.staffAttendance.filter((s) => s.date === date).map(cloneStaffAttendance) as T;
  }
  if (m === 'POST' && p === '/staff/attendance') {
    const body = data as Partial<(typeof db.staffAttendance)[0]>;
    const staff = db.staff.find((x) => x.id === body.staffId);
    const record = {
      id: nextId('sa'),
      staffId: body.staffId || '',
      staffName: staff?.name || body.staffName || '',
      date: body.date || todayIso(),
      checkInAt: body.checkInAt || new Date().toISOString(),
      checkOutAt: body.checkOutAt,
      status: body.status || 'present',
    };
    db.staffAttendance.unshift(record);
    return cloneStaffAttendance(record) as T;
  }

  // WhatsApp
  if (m === 'GET' && p === '/whatsapp/connection') {
    return {
      connected: db.whatsappSettings.providerConnected,
      status: db.whatsappSettings.providerConnected ? 'connected' : 'disconnected',
    } as T;
  }
  if (m === 'POST' && p === '/whatsapp/connect') {
    db.whatsappSettings.providerConnected = true;
    return {
      connected: true,
      status: 'connected',
      qrDataUrl: undefined,
    } as T;
  }
  if (m === 'GET' && p === '/whatsapp/settings') return { ...db.whatsappSettings } as T;
  if (m === 'PUT' && p === '/whatsapp/settings') {
    db.whatsappSettings = { ...db.whatsappSettings, ...(data as object) };
    return { ...db.whatsappSettings } as T;
  }
  if (m === 'GET' && p === '/whatsapp/templates') {
    return db.whatsappTemplates.map((t) => ({ ...t })) as T;
  }
  if (m === 'PUT' && p === '/whatsapp/templates') {
    const body = data as {
      key?: string;
      name?: string;
      body?: string;
      language?: string;
    };
    if (!body?.key || !body?.name || !body?.body) {
      throw { status: 400, message: 'key, name and body are required' };
    }
    const idx = db.whatsappTemplates.findIndex((t) => t.key === body.key);
    if (idx >= 0) {
      db.whatsappTemplates[idx] = {
        ...db.whatsappTemplates[idx],
        name: body.name,
        body: body.body,
        language: body.language || db.whatsappTemplates[idx].language,
        updatedAt: new Date().toISOString(),
      };
      return { ...db.whatsappTemplates[idx] } as T;
    }
    const tpl: (typeof db.whatsappTemplates)[0] = {
      id: nextId('wt'),
      key: body.key,
      name: body.name,
      body: body.body,
      language: body.language || 'en',
      isActive: true,
    };
    db.whatsappTemplates.push(tpl);
    return { ...tpl } as T;
  }
  if (m === 'GET' && p === '/whatsapp/messages') {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    return paginate(db.messages.map(cloneMessage), page, pageSize) as T;
  }

  // Notifications
  if (m === 'GET' && p === '/notifications') {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 10);
    return paginate(db.notifications.map(cloneNotification), page, pageSize) as T;
  }
  if (m === 'POST' && p === '/notifications/read-all') {
    db.notifications.forEach((n) => {
      n.read = true;
    });
    return { ok: true } as T;
  }
  if (m === 'POST' && /^\/notifications\/[^/]+\/read$/.test(p)) {
    const id = p.split('/')[2];
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    return cloneNotification(n!) as T;
  }

  throw { status: 404, message: `Mock route not found: ${m} ${p}` };
}
