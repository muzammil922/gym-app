import { Injectable, Logger } from '@nestjs/common';
import {
  AttendanceDeviceAdapter,
  DeviceUserPayload,
  PulledAttendanceLog,
} from '../adapters/attendance-device.adapter';

/**
 * Hikvision ISAPI adapter — STUB.
 * Wire ISAPI endpoints (/ISAPI/AccessControl/UserInfo, event notification)
 * when device credentials and network path are available.
 */
@Injectable()
export class HikvisionIsapiAdapter implements AttendanceDeviceAdapter {
  private readonly logger = new Logger(HikvisionIsapiAdapter.name);

  async pushUser(serialNumber: string, user: DeviceUserPayload): Promise<void> {
    this.logger.warn(
      `[STUB] Hikvision pushUser SN=${serialNumber} PIN=${user.pin} — not implemented`,
    );
  }

  async deleteUser(serialNumber: string, pin: string): Promise<void> {
    this.logger.warn(
      `[STUB] Hikvision deleteUser SN=${serialNumber} PIN=${pin} — not implemented`,
    );
  }

  async pullLogs(serialNumber: string): Promise<PulledAttendanceLog[]> {
    this.logger.warn(`[STUB] Hikvision pullLogs SN=${serialNumber}`);
    return [];
  }

  async handlePush(
    serialNumber: string,
    _payload: string | Record<string, unknown>,
  ): Promise<PulledAttendanceLog[]> {
    this.logger.warn(`[STUB] Hikvision handlePush SN=${serialNumber}`);
    return [];
  }
}
