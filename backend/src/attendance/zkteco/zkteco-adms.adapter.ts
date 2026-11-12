import { Injectable, Logger } from '@nestjs/common';
import {
  AttendanceDeviceAdapter,
  DeviceCommand,
  DeviceUserPayload,
  PulledAttendanceLog,
} from '../adapters/attendance-device.adapter';
import { parseAttLogBody } from './attlog.parser';

/**
 * In-memory command queue per SN for ZKTeco ADMS getrequest/devicecmd flow.
 * Devices poll GET /iclock/getrequest?SN=... and receive queued commands.
 */
@Injectable()
export class ZkTecoAdmsAdapter implements AttendanceDeviceAdapter {
  private readonly logger = new Logger(ZkTecoAdmsAdapter.name);
  private readonly commands = new Map<string, DeviceCommand[]>();

  async pushUser(serialNumber: string, user: DeviceUserPayload): Promise<void> {
    const cmdId = `C${Date.now()}`;
    // DATA USER PIN=... Name=... Privilege=0 Password=... Card=...
    const parts = [
      `DATA USER PIN=${user.pin}`,
      `Name=${user.name.replace(/\s+/g, '_')}`,
      `Privilege=${user.privilege ?? 0}`,
    ];
    if (user.password) parts.push(`Password=${user.password}`);
    if (user.card) parts.push(`Card=${user.card}`);
    await this.enqueueCommand(serialNumber, {
      id: cmdId,
      command: `C:${cmdId}:${parts.join('\t')}`,
    });
    this.logger.log(`Queued USER push PIN=${user.pin} SN=${serialNumber}`);
  }

  async deleteUser(serialNumber: string, pin: string): Promise<void> {
    const cmdId = `C${Date.now()}`;
    await this.enqueueCommand(serialNumber, {
      id: cmdId,
      command: `C:${cmdId}:DATA DEL_USER PIN=${pin}`,
    });
  }

  async pullLogs(_serialNumber: string): Promise<PulledAttendanceLog[]> {
    // ADMS is push-based; pull is a no-op unless firmware supports query
    return [];
  }

  async handlePush(
    serialNumber: string,
    payload: string | Record<string, unknown>,
  ): Promise<PulledAttendanceLog[]> {
    const body = typeof payload === 'string' ? payload : String(payload.body || '');
    return parseAttLogBody(body, serialNumber);
  }

  async enqueueCommand(serialNumber: string, command: DeviceCommand): Promise<void> {
    const list = this.commands.get(serialNumber) || [];
    list.push(command);
    this.commands.set(serialNumber, list);
  }

  async getPendingCommands(serialNumber: string): Promise<DeviceCommand[]> {
    const list = this.commands.get(serialNumber) || [];
    this.commands.set(serialNumber, []);
    return list;
  }
}
