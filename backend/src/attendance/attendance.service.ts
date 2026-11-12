import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceDirection,
  AttendanceMethod,
  AuditAction,
  DeviceVendor,
  MemberStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { ZkTecoAdmsAdapter } from './zkteco/zkteco-adms.adapter';
import { HikvisionIsapiAdapter } from './hikvision/hikvision-isapi.adapter';
import { PulledAttendanceLog } from './adapters/attendance-device.adapter';
import {
  CreateDeviceDto,
  ManualCheckInDto,
  AttendanceQueryDto,
  UpdateDeviceDto,
  UpdateAttendanceLogDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private zkteco: ZkTecoAdmsAdapter,
    private hikvision: HikvisionIsapiAdapter,
  ) {}

  // ── Devices ──────────────────────────────────────────────

  async listDevices(user: AuthUser) {
    return this.prisma.attendanceDevice.findMany({
      where: { gymId: user.gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDevice(user: AuthUser, dto: CreateDeviceDto) {
    return this.prisma.attendanceDevice.create({
      data: {
        gymId: user.gymId,
        name: dto.name,
        vendor: (dto.vendor as DeviceVendor) || DeviceVendor.ZKTECO,
        serialNumber: dto.serialNumber,
        location: dto.location,
        ipAddress: dto.ipAddress,
        config: dto.config as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateDevice(user: AuthUser, id: string, dto: UpdateDeviceDto) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id, gymId: user.gymId },
    });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.attendanceDevice.update({
      where: { id },
      data: {
        name: dto.name,
        serialNumber: dto.serialNumber,
        location: dto.location,
        ipAddress: dto.ipAddress,
        isActive: dto.isActive,
        vendor: dto.vendor as DeviceVendor | undefined,
        config: dto.config as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async pingDevice(user: AuthUser, id: string) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id, gymId: user.gymId },
    });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.attendanceDevice.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  async deleteDevice(user: AuthUser, id: string) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id, gymId: user.gymId },
    });
    if (!device) throw new NotFoundException('Device not found');
    await this.prisma.attendanceDevice.delete({ where: { id } });
    return { success: true };
  }

  async findDeviceBySn(serialNumber: string) {
    return this.prisma.attendanceDevice.findFirst({
      where: { serialNumber, isActive: true },
    });
  }

  async touchDevice(serialNumber: string) {
    await this.prisma.attendanceDevice.updateMany({
      where: { serialNumber },
      data: { lastSeenAt: new Date() },
    });
  }

  // ── ADMS ingest ──────────────────────────────────────────

  async ingestAttLogs(serialNumber: string, body: string) {
    const device = await this.findDeviceBySn(serialNumber);
    if (!device) {
      this.logger.warn(`Unknown device SN=${serialNumber}`);
      return { accepted: 0, unknownDevice: true };
    }
    await this.touchDevice(serialNumber);

    const adapter =
      device.vendor === DeviceVendor.HIKVISION ? this.hikvision : this.zkteco;
    const logs = await adapter.handlePush(serialNumber, body);
    let accepted = 0;
    for (const log of logs) {
      const created = await this.persistLog(device.gymId, device.id, log);
      if (created) accepted++;
    }
    return { accepted, total: logs.length };
  }

  async getDeviceCommands(serialNumber: string): Promise<string> {
    await this.touchDevice(serialNumber);
    const cmds = await this.zkteco.getPendingCommands(serialNumber);
    if (!cmds.length) return 'OK';
    return cmds.map((c) => c.command).join('\n');
  }

  private async persistLog(
    gymId: string,
    deviceId: string,
    log: PulledAttendanceLog,
  ) {
    const existing = await this.prisma.attendanceLog.findFirst({
      where: { gymId, idempotencyKey: log.idempotencyKey },
    });
    if (existing) return null;

    const map = await this.prisma.deviceUserMap.findFirst({
      where: { gymId, deviceId, devicePin: log.pin },
      include: { member: true },
    });
    let memberId: string | undefined;
    let isMapped = false;
    let alertReason: string | undefined;

    if (map?.member) {
      memberId = map.member.id;
      isMapped = true;
      if (map.member.status !== MemberStatus.ACTIVE) {
        alertReason = `Member status is ${map.member.status}`;
      }
    } else {
      const byPin = await this.prisma.member.findFirst({
        where: { gymId, devicePin: log.pin, deletedAt: null },
      });
      if (byPin) {
        memberId = byPin.id;
        isMapped = true;
        if (byPin.status !== MemberStatus.ACTIVE) {
          alertReason = `Member status is ${byPin.status}`;
        }
      }
    }

    return this.prisma.attendanceLog.create({
      data: {
        gymId,
        deviceId,
        memberId,
        devicePin: log.pin,
        punchedAt: log.punchedAt,
        method: log.method as AttendanceMethod,
        direction: log.direction as AttendanceDirection,
        rawPayload: log.raw,
        isMapped,
        idempotencyKey: log.idempotencyKey,
        alertReason,
      },
    });
  }

  // ── Queries ──────────────────────────────────────────────

  async live(user: AuthUser, limit = 50) {
    const where: Prisma.AttendanceLogWhereInput = {
      gymId: user.gymId,
      punchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    this.applyMemberScope(user, where);
    return this.prisma.attendanceLog.findMany({
      where,
      orderBy: { punchedAt: 'desc' },
      take: limit,
      include: {
        member: { select: { id: true, fullName: true, memberCode: true, status: true } },
        device: { select: { id: true, name: true, serialNumber: true } },
      },
    });
  }

  async history(user: AuthUser, query: AttendanceQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Prisma.AttendanceLogWhereInput = { gymId: user.gymId };
    this.applyMemberScope(user, where);
    if (query.memberId) where.memberId = query.memberId;
    if (query.deviceId) where.deviceId = query.deviceId;
    if (query.mapped === 'false') where.isMapped = false;
    if (query.mapped === 'true') where.isMapped = true;
    if (query.from || query.to) {
      where.punchedAt = {};
      if (query.from) where.punchedAt.gte = new Date(query.from);
      if (query.to) where.punchedAt.lte = new Date(query.to);
    }
    const [data, total] = await Promise.all([
      this.prisma.attendanceLog.findMany({
        where,
        skip,
        take,
        orderBy: { punchedAt: 'desc' },
        include: {
          member: { select: { id: true, fullName: true, memberCode: true } },
          device: { select: { id: true, name: true } },
        },
      }),
      this.prisma.attendanceLog.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async calendar(user: AuthUser, memberId: string, year: number, month: number) {
    if (user.role === Role.MEMBER && user.memberId !== memberId) {
      throw new BadRequestException('Forbidden');
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        gymId: user.gymId,
        memberId,
        punchedAt: { gte: start, lt: end },
        isMapped: true,
      },
      orderBy: { punchedAt: 'asc' },
    });
    const byDay: Record<string, typeof logs> = {};
    for (const log of logs) {
      const day = log.punchedAt.toISOString().slice(0, 10);
      (byDay[day] ||= []).push(log);
    }
    return { year, month, days: byDay };
  }

  async unmapped(user: AuthUser, query: AttendanceQueryDto) {
    return this.history(user, { ...query, mapped: 'false' });
  }

  async manualCheckIn(user: AuthUser, dto: ManualCheckInDto) {
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, gymId: user.gymId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Member not found');

    const punchedAt = dto.punchedAt ? new Date(dto.punchedAt) : new Date();
    const idempotencyKey =
      dto.idempotencyKey ||
      `manual-${dto.memberId}-${punchedAt.toISOString()}-${user.id}`;

    const existing = await this.prisma.attendanceLog.findFirst({
      where: { gymId: user.gymId, idempotencyKey },
    });
    if (existing) return { ...existing, idempotent: true };

    const log = await this.prisma.attendanceLog.create({
      data: {
        gymId: user.gymId,
        memberId: member.id,
        devicePin: member.devicePin,
        punchedAt,
        method: AttendanceMethod.MANUAL,
        direction: (dto.direction as AttendanceDirection) || AttendanceDirection.IN,
        isMapped: true,
        isManual: true,
        idempotencyKey,
        createdById: user.id,
        alertReason:
          dto.notes ??
          (member.status !== MemberStatus.ACTIVE
            ? `Member status is ${member.status}`
            : undefined),
      },
    });

    await this.audit.log({
      gymId: user.gymId,
      userId: user.id,
      action: AuditAction.CHECK_IN,
      entityType: 'attendance_log',
      entityId: log.id,
      after: log,
    });

    return log;
  }

  async updateLog(user: AuthUser, id: string, dto: UpdateAttendanceLogDto) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { id, gymId: user.gymId },
      include: {
        member: { select: { id: true, fullName: true, memberCode: true } },
        device: { select: { id: true, name: true } },
      },
    });
    if (!log) throw new NotFoundException('Attendance log not found');

    return this.prisma.attendanceLog.update({
      where: { id },
      data: {
        punchedAt: dto.punchedAt ? new Date(dto.punchedAt) : undefined,
        direction: dto.direction as AttendanceDirection | undefined,
        alertReason: dto.notes !== undefined ? dto.notes : undefined,
      },
      include: {
        member: { select: { id: true, fullName: true, memberCode: true } },
        device: { select: { id: true, name: true } },
      },
    });
  }

  async deleteLog(user: AuthUser, id: string) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { id, gymId: user.gymId },
    });
    if (!log) throw new NotFoundException('Attendance log not found');
    if (!log.isManual) {
      throw new BadRequestException('Only manual attendance logs can be deleted');
    }
    await this.prisma.attendanceLog.delete({ where: { id } });
    return { success: true };
  }

  async syncMember(user: AuthUser, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId: user.gymId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (!member.devicePin) throw new BadRequestException('Member has no device PIN');

    const devices = await this.prisma.attendanceDevice.findMany({
      where: { gymId: user.gymId, isActive: true, vendor: DeviceVendor.ZKTECO },
    });

    for (const device of devices) {
      await this.zkteco.pushUser(device.serialNumber, {
        pin: member.devicePin,
        name: member.fullName,
      });
      await this.prisma.deviceUserMap.upsert({
        where: {
          deviceId_memberId: { deviceId: device.id, memberId: member.id },
        },
        create: {
          gymId: user.gymId,
          deviceId: device.id,
          memberId: member.id,
          devicePin: member.devicePin,
          syncStatus: 'QUEUED',
        },
        update: {
          devicePin: member.devicePin,
          syncStatus: 'QUEUED',
          syncedAt: new Date(),
        },
      });
    }
    return { queued: devices.length };
  }

  async syncAll(user: AuthUser) {
    const members = await this.prisma.member.findMany({
      where: {
        gymId: user.gymId,
        deletedAt: null,
        status: MemberStatus.ACTIVE,
        devicePin: { not: null },
      },
    });
    let queued = 0;
    for (const m of members) {
      const r = await this.syncMember(user, m.id);
      queued += r.queued;
    }
    return { members: members.length, queued };
  }

  private applyMemberScope(user: AuthUser, where: Prisma.AttendanceLogWhereInput) {
    if (user.role === Role.MEMBER) {
      where.memberId = user.memberId;
    } else if (user.role === Role.TRAINER) {
      where.member = { trainerStaffId: user.staffId || '__none__' };
    }
  }
}
