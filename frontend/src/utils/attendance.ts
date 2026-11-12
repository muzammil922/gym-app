import type { BadgeVariant } from '@/src/components/ui/Badge';

export interface AttendanceStatusMeta {
  label: string;
  variant: BadgeVariant;
}

/**
 * Normalizes attendance status for UI display:
 * Supports 'Check In', 'Check Out', 'Leave', 'Absent'.
 */
export function getAttendanceStatusMeta(
  status?: string | null,
  direction?: string | null,
): AttendanceStatusMeta {
  const s = (status || '').toLowerCase().trim();
  const d = (direction || '').toLowerCase().trim();

  if (s === 'check_out' || s === 'checkout' || s === 'check out' || s === 'out' || d === 'out') {
    return { label: 'Check Out', variant: 'check_out' };
  }

  if (s === 'leave' || s === 'on_leave' || s === 'on leave') {
    return { label: 'Leave', variant: 'leave' };
  }

  if (s === 'absent') {
    return { label: 'Absent', variant: 'absent' };
  }

  // Check In and standard check-in aliases
  if (
    s === 'check_in' ||
    s === 'checkin' ||
    s === 'check in' ||
    s === 'in' ||
    d === 'in' ||
    s === 'valid' ||
    s === 'present' ||
    s === 'unpaid' ||
    s === 'expired' ||
    s === 'frozen' ||
    !s
  ) {
    return { label: 'Check In', variant: 'check_in' };
  }

  // Format any custom string as capitalized words
  return {
    label: s
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    variant: 'neutral',
  };
}

