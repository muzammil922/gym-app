import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { differenceInYears, parseISO, isValid, isSameMonth } from 'date-fns';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { ErrorView, SkeletonProfile } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { attendanceApi, dietApi, membersApi, paymentsApi, workoutApi } from '@/src/api/endpoints';
import { useToastStore } from '@/src/store/toast-store';
import {
  AttendanceEditModal,
  type AttendanceFormValues,
} from '@/src/components/ui/AttendanceEditModal';
import { formatPkr } from '@/src/utils/currency';
import {
  formatDate,
  formatDateTime,
  formatTime,
  daysUntil,
  currentKarachiYear,
  getKarachiYearMonth,
  formatMonthYearLabel,
} from '@/src/utils/date';
import { getAttendanceStatusMeta } from '@/src/utils/attendance';
import { useAuthStore } from '@/src/store/auth-store';
import { can } from '@/src/utils/permissions';
import type { AttendanceRecord, Payment, PaymentMethod } from '@/src/api/types';

type Section = 'home' | 'attendance' | 'payments' | 'diet' | 'workout';

function paymentSourceLabel(method?: PaymentMethod | null): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Account';
    case 'easypaisa':
      return 'EasyPaisa';
    case 'jazzcash':
      return 'JazzCash';
    default:
      return '—';
  }
}

function parseTab(tab?: string | string[]): Section {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (value === 'attendance' || value === 'payments' || value === 'diet' || value === 'workout') {
    return value;
  }
  return 'home';
}

function ageFromDob(dob: string): string {
  const d = parseISO(dob);
  if (!isValid(d)) return '—';
  return String(differenceInYears(new Date(), d));
}

function formatPlanShort(planName?: string): string {
  if (!planName) return 'Monthly';
  if (/monthly/i.test(planName)) return 'Monthly';
  if (/quarterly/i.test(planName)) return 'Quarterly';
  if (/annual|yearly/i.test(planName)) return 'Annual';
  return planName;
}

function formatNumberCompact(amount: number): string {
  if (!amount || amount === 0) return '0';
  if (amount >= 10000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  return amount.toLocaleString('en-US');
}

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const iconColor = isDark ? '#FFFFFF' : '#0F1A19';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !trailing}
      style={({ pressed }) => [
        styles.rowCapsule,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)',
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.85)',
          opacity: pressed && onPress ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)',
            borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        ) : null
      )}
    </Pressable>
  );
}

