export interface DeviceUserPayload {
  pin: string;
  name: string;
  card?: string;
  password?: string;
  privilege?: number;
}

export interface PulledAttendanceLog {
  pin: string;
  punchedAt: Date;
  method: 'FACE' | 'FINGER' | 'CARD' | 'PASSWORD' | 'UNKNOWN';
  direction: 'IN' | 'OUT' | 'UNKNOWN';
  raw: string;
  idempotencyKey: string;
}

export interface DeviceCommand {
  id: string;
  command: string;
}

/**
 * Vendor-agnostic attendance device adapter.
 * Implementations: ZkTecoAdmsAdapter, HikvisionIsapiAdapter
 */
export interface AttendanceDeviceAdapter {
  pushUser(serialNumber: string, user: DeviceUserPayload): Promise<void>;
  deleteUser(serialNumber: string, pin: string): Promise<void>;
  pullLogs(serialNumber: string): Promise<PulledAttendanceLog[]>;
  handlePush(
    serialNumber: string,
    payload: string | Record<string, unknown>,
  ): Promise<PulledAttendanceLog[]>;
  enqueueCommand?(serialNumber: string, command: DeviceCommand): Promise<void>;
  getPendingCommands?(serialNumber: string): Promise<DeviceCommand[]>;
}
