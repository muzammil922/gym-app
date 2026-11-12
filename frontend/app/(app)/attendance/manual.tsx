import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { TextField } from '@/src/components/ui/TextField';
import { Button } from '@/src/components/ui/Button';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassDateField } from '@/src/components/ui/GlassDateField';
import { GlassSelect, type GlassSelectOption } from '@/src/components/ui/GlassSelect';
import { LiquidGlassStatusRow } from '@/src/components/ui/LiquidGlassStatusRow';
import { ErrorView, LoadingView } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { attendanceApi, membersApi, staffApi } from '@/src/api/endpoints';
import { nowKarachi } from '@/src/utils/date';
import type { AttendanceStatus } from '@/src/api/types';

export default function ManualCheckInScreen() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('check_in');
  const [reason, setReason] = useState('Card/device unavailable');
  const [selectedDate, setSelectedDate] = useState<Date>(nowKarachi());

  const membersQ = useQuery({
    queryKey: ['members', 'all'],
    queryFn: () => membersApi.list({ pageSize: 100 }),
  });

  const staffQ = useQuery({
    queryKey: ['staff', 'all'],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });

  const personOptions = useMemo<GlassSelectOption[]>(() => {
    const list: GlassSelectOption[] = [];

    for (const m of membersQ.data?.items || []) {
      list.push({
        value: m.id,
        label: m.name,
        hint: `Member · ${m.planName} · ${m.phone || 'No phone'}`,
      });
    }

    for (const s of staffQ.data?.items || []) {
      list.push({
        value: s.id,
        label: `${s.name} (Staff)`,
        hint: `Employee (${s.role.toUpperCase()}) · ${s.phone || 'No phone'}`,
      });
    }

    return list;
  }, [membersQ.data?.items, staffQ.data?.items]);

  const selectedPerson = useMemo(() => {
    const m = membersQ.data?.items.find((item) => item.id === memberId);
    if (m) return { ...m, isStaff: false, subtitle: m.planName };
    const s = staffQ.data?.items.find((item) => item.id === memberId);
    if (s) {
      return {
        ...s,
        isStaff: true,
        subtitle: `Staff · ${s.role.toUpperCase()}`,
        status: s.isActive ? 'active' : 'inactive',
      };
    }
    return null;
  }, [memberId, membersQ.data?.items, staffQ.data?.items]);

  const handleSetToNow = () => {
    setSelectedDate(nowKarachi());
  };

  const mutation = useMutation({
    mutationFn: attendanceApi.manual,
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      const alert =
        record.status === 'valid' || record.status === 'check_in'
          ? 'Check-in recorded.'
          : `Alert: status is ${record.status.toUpperCase()}.`;
      Alert.alert('Manual check-in', alert, [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const isLoading = membersQ.isLoading || staffQ.isLoading;
  const isError = membersQ.isError || staffQ.isError;
  const errorObj = (membersQ.error || staffQ.error) as Error | undefined;

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message={errorObj?.message || 'Failed to load'} />;

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Manual Check-in"
          showBack
          onBack={() => router.back()}
          showSearch={false}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: 6,
          paddingBottom: tabPad + 40,
        }}
      >
        <GlassCard borderRadius={18} contentStyle={{ padding: 14, marginBottom: 14 }}>
          <View style={styles.hintRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Use when the biometric device is unavailable. Expired or unpaid members will raise
              an alert.
            </Text>
          </View>
        </GlassCard>

        {/* Searchable Member / Employee Dropdown */}
        <GlassSelect
          label="Select Member / Employee"
          placeholder="Search and select member or staff…"
          value={memberId}
          options={personOptions}
          searchable
          searchPlaceholder="Search by name, phone or role…"
          onChange={(id) => setMemberId(id)}
        />

      {/* Selected Person Details Card */}
      {selectedPerson ? (
        <View style={{ marginTop: 12, marginBottom: 4 }}>
          <GlassCard caustic="cyan" borderRadius={22} contentStyle={styles.memberCard}>
            <Avatar name={selectedPerson.name} uri={selectedPerson.photoUrl} size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                {selectedPerson.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                {selectedPerson.subtitle} · {selectedPerson.phone || 'No phone'}
              </Text>
            </View>
            <Badge label={selectedPerson.status} variant={selectedPerson.status as any} size="sm" />
          </GlassCard>
        </View>
      ) : null}

      {/* Attendance Status Selection - 1 Single Line Liquid Glass */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>
        Attendance Status
      </Text>
      <View style={{ marginBottom: 16 }}>
        <LiquidGlassStatusRow value={status} onChange={setStatus} />
      </View>

      {/* Time & Date Pickers - Displayed when Check In or Check Out is selected */}
      {status === 'check_in' || status === 'check_out' ? (
        <View style={{ marginBottom: 14 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {status === 'check_in' ? 'Check-in Time' : 'Check-out Time'}
            </Text>
            <Pressable
              onPress={handleSetToNow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Set to current time"
              style={({ pressed }) => [
                styles.nowBtn,
                {
                  backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(15,118,110,0.10)',
                  borderColor: isDark
                    ? 'rgba(45,212,191,0.35)'
                    : 'rgba(15,118,110,0.25)',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="time-outline" size={13} color={isDark ? '#2DD4BF' : '#0F766E'} />
              <Text style={[styles.nowText, { color: isDark ? '#2DD4BF' : '#0F766E' }]}>
                Set to Now
              </Text>
            </Pressable>
          </View>

          <View style={styles.pickersRow}>
            <GlassDateField
              compact
              label="Date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(v) => {
                const [y, m, d] = v.split('-').map(Number);
                const next = new Date(selectedDate);
                next.setFullYear(y, m - 1, d);
                setSelectedDate(next);
              }}
              maximumDate={new Date()}
            />
            <GlassDateField
              compact
              mode="time"
              label="Time"
              value={format(selectedDate, 'HH:mm')}
              onChange={(v) => {
                const [h, min] = v.split(':').map(Number);
                const next = new Date(selectedDate);
                next.setHours(h, min, 0, 0);
                setSelectedDate(next);
              }}
            />
          </View>
        </View>
      ) : null}

        <TextField label="Reason / Notes" value={reason} onChangeText={setReason} />

        <Button
          title="Submit attendance"
          loading={mutation.isPending}
          disabled={!memberId}
          style={{ marginTop: 16 }}
          onPress={() =>
            mutation.mutate({
              memberId,
              reason: reason.trim(),
              status,
              direction: status === 'check_out' ? 'out' : 'in',
              checkedInAt:
                status === 'check_in' || status === 'check_out'
                  ? selectedDate.toISOString()
                  : undefined,
            })
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  nowText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