/** Compact iOS-style labeled stat: value on top, caption below. */
function ProfileStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.profileStat,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(245,247,246,0.92)',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.95)',
        },
      ]}
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
    >
      <View style={styles.profileStatValueRow}>
        <Text
          style={[styles.profileStatValue, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              styles.profileStatUnit,
              { color: isDark ? colors.textSecondary : '#4B5563' },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.profileStatLabel, { color: isDark ? colors.primary : '#0F766E' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function MemberDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const role = useAuthStore((s) => s.user?.role);
  const qc = useQueryClient();
  // If opened from Fees/Attendance (tab param), back should leave profile entirely
  const [entrySection] = useState<Section>(() => parseTab(tab));
  const [section, setSection] = useState<Section>(() => parseTab(tab));

  useEffect(() => {
    setSection(parseTab(tab));
  }, [tab]);

  const handleBack = () => {
    if (entrySection !== 'home') {
      router.back();
      return;
    }
    if (section !== 'home') {
      setSection('home');
      return;
    }
    router.back();
  };

  const memberQ = useQuery({ queryKey: ['member', id], queryFn: () => membersApi.get(id!), enabled: !!id });
  const attQ = useQuery({
    queryKey: ['member', id, 'attendance'],
    queryFn: () => membersApi.attendance(id!),
    enabled: !!id && section === 'attendance',
  });
  const payQ = useQuery({
    queryKey: ['member', id, 'payments'],
    queryFn: () => membersApi.payments(id!),
    enabled: !!id && section === 'payments',
  });
  const dietQ = useQuery({
    queryKey: ['diet', id],
    queryFn: () => dietApi.assignments(id),
    enabled: !!id && section === 'diet',
  });
  const workoutQ = useQuery({
    queryKey: ['workout', id],
    queryFn: () => workoutApi.assignments(id),
    enabled: !!id && section === 'workout',
  });

  const resync = useMutation({
    mutationFn: () => membersApi.resync(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  });
  const freeze = useMutation({
    mutationFn: () => membersApi.freeze({ memberId: id!, days: 7, reason: 'Requested freeze' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] });
      Alert.alert('Frozen', 'Membership frozen for 7 days (end date extended).');
    },
  });
  const unfreeze = useMutation({
    mutationFn: () => membersApi.unfreeze(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] });
      Alert.alert('Unfrozen', 'Membership is active again.');
    },
  });
  const remove = useMutation({
    mutationFn: () => membersApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      router.back();
    },
  });
  const toggleReminder = useMutation({
    mutationFn: (enabled: boolean) => membersApi.setReminders(id!, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', id] }),
  });

  const showToast = useToastStore((s) => s.show);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);

  const saveAttendanceMutation = useMutation({
    mutationFn: async ({
      values,
      recordId,
    }: {
      values: AttendanceFormValues;
      recordId?: string;
    }) => {
      if (recordId) {
        return attendanceApi.update(recordId, {
          status: values.status,
          direction: values.direction,
          checkedInAt: values.checkedInAt,
          reason: values.reason,
        });
      } else {
        return attendanceApi.manual({
          memberId: id!,
          status: values.status,
          direction: values.direction,
          checkedInAt: values.checkedInAt,
          reason: values.reason,
        });
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['member', id, 'attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setShowAttendanceModal(false);
      setEditingAttendance(null);
      showToast({
        title: vars.recordId ? 'Attendance updated' : 'Attendance marked',
        message: 'Saved successfully',
      });
    },
    onError: (e: Error) => {
      Alert.alert('Error', e.message || 'Failed to save attendance');
    },
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: (recordId: string) => attendanceApi.remove(recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id, 'attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setShowAttendanceModal(false);
      setEditingAttendance(null);
      showToast({
        title: 'Attendance deleted',
        message: 'Record removed successfully',
      });
    },
    onError: (e: Error) => {
      Alert.alert('Error', e.message || 'Failed to delete attendance record');
    },
  });

  const handleOpenAttendanceEditor = () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRecord = (attQ.data || []).find((a) => a.checkedInAt.startsWith(today));
    setEditingAttendance(todayRecord || null);
    setShowAttendanceModal(true);
  };

  const daysLeft = useMemo(() => {
    if (!memberQ.data?.endDate) return '—';
    try {
      const n = daysUntil(memberQ.data.endDate);
      if (n < 0) return 'Ended';
      return String(n);
    } catch {
      return '—';
    }
  }, [memberQ.data?.endDate]);

  const attendanceSummary = useMemo(() => {
    const items = attQ.data || [];
    const now = new Date();
    const thisMonth = items.filter((a) => {
      const d = parseISO(a.checkedInAt);
      return isValid(d) && isSameMonth(d, now);
    }).length;
    const valid = items.filter((a) => {
      const meta = getAttendanceStatusMeta(a.status, a.direction);
      return meta.label === 'Check In' || a.status === 'valid';
    }).length;
    return {
      total: items.length,
      thisMonth,
      valid,
    };
  }, [attQ.data]);

  const monthlyAttendanceGroups = useMemo(() => {
    type MonthGroup = {
      key: string;
      year: number;
      month: number;
      label: string;
      records: AttendanceRecord[];
    };
    const map = new Map<string, MonthGroup>();
    const items = attQ.data || [];
    for (const a of items) {
      const ym = getKarachiYearMonth(a.checkedInAt) || {
        year: currentKarachiYear(),
        month: 1,
      };
      const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          year: ym.year,
          month: ym.month,
          label: formatMonthYearLabel(ym.year, ym.month),
          records: [],
        };
        map.set(key, group);
      }
      group.records.push(a);
    }
    for (const group of map.values()) {
      group.records.sort((a, b) => {
        const ta = parseISO(a.checkedInAt).getTime();
        const tb = parseISO(b.checkedInAt).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [attQ.data]);

  const paymentSummary = useMemo(() => {
    const items = payQ.data || [];
    const paidPkr = items.reduce((acc, p) => acc + (p.paidPkr || 0), 0);
    const bills = items.length;
    const duesPkr = memberQ.data?.outstandingPkr ?? 0;
    return {
      paidPkr,
      bills,
      duesPkr,
    };
  }, [payQ.data, memberQ.data?.outstandingPkr]);

  /** Display-only: current Karachi calendar year. Older years stay in storage/API. */
  const paymentYear = currentKarachiYear();

  const paymentsThisYear = useMemo(() => {
    const year = currentKarachiYear();
    const items = payQ.data || [];
    return items
      .filter((p) => {
        const ym = getKarachiYearMonth(p.paidAt);
        return ym?.year === year;
      })
      .slice()
      .sort((a, b) => {
        const ta = parseISO(a.paidAt).getTime();
        const tb = parseISO(b.paidAt).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
  }, [payQ.data]);

  const monthlyPaymentSummaries = useMemo(() => {
    type MonthBucket = {
      key: string;
      year: number;
      month: number;
      label: string;
      paidPkr: number;
      bills: number;
      duesPkr: number;
      payments: Payment[];
    };
    const map = new Map<string, MonthBucket>();
    for (const p of paymentsThisYear) {
      const ym = getKarachiYearMonth(p.paidAt);
      if (!ym) continue;
      const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          year: ym.year,
          month: ym.month,
          label: formatMonthYearLabel(ym.year, ym.month),
          paidPkr: 0,
          bills: 0,
          duesPkr: 0,
          payments: [],
        };
        map.set(key, bucket);
      }
      bucket.paidPkr += p.paidPkr || 0;
      bucket.bills += 1;
      // Per-invoice outstanding for that month (not member-level outstandingPkr).
      bucket.duesPkr += p.duePkr || 0;
      bucket.payments.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [paymentsThisYear]);

  if (memberQ.isLoading) {
    return (
      <Screen padded={false} edges={['top']}>
        <SkeletonProfile />
      </Screen>
    );
  }
  if (memberQ.isError || !memberQ.data)
    return (
      <ErrorView
        message={(memberQ.error as Error)?.message}
        onRetry={() => {
          void memberQ.refetch();
        }}
      />
    );

  const m = memberQ.data;
  const canWrite = can(role, 'members.write');
  const hasDue = m.outstandingPkr > 0;
  const isFrozen = m.status === 'frozen';
  const freezeBusy = freeze.isPending || unfreeze.isPending;

  return (
    <Screen padded={false} edges={['top']} style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.headerBar, { paddingHorizontal: spacing.lg }]}>
        <GlassIconButton
          name="chevron-back"
          variant="glass"
          accessibilityLabel="Go back"
          onPress={handleBack}
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {section === 'home' ? 'Profile' : section.charAt(0).toUpperCase() + section.slice(1)}
        </Text>
        {canWrite ? (
          <GlassIconButton
            name="create-outline"
            variant="glass"
            accessibilityLabel={section === 'attendance' ? 'Edit attendance' : 'Edit profile'}
            onPress={
              section === 'attendance'
                ? handleOpenAttendanceEditor
                : () => router.push({ pathname: '/(app)/members/edit', params: { id: m.id } })
            }
          />
        ) : (
          <View style={{ width: 40, height: 40 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={memberQ.isFetching}
            onRefresh={() => {
              void memberQ.refetch();
            }}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: tabPad + 24,
          flexGrow: 1,
        }}
      >
        {/* Profile hero card */}
        <GlassCard borderRadius={28} elevated contentStyle={styles.profileCard}>
          <View style={styles.profileTop}>
            <Avatar name={m.name} uri={m.photoUrl} size={72} />
            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                {m.planName}
              </Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={m.status}
                  variant={m.status as any}
                  size="sm"
                  style={styles.badgeChip}
                />
                {hasDue ? (
                  <Badge
                    label={`Due ${formatPkr(m.outstandingPkr)}`}
                    variant="unpaid"
                    size="sm"
                    style={styles.badgeChip}
                  />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.metricsRow}>
            {section === 'attendance' ? (
              <>
                <ProfileStat label="Visits" value={String(attendanceSummary.total)} />
                <ProfileStat label="This mo" value={String(attendanceSummary.thisMonth)} />
                <ProfileStat label="Valid" value={String(attendanceSummary.valid)} />
              </>
            ) : section === 'payments' ? (
              <>
                <ProfileStat
                  label="Paid"
                  value={formatNumberCompact(paymentSummary.paidPkr)}
                  unit="Rs"
                />
                <ProfileStat label="Bills" value={String(paymentSummary.bills)} />
                <ProfileStat
                  label="Dues"
                  value={formatNumberCompact(paymentSummary.duesPkr)}
                  unit="Rs"
                />
              </>
            ) : (
              <>
                <ProfileStat label="Age" value={ageFromDob(m.dateOfBirth)} />
                <ProfileStat label="Days" value={daysLeft} />
                <ProfileStat
                  label="Gender"
                  value={m.gender === 'male' ? 'Male' : m.gender === 'female' ? 'Female' : 'Other'}
                />
                <ProfileStat label="Monthly" value={formatPlanShort(m.planName)} />
              </>
            )}
          </View>
        </GlassCard>

        {section === 'home' ? (
          <>
            <View
              style={[
                styles.sectionShell,
                {
                  marginTop: 22,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)',
                },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={24}
                  tint={isDark ? 'dark' : 'light'}
                  style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                />
              ) : null}
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(255,255,255,0.08)', 'transparent']
                    : ['rgba(255,255,255,0.35)', 'transparent']
                }
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <ProfileRow
                icon="card-outline"
                title="Payments"
                subtitle="Invoices & dues"
                onPress={() => setSection('payments')}
              />
              <ProfileRow
                icon="calendar-outline"
                title="Attendance"
                subtitle="Check-ins & visits"
                onPress={() => setSection('attendance')}
              />
              <ProfileRow
                icon="nutrition-outline"
                title="Diet plan"
                subtitle="Meals & checkoffs"
                onPress={() => setSection('diet')}
              />
              <ProfileRow
                icon="barbell-outline"
                title="Workout plan"
                subtitle="Routines & streak"
                onPress={() => setSection('workout')}
              />
            </View>

            <Text style={[styles.sectionLabel, { color: colors.text }]}>Preferences</Text>
            <View
              style={[
                styles.sectionShell,
                {
                  backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)',
                },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={24}
                  tint={isDark ? 'dark' : 'light'}
                  style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                />
              ) : null}
              <ProfileRow
                icon="notifications-outline"
                title="Reminders"
                trailing={
                  <GlassSwitch
                    value={m.remindersEnabled}
                    onValueChange={(v) => toggleReminder.mutate(v)}
                    disabled={!canWrite || toggleReminder.isPending}
                  />
                }
              />
              <ProfileRow
                icon="hardware-chip-outline"
                title="Device"
                onPress={
                  canWrite
                    ? () => resync.mutate()
                    : undefined
                }
                trailing={
                  <View style={styles.deviceTrailing}>
                    <Badge
                      label={
                        m.enrollmentStatus === 'synced'
                          ? 'Synced'
                          : m.enrollmentStatus === 'pending'
                            ? 'Pending'
                            : 'Failed'
                      }
                      variant={
                        m.enrollmentStatus === 'synced'
                          ? 'active'
                          : m.enrollmentStatus === 'pending'
                            ? 'pending'
                            : 'expired'
                      }
                      size="sm"
                    />
                    {canWrite ? (
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    ) : null}
                  </View>
                }
              />
              {canWrite ? (
                <>
                  <ProfileRow
                    icon={isFrozen ? 'sunny-outline' : 'snow-outline'}
                    title={isFrozen ? 'Unfreeze' : 'Freeze 7 days'}
                    subtitle={isFrozen ? 'Resume membership' : 'Pause & extend end date'}
                    onPress={
                      freezeBusy
                        ? undefined
                        : () => {
                            if (isFrozen) unfreeze.mutate();
                            else freeze.mutate();
                          }
                    }
                  />
                  <ProfileRow
                    icon="trash-outline"
                    title="Delete member"
                    onPress={() =>
                      Alert.alert('Delete Member?', 'This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
                      ])
                    }
                  />
                </>
              ) : null}
            </View>

            {canWrite ? (
              <Button
                title="Collect / Renew Payment"
                variant="primary"
                fullWidth
                style={{ marginTop: 8 }}
                onPress={() =>
                  router.push({ pathname: '/(app)/fees/collect', params: { memberId: m.id } })
                }
              />
            ) : null}
          </>
        ) : null}

        {section === 'attendance' ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            {canWrite ? (
              <Button
                title="+ Mark Attendance"
                variant="secondary"
                size="sm"
                fullWidth
                onPress={() => {
                  setEditingAttendance(null);
                  setShowAttendanceModal(true);
                }}
              />
            ) : null}
            {monthlyAttendanceGroups.map((group) => (
              <View key={group.key} style={{ gap: 8, marginTop: 4 }}>
                <Text style={[styles.monthLabel, { color: colors.text, marginTop: 6, marginBottom: 2 }]}>
                  {group.label}
                </Text>
                {group.records.map((a) => {
                  const statusMeta = getAttendanceStatusMeta(a.status, a.direction);
                  return (
                    <Pressable
                      key={a.id}
                      onPress={
                        canWrite
                          ? () => {
                              setEditingAttendance(a);
                              setShowAttendanceModal(true);
                            }
                          : undefined
                      }
                      style={({ pressed }) => [{ opacity: pressed && canWrite ? 0.75 : 1 }]}
                    >
                      <GlassCard borderRadius={20} contentStyle={styles.listRow}>
                        <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                          <Text
                            style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}
                            numberOfLines={1}
                          >
                            {formatTime(a.checkedInAt)}
                          </Text>
                          <Text
                            style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}
                            numberOfLines={1}
                          >
                            {formatDate(a.checkedInAt)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Badge label={statusMeta.label} variant={statusMeta.variant} size="sm" />
                          {canWrite ? (
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color={isDark ? 'rgba(255,255,255,0.45)' : colors.textTertiary}
                            />
                          ) : null}
                        </View>
                      </GlassCard>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {!attQ.isLoading && monthlyAttendanceGroups.length === 0 ? (
              <GlassCard borderRadius={20} contentStyle={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No attendance records.</Text>
              </GlassCard>
            ) : null}
          </View>
        ) : null}

        {section === 'payments' ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            {monthlyPaymentSummaries.map((month) => (
              <View key={month.key} style={{ gap: 8, marginTop: 4 }}>
                <Text style={[styles.monthLabel, { color: colors.text, marginTop: 6, marginBottom: 2 }]}>
                  {month.label}
                </Text>
                {month.payments.map((p) => (
                  <GlassCard key={p.id} borderRadius={22} contentStyle={styles.paymentBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>
                        {formatPkr(p.paidPkr)}
                      </Text>
                      <Badge
                        label={p.status.toUpperCase()}
                        variant={p.status === 'paid' ? 'active' : p.status === 'partial' ? 'pending' : 'expired'}
                        size="sm"
                      />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                      {p.invoiceNumber} · {paymentSourceLabel(p.method)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                      {formatDateTime(p.paidAt)}
                    </Text>
                    <Button
                      title="Share Invoice PDF"
                      variant="secondary"
                      size="sm"
                      style={{ marginTop: 10 }}
                      onPress={async () => {
                        const invoice = await paymentsApi.invoice(p.id);
                        const { printAndShareInvoice } = await import('@/src/features/fees/invoice');
                        await printAndShareInvoice(invoice);
                      }}
                    />
                  </GlassCard>
                ))}
              </View>
            ))}

            {!payQ.isLoading && monthlyPaymentSummaries.length === 0 ? (
              <GlassCard borderRadius={20} contentStyle={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No payments recorded.</Text>
              </GlassCard>
            ) : null}
          </View>
        ) : null}

        {section === 'diet' ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 4 }]}>
              Diet plan
            </Text>
            {(dietQ.data || []).map((d) => {
              const done = d.checkoffs.filter((c) => c.completed).length;
              const total = d.checkoffs.length;
              return (
                <GlassCard key={d.id} borderRadius={22} contentStyle={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                      <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={1}>
                        {d.templateName}
                      </Text>
                      <Text style={[styles.planMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        Started {formatDate(d.startDate)}
                        {d.endDate ? ` · Ends ${formatDate(d.endDate)}` : ''}
                      </Text>
                    </View>
                    <Badge
                      label={total ? `${done}/${total}` : 'Assigned'}
                      variant={total && done === total ? 'active' : 'pending'}
                      size="sm"
                    />
                  </View>
                  {total ? (
                    <View style={styles.checkList}>
                      {d.checkoffs.map((c) => (
                        <View
                          key={c.id}
                          style={[
                            styles.checkItem,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(245,247,246,0.92)',
                              borderColor: isDark
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(255,255,255,0.95)',
                            },
                          ]}
                        >
                          <Ionicons
                            name={c.completed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={16}
                            color={c.completed ? colors.success : colors.textTertiary}
                          />
                          <Text
                            style={[
                              styles.checkLabel,
                              { color: c.completed ? colors.text : colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {c.mealName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </GlassCard>
              );
            })}
            {!dietQ.data?.length ? (
              <GlassCard borderRadius={20} contentStyle={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No diet assigned yet.</Text>
              </GlassCard>
            ) : null}
          </View>
        ) : null}

        {section === 'workout' ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 4 }]}>
              Workout plan
            </Text>
            {(workoutQ.data || []).map((w) => {
              const done = w.completions.filter((c) => c.completed).length;
              return (
                <GlassCard key={w.id} borderRadius={22} contentStyle={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                      <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={1}>
                        {w.planName}
                      </Text>
                      <Text style={[styles.planMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        Started {formatDate(w.startDate)}
                        {done ? ` · ${done} logged` : ''}
                      </Text>
                    </View>
                    <Badge
                      label={w.streakDays > 0 ? `${w.streakDays}d streak` : 'Active'}
                      variant={w.streakDays > 0 ? 'active' : 'pending'}
                      size="sm"
                    />
                  </View>
                  <View style={styles.summaryGrid}>
                    <ProfileStat label="Streak" value={`${w.streakDays}d`} />
                    <ProfileStat label="Logged" value={String(done)} />
                    <ProfileStat
                      label="Status"
                      value={w.streakDays > 0 ? 'On track' : 'Idle'}
                    />
                  </View>
                </GlassCard>
              );
            })}
            {!workoutQ.data?.length ? (
              <GlassCard borderRadius={20} contentStyle={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No workout plan assigned yet.</Text>
              </GlassCard>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <AttendanceEditModal
        visible={showAttendanceModal}
        onClose={() => {
          setShowAttendanceModal(false);
          setEditingAttendance(null);
        }}
        memberId={m.id}
        memberName={m.name}
        memberPhotoUrl={m.photoUrl}
        record={editingAttendance}
        isSaving={saveAttendanceMutation.isPending}
        isDeleting={deleteAttendanceMutation.isPending}
        onSave={async (values, recordId) => {
          await saveAttendanceMutation.mutateAsync({ values, recordId });
        }}
        onDelete={async (recordId) => {
          await deleteAttendanceMutation.mutateAsync(recordId);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    marginBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileCard: {
    padding: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  badgeChip: {
    flexShrink: 0,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  profileStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
  },
  profileStatValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileStatValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  profileStatUnit: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginLeft: 2,
    marginBottom: 1.5,
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 22,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  sectionShell: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    overflow: 'hidden',
  },
  rowCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  paymentBox: {
    padding: 16,
  },
  planCard: {
    padding: 16,
    gap: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  planMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  checkList: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: -4,
    marginBottom: 2,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  summaryCard: {
    padding: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  deviceTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
