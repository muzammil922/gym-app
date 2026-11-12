import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { Badge } from '@/src/components/ui/Badge';
import { Avatar } from '@/src/components/ui/Avatar';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { paymentsApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import { formatDate } from '@/src/utils/date';
import type { DueItem } from '@/src/api/types';

type SortKey = 'overdue' | 'amount';

/** Overdue buckets: 0 = not overdue yet, 1 = 1-7 days, 2 = 8-30 days, 3 = 30+ days. */
function overdueBucket(days: number): number {
  if (days <= 0) return 0;
  if (days <= 7) return 1;
  if (days <= 30) return 2;
  return 3;
}

const BUCKET_META: Record<number, { label: string; variant: 'active' | 'pending' | 'expired' | 'neutral' }> = {
  0: { label: 'Not due', variant: 'neutral' },
  1: { label: '1-7d', variant: 'pending' },
  2: { label: '8-30d', variant: 'expired' },
  3: { label: '30d+', variant: 'expired' },
};

export default function DuesScreen() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const query = useQuery({ queryKey: ['dues'], queryFn: paymentsApi.dues });

  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('overdue');

  const dues = useMemo(() => {
    const list = query.data || [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.filter(
          (item) =>
            item.memberName.toLowerCase().includes(needle) ||
            item.phone.toLowerCase().includes(needle) ||
            item.planName.toLowerCase().includes(needle),
        )
      : list;

    return [...filtered].sort((a, b) =>
      sortKey === 'overdue'
        ? b.daysOverdue - a.daysOverdue
        : b.outstandingPkr - a.outstandingPkr,
    );
  }, [query.data, q, sortKey]);

  const totals = useMemo(() => {
    const list = query.data || [];
    return {
      count: list.length,
      amount: list.reduce((sum, item) => sum + item.outstandingPkr, 0),
      critical: list.filter((item) => item.daysOverdue > 30).length,
    };
  }, [query.data]);

  const openCollect = (item: DueItem) => {
    router.push({
      pathname: '/(app)/fees/collect',
      params: { memberId: item.memberId },
    });
  };

  if (query.isLoading) return <SkeletonList />;
  if (query.isError) {
    return (
      <ErrorView
        message={(query.error as Error).message}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const renderDue = ({ item }: { item: DueItem }) => {
    const bucket = overdueBucket(item.daysOverdue);
    const meta = BUCKET_META[bucket];
    const isCritical = bucket === 3;

    return (
      <Pressable
        onPress={() => openCollect(item)}
        accessibilityRole="button"
        accessibilityLabel={`Collect from ${item.memberName}, ${formatPkr(item.outstandingPkr)} due`}
        style={{ marginBottom: 10 }}
      >
        <GlassCard borderRadius={20} contentStyle={{ padding: 14 }}>
          <View style={styles.row}>
            <Avatar name={item.memberName} size={44} />

            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.memberName}
                </Text>
                <Badge label={meta.label} variant={meta.variant} size="sm" />
              </View>

              <Text style={[styles.plan, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.planName}
                {item.phone ? ` · ${item.phone}` : ''}
              </Text>

              <View style={styles.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={11.5}
                  color={isCritical ? colors.danger : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.metaText,
                    { color: isCritical ? colors.danger : colors.textSecondary },
                  ]}
                >
                  {item.daysOverdue > 0
                    ? `Overdue ${item.daysOverdue}d · ended ${formatDate(item.endDate)}`
                    : `Ends ${formatDate(item.endDate)}`}
                </Text>
              </View>
            </View>

            <View style={styles.amountCol}>
              <Text
                style={[
                  styles.amount,
                  { color: isCritical ? colors.danger : colors.text },
                ]}
              >
                {formatPkr(item.outstandingPkr)}
              </Text>
              <View
                style={[
                  styles.collectChip,
                  {
                    backgroundColor: isDark
                      ? 'rgba(45, 212, 191, 0.16)'
                      : 'rgba(15, 118, 110, 0.10)',
                    borderColor: isDark
                      ? 'rgba(45, 212, 191, 0.40)'
                      : 'rgba(15, 118, 110, 0.25)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.collectText,
                    { color: isDark ? '#2DD4BF' : '#0F766E' },
                  ]}
                >
                  Collect
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={11}
                  color={isDark ? '#2DD4BF' : '#0F766E'}
                />
              </View>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Pending Dues"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search member, phone or plan..."
          filterContent={
            <>
              <GlassPill
                label="Most Overdue"
                size="sm"
                active={sortKey === 'overdue'}
                onPress={() => setSortKey('overdue')}
              />
              <GlassPill
                label="Highest Amount"
                size="sm"
                active={sortKey === 'amount'}
                onPress={() => setSortKey('amount')}
              />
            </>
          }
        />
      </View>

      <FlatList
        data={dues}
        keyExtractor={(item) => item.memberId}
        renderItem={renderDue}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 6,
          paddingBottom: tabPad + 40,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          totals.count > 0 ? (
            <GlassCard
              borderRadius={20}
              style={{ marginBottom: 14 }}
              contentStyle={{ padding: 16 }}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total outstanding
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatPkr(totals.amount)}
              </Text>
              <View style={[styles.summaryRow, { borderTopColor: colors.border }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>
                    {totals.count}
                  </Text>
                  <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>
                    Members
                  </Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryItemValue, { color: colors.danger }]}>
                    {totals.critical}
                  </Text>
                  <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>
                    Over 30 days
                  </Text>
                </View>
              </View>
            </GlassCard>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyView
            title={q ? 'No Matches' : 'No Pending Dues'}
            subtitle={
              q
                ? 'Try a different name, phone or plan.'
                : 'All members are cleared. Nothing to collect.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  plan: {
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  metaText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  collectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  collectText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  summaryItemValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  summaryItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
});
