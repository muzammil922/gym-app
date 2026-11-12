import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { attendanceApi } from '@/src/api/endpoints';
import { useInfiniteList } from '@/src/hooks/use-infinite-list';
import { addDaysIso, formatDate, formatTime, todayIso } from '@/src/utils/date';
import { getAttendanceStatusMeta } from '@/src/utils/attendance';
import type { AttendanceRecord } from '@/src/api/types';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

type ViewMode = 'week' | 'month';

type DaySection = {
  key: string;
  title: string;
  weekday: string;
  count: number;
  data: AttendanceRecord[];
};

/** Monday-start week containing `iso`. */
function weekRange(iso: string) {
  const d = parseISO(iso);
  return {
    from: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    to: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
}

function monthRange(iso: string) {
  return { from: iso.slice(0, 8) + '01', to: iso };
}

export default function AttendanceHistoryScreen() {
  const { colors, spacing } = useTheme();
  const tabPad = useFloatingTabBarPad();

  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(todayIso());
  const [q, setQ] = useState('');

  const range = useMemo(
    () => (mode === 'week' ? weekRange(anchor) : monthRange(anchor)),
    [mode, anchor],
  );

  const query = useInfiniteList<AttendanceRecord>({
    queryKey: ['attendance', mode, range.from, range.to],
    pageSize: 50,
    q,
    fetchPage: ({ page, pageSize }) =>
      attendanceApi.range({
        from: range.from,
        to: range.to,
        page,
        pageSize,
      }),
  });

  // Group flat records into day sections (newest day first).
  const sections: DaySection[] = useMemo(() => {
    const byDay = new Map<string, AttendanceRecord[]>();
    for (const item of query.items) {
      const day = item.checkedInAt.slice(0, 10);
      const list = byDay.get(day) || [];
      list.push(item);
      byDay.set(day, list);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, items]) => ({
        key: day,
        title: formatDate(day, 'dd MMM yyyy'),
        weekday: format(parseISO(day), 'EEEE'),
        count: items.length,
        data: items.sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)),
      }));
  }, [query.items]);

  const shift = (dir: -1 | 1) => {
    if (mode === 'week') {
      setAnchor(addDaysIso(anchor, dir * 7));
      return;
    }
    const d = parseISO(monthRange(anchor).from);
    const next = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    setAnchor(format(next, 'yyyy-MM-dd'));
  };

  const rangeLabel =
    mode === 'week'
      ? `${formatDate(range.from, 'dd MMM')} → ${formatDate(range.to, 'dd MMM yyyy')}`
      : formatDate(range.from, 'MMMM yyyy');

  const totalRecords = query.items.length;

  if (query.isLoading) return <SkeletonList />;

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Attendance History"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search member..."
          filterContent={
            <>
              <GlassPill
                label="Week"
                size="sm"
                active={mode === 'week'}
                onPress={() => setMode('week')}
              />
              <GlassPill
                label="Month"
                size="sm"
                active={mode === 'month'}
                onPress={() => setMode('month')}
              />
            </>
          }
        />
      </View>

      {/* Period navigator */}
      <View
        style={[
          styles.navRow,
          { paddingHorizontal: spacing.lg, paddingBottom: 10 },
        ]}
      >
        <Pressable
          onPress={() => shift(-1)}
          hitSlop={8}
          accessibilityLabel="Previous period"
          style={({ pressed }) => [
            styles.navBtn,
            {
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
            {rangeLabel}
          </Text>
          <Text style={[styles.navSub, { color: colors.textSecondary }]}>
            {mode === 'week' ? 'This week' : 'This month'} · {totalRecords} records
          </Text>
        </View>

        <Pressable
          onPress={() => shift(1)}
          hitSlop={8}
          accessibilityLabel="Next period"
          style={({ pressed }) => [
            styles.navBtn,
            {
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </Pressable>
      </View>

      {query.isError ? (
        <ErrorView
          message={(query.error as Error).message}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (sections.length > 0 && query.hasNextPage) query.loadMore();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => {
                void query.refetch();
              }}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: tabPad + 40,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <EmptyView
              title="No records"
              subtitle={
                q
                  ? 'No member matched this search.'
                  : `Nothing between ${formatDate(range.from)} and ${formatDate(range.to)}.`
              }
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.textSecondary} />
            ) : undefined
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={13}
                  color={colors.textSecondary}
                />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {section.weekday}
                </Text>
                <Text style={[styles.sectionDate, { color: colors.textSecondary }]}>
                  {section.title}
                </Text>
              </View>
              <Badge label={`${section.count}`} variant="neutral" size="sm" />
            </View>
          )}
          renderItem={({ item }) => {
            const statusMeta = getAttendanceStatusMeta(item.status, item.direction);
            return (
              <GlassCard
                borderRadius={16}
                style={{ marginBottom: 8 }}
                contentStyle={{ padding: 13 }}
              >
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                      {item.memberName}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {formatTime(item.checkedInAt)}
                      {item.source === 'device' ? ' · Device' : ' · Manual'}
                      {item.deviceName ? ` (${item.deviceName})` : ''}
                    </Text>
                  </View>
                  <Badge label={statusMeta.label} variant={statusMeta.variant} size="sm" />
                </View>
              </GlassCard>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  navSub: {
    fontSize: 11.5,
    marginTop: 1,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  sectionDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
});
