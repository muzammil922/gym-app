import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Screen } from '@/src/components/ui/Screen';
import { Badge } from '@/src/components/ui/Badge';
import { Avatar } from '@/src/components/ui/Avatar';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSelect, type GlassSelectOption } from '@/src/components/ui/GlassSelect';
import { PageHeader, type PageHeaderPanel } from '@/src/components/ui/PageHeader';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useToastStore } from '@/src/store/toast-store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { paymentsApi } from '@/src/api/endpoints';
import { useInfiniteList } from '@/src/hooks/use-infinite-list';
import { formatPkr } from '@/src/utils/currency';
import {
  currentKarachiYear,
  formatDateTime,
  formatMonthYearLabel,
  getKarachiYearMonth,
} from '@/src/utils/date';
import type { Payment } from '@/src/api/types';

type MonthPaymentGroup = {
  key: string; // e.g. "2026-11"
  year: number;
  month: number;
  label: string; // e.g. "Nov 2026"
  totalPkr: number;
  records: Payment[];
};

export default function FeesTab() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const iconColor = isDark ? '#FFFFFF' : '#0B1312';
  const showToast = useToastStore((s) => s.show);

  const [panel, setPanel] = useState<PageHeaderPanel>('none');
  const [q, setQ] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const navigatingToSubPageRef = useRef(false);

  // Preserve filter/search when navigating to sub-pages; reset when switching tabs
  useFocusEffect(
    useCallback(() => {
      if (navigatingToSubPageRef.current) {
        navigatingToSubPageRef.current = false;
        return;
      }

      setPanel('none');
      setQ('');
      setSelectedMonth('all');
      setSelectedYear('all');
    }, []),
  );

  const query = useInfiniteList({
    queryKey: ['payments'],
    q,
    pageSize: 30,
    fetchPage: ({ page, pageSize, q: needle }) =>
      paymentsApi.list({ page, pageSize, q: needle }),
  });

  // Group payments into month-wise buckets
  const allMonthGroups = useMemo(() => {
    const map = new Map<string, MonthPaymentGroup>();
    for (const p of query.items) {
      const ym = getKarachiYearMonth(p.paidAt) || {
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
          totalPkr: 0,
          records: [],
        };
        map.set(key, group);
      }
      group.totalPkr += p.amountPkr || 0;
      group.records.push(p);
    }

    for (const group of map.values()) {
      group.records.sort((a, b) => {
        const ta = parseISO(a.paidAt).getTime();
        const tb = parseISO(b.paidAt).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [query.items]);

  const monthOptions = useMemo<GlassSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All Months' },
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ];
  }, []);

  const yearOptions = useMemo<GlassSelectOption[]>(() => {
    const list: GlassSelectOption[] = [{ value: 'all', label: 'All Years' }];
    for (let yr = 2025; yr <= 2035; yr++) {
      list.push({
        value: String(yr),
        label: String(yr),
      });
    }
    return list;
  }, []);

  const isSearching = q.trim().length > 0;

  const notifyFilter = useCallback(
    (m: string, y: string) => {
      if (m === 'all' && y === 'all') {
        showToast({
          title: 'Filter reset',
          message: 'Showing recent 3 months',
          tone: 'info',
        });
        return;
      }

      const monthName =
        m !== 'all'
          ? monthOptions.find((opt) => opt.value === m)?.label || m
          : 'All Months';
      const yearName = y !== 'all' ? y : 'All Years';

      showToast({
        title: 'Filter applied',
        message: `${monthName} · ${yearName}`,
        tone: 'info',
      });
    },
    [monthOptions, showToast],
  );

  // Filtered month groups: by search, by selected month/year, or default 3 months
  const displayedGroups = useMemo(() => {
    let list = allMonthGroups;

    if (selectedYear !== 'all') {
      const yr = Number(selectedYear);
      list = list.filter((g) => g.year === yr);
    }

    if (selectedMonth !== 'all') {
      const mo = Number(selectedMonth);
      list = list.filter((g) => g.month === mo);
    }

    if (isSearching) {
      return list;
    }

    // Default: show the 3 most recent months if no specific month/year is selected
    if (selectedMonth === 'all' && selectedYear === 'all') {
      return list.slice(0, 3);
    }

    return list;
  }, [allMonthGroups, isSearching, selectedMonth, selectedYear]);

  const navigateToSubPage = (action: () => void) => {
    navigatingToSubPageRef.current = true;
    action();
  };

  return (
    <Screen padded={false} withTabBar>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <PageHeader
          title="Fees"
          onBack={() => router.navigate('/(app)/(tabs)')}
          panel={panel}
          onPanelChange={setPanel}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search payments, members..."
          rightSlot={
            <GlassIconButton
              name="add"
              accessibilityLabel="Collect fee"
              onPress={() => navigateToSubPage(() => router.push('/(app)/fees/collect'))}
            />
          }
          filterContent={
            <View style={{ width: '100%', gap: 12 }}>
              {/* Quick Navigation Shortcuts - Single Line */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                }}
              >
                <GlassPill
                  label="Collect"
                  size="sm"
                  style={{ flex: 1, paddingHorizontal: 4 }}
                  icon={<Ionicons name="add-circle-outline" size={14} color={iconColor} />}
                  onPress={() => navigateToSubPage(() => router.push('/(app)/fees/collect'))}
                />
                <GlassPill
                  label="Plans"
                  size="sm"
                  style={{ flex: 1, paddingHorizontal: 4 }}
                  icon={<Ionicons name="card-outline" size={13} color={iconColor} />}
                  onPress={() => navigateToSubPage(() => router.push('/(app)/fees/plans'))}
                />
                <GlassPill
                  label="Dues"
                  size="sm"
                  style={{ flex: 1, paddingHorizontal: 4 }}
                  icon={<Ionicons name="alert-circle-outline" size={14} color={iconColor} />}
                  onPress={() => navigateToSubPage(() => router.push('/(app)/fees/dues'))}
                />
                <GlassPill
                  label="Reports"
                  size="sm"
                  style={{ flex: 1, paddingHorizontal: 4 }}
                  icon={<Ionicons name="stats-chart-outline" size={13} color={iconColor} />}
                  onPress={() => navigateToSubPage(() => router.push('/(app)/reports'))}
                />
              </View>

              {/* Month & Year Dropdown Selection */}
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                <View style={{ flex: 1.2 }}>
                  <GlassSelect
                    label="Month"
                    placeholder="All Months"
                    value={selectedMonth}
                    options={monthOptions}
                    onChange={(val) => {
                      setSelectedMonth(val);
                      notifyFilter(val, selectedYear);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <GlassSelect
                    label="Year"
                    placeholder="All Years"
                    value={selectedYear}
                    options={yearOptions}
                    onChange={(val) => {
                      setSelectedYear(val);
                      notifyFilter(selectedMonth, val);
                    }}
                  />
                </View>
              </View>

              {selectedMonth !== 'all' || selectedYear !== 'all' ? (
                <Pressable
                  onPress={() => {
                    setSelectedMonth('all');
                    setSelectedYear('all');
                    notifyFilter('all', 'all');
                  }}
                  hitSlop={8}
                  style={{ alignSelf: 'flex-end', marginTop: -4 }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isDark ? '#2DD4BF' : '#0F766E',
                    }}
                  >
                    Reset to Recent (3 Mo)
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      </View>

      {query.isLoading ? <SkeletonList /> : null}
      {query.isError ? (
        <ErrorView
          message={(query.error as Error).message}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}

      {!query.isLoading && !query.isError ? (
        <FlatList
          data={displayedGroups}
          keyExtractor={(group) => group.key}
          style={{ flex: 1 }}
          onEndReached={query.loadMore}
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
            paddingTop: 8,
            paddingBottom: tabPad,
            flexGrow: 1,
          }}
          renderItem={({ item: group }) => (
            <View style={{ marginBottom: 16 }}>
              {/* Month Group Header */}
              <View style={styles.monthHeaderRow}>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {group.label}
                </Text>
                <View
                  style={[
                    styles.monthStatPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.monthStats, { color: colors.textSecondary }]}>
                    {formatPkr(group.totalPkr)} · {group.records.length}{' '}
                    {group.records.length === 1 ? 'bill' : 'bills'}
                  </Text>
                </View>
              </View>

              {/* Month Records */}
              {group.records.map((item) => (
                <GlassCard key={item.id} borderRadius={22} style={{ marginBottom: 8 }}>
                  <Pressable
                    onPress={() =>
                      navigateToSubPage(() =>
                        router.push({
                          pathname: '/(app)/members/[id]',
                          params: { id: item.memberId, tab: 'payments' },
                        }),
                      )
                    }
                    style={({ pressed }) => [
                      styles.paymentRow,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Avatar
                      name={item.memberName || 'Member'}
                      uri={item.memberPhotoUrl}
                      size={46}
                    />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.name, { color: colors.text }]}>
                        {item.memberName || 'Member'}
                      </Text>
                      <Text style={[styles.date, { color: colors.textSecondary }]}>
                        {formatDateTime(item.paidAt)} · {item.method.toUpperCase()}
                      </Text>
                      {item.notes ? (
                        <Text style={[styles.notes, { color: colors.textTertiary }]}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.amount, { color: colors.text }]}>
                        {formatPkr(item.amountPkr)}
                      </Text>
                      <Badge label={item.status} variant={item.status as any} />
                    </View>
                  </Pressable>
                </GlassCard>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <EmptyView
              title={isSearching ? 'No matching payments' : 'No payments found'}
              subtitle={
                isSearching
                  ? 'Try searching with another name or keyword.'
                  : 'Collect your first member fee to generate receipt.'
              }
              actionLabel={!isSearching ? 'Collect payment' : undefined}
              onAction={
                !isSearching
                  ? () =>
                      navigateToSubPage(() => router.push('/(app)/fees/collect'))
                  : undefined
              }
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={colors.textSecondary}
              />
            ) : undefined
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterSubheading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  monthStatPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthStats: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    minHeight: 74,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  notes: {
    fontSize: 11,
    marginTop: 2,
  },
  amount: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});
