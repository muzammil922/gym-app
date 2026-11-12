import { Injectable } from '@nestjs/common';
import {
  AttendanceDirection,
  InvoiceStatus,
  MemberStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async adminStats(user: AuthUser) {
    const gymId = user.gymId;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    const in7 = new Date();
    in7.setUTCDate(in7.getUTCDate() + 7);

    const [
      activeMembers,
      todayCheckIns,
      todayCollection,
      pendingDues,
      pendingEnrollments,
      recentLogs,
      expiringSubs,
    ] = await Promise.all([
      this.prisma.member.count({
        where: { gymId, deletedAt: null, status: MemberStatus.ACTIVE },
      }),
      this.prisma.attendanceLog.count({
        where: {
          gymId,
          punchedAt: { gte: startOfDay, lt: endOfDay },
          isMapped: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          gymId,
          paidAt: { gte: startOfDay, lt: endOfDay },
          status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          gymId,
          dueAmount: { gt: 0 },
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
          },
        },
        _sum: { dueAmount: true },
      }),
      this.prisma.member.count({
        where: { gymId, deletedAt: null, status: MemberStatus.PENDING },
      }),
      this.prisma.attendanceLog.findMany({
        where: {
          gymId,
          punchedAt: { gte: startOfDay, lt: endOfDay },
          isMapped: true,
        },
        orderBy: { punchedAt: 'desc' },
        take: 8,
        include: {
          member: { select: { id: true, fullName: true, photoUrl: true } },
          device: { select: { id: true, name: true } },
        },
      }),
      this.prisma.memberSubscription.findMany({
        where: {
          gymId,
          status: SubscriptionStatus.ACTIVE,
          endDate: { lte: in7, gte: new Date() },
        },
        orderBy: { endDate: 'asc' },
        take: 20,
        include: {
          member: { select: { id: true, fullName: true, photoUrl: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);

    const recentCheckIns = recentLogs.map((log) => ({
      id: log.id,
      memberId: log.memberId || '',
      memberName: log.member?.fullName || 'Unknown',
      memberPhotoUrl: log.member?.photoUrl || undefined,
      checkedInAt: log.punchedAt.toISOString(),
      source: log.isManual ? ('manual' as const) : ('device' as const),
      deviceId: log.deviceId || undefined,
      deviceName: log.device?.name,
      direction:
        log.direction === AttendanceDirection.IN
          ? ('in' as const)
          : log.direction === AttendanceDirection.OUT
            ? ('out' as const)
            : undefined,
      status: 'check_in' as const,
      reason: log.alertReason || undefined,
    }));

    const expiringMembers = expiringSubs.map((sub) => ({
      id: sub.member.id,
      name: sub.member.fullName,
      endDate: sub.endDate.toISOString().slice(0, 10),
      planName: sub.plan.name,
      photoUrl: sub.member.photoUrl || undefined,
    }));

    return {
      todayCheckIns,
      activeMembers,
      expiringIn7Days: expiringSubs.length,
      todayCollectionPkr: Number(todayCollection._sum.amount || 0),
      pendingDuesPkr: Number(pendingDues._sum.dueAmount || 0),
      pendingEnrollments,
      recentCheckIns,
      expiringMembers,
    };
  }

  async kpis(user: AuthUser) {
    const gymId = user.gymId;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(
      Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1),
    );
    const in7 = new Date();
    in7.setUTCDate(in7.getUTCDate() + 7);

    const [
      activeMembers,
      frozenMembers,
      expiredMembers,
      todayCheckIns,
      monthRevenue,
      openDues,
      expiringSoon,
      newMembersMonth,
    ] = await Promise.all([
      this.prisma.member.count({
        where: { gymId, deletedAt: null, status: MemberStatus.ACTIVE },
      }),
      this.prisma.member.count({
        where: { gymId, deletedAt: null, status: MemberStatus.FROZEN },
      }),
      this.prisma.member.count({
        where: { gymId, deletedAt: null, status: MemberStatus.EXPIRED },
      }),
      this.prisma.attendanceLog.count({
        where: { gymId, punchedAt: { gte: startOfDay }, isMapped: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          gymId,
          dueAmount: { gt: 0 },
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
          },
        },
        _sum: { dueAmount: true },
        _count: true,
      }),
      this.prisma.memberSubscription.count({
        where: {
          gymId,
          status: SubscriptionStatus.ACTIVE,
          endDate: { lte: in7, gte: new Date() },
        },
      }),
      this.prisma.member.count({
        where: { gymId, deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      members: {
        active: activeMembers,
        frozen: frozenMembers,
        expired: expiredMembers,
        newThisMonth: newMembersMonth,
      },
      attendance: { todayCheckIns },
      finance: {
        monthRevenue: monthRevenue._sum.amount || 0,
        openDues: openDues._sum.dueAmount || 0,
        openDuesCount: openDues._count,
      },
      subscriptions: { expiringIn7Days: expiringSoon },
    };
  }
}
