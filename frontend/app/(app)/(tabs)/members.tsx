import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { membersApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import { formatDate } from '@/src/utils/date';
import { useAuthStore } from '@/src/store/auth-store';
import { can } from '@/src/utils/permissions';
import type { Member } from '@/src/api/types';

function MemberListCard({ item }: { item: Member }) {
  const { colors, isDark } = useTheme();
  const hasDue = item.outstandingPkr > 0;
  const ringTone =
    item.status === 'active'
      ? colors.primary
      : item.status === 'expired'
        ? colors.danger
        : item.status === 'frozen'
          ? colors.warning
          : colors.textTertiary;

  return (
    <GlassCard borderRadius={20} style={styles.cardShell}>
      <Pressable
        onPress={() => router.push(`/(app)/members/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.status}`}
        style={({ pressed }) => [
          styles.cardContent,
          {
            backgroundColor: pressed
              ? isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(15, 118, 110, 0.04)'
              : 'transparent',
          },
        ]}
      >
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: isDark ? `${ringTone}55` : `${ringTone}40`,
              backgroundColor: isDark ? `${ringTone}14` : `${ringTone}10`,
            },
          ]}
        >
          <Avatar name={item.name} uri={item.photoUrl} size={44} />
        </View>

        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Badge
              label={item.status}
              variant={item.status as any}
              size="sm"
              style={styles.badgeChip}
            />
            {hasDue ? (
              <Badge
                label={`Due ${formatPkr(item.outstandingPkr)}`}
                variant="unpaid"
                size="sm"
                style={styles.badgeChip}
              />
            ) : null}
          </View>

          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.planName}
          </Text>

          <Text style={[styles.endDate, { color: colors.textTertiary }]} numberOfLines={1}>
            Ends {formatDate(item.endDate)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textTertiary}
          style={styles.chevron}
        />
      </Pressable>
    </GlassCard>
  );
}

export default function MembersTab() {
  const { spacing } = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const tabPad = useFloatingTabBarPad();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const query = useInfiniteQuery({
    queryKey: ['members', q, status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      membersApi.list({ q: q || undefined, status, page: pageParam, pageSize: 10 }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: Member }) => <MemberListCard item={item} />,
    [],
  );

  return (
    <Screen padded={false} withTabBar>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <PageHeader
          title="Members"
          onBack={() => router.navigate('/(app)/(tabs)')}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search member name or phone..."
          rightSlot={
            can(role, 'members.write') ? (
              <GlassIconButton
                name="person-add"
                accessibilityLabel="Add member"
                onPress={() => router.push('/(app)/members/add')}
              />
            ) : undefined
          }
          filterContent={
            <>
              <GlassPill label="All" size="sm" active={!status} onPress={() => setStatus(undefined)} />
              <GlassPill
                label="Active"
                size="sm"
                active={status === 'active'}
                onPress={() => setStatus('active')}
              />
              <GlassPill
                label="Expired"
                size="sm"
                active={status === 'expired'}
                onPress={() => setStatus('expired')}
              />
              <GlassPill
                label="Frozen"
                size="sm"
                active={status === 'frozen'}
                onPress={() => setStatus('frozen')}
              />
            </>
          }
        />
      </View>

      {query.isLoading ? <SkeletonList /> : null}
      {query.isError ? (
        <ErrorView message={(query.error as Error).message} onRetry={() => { void query.refetch(); }} />
      ) : null}

      {!query.isLoading && !query.isError ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 4,
            paddingBottom: tabPad,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isFetchingNextPage}
              onRefresh={() => { void query.refetch(); }}
            />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyView
              title="No members found"
              subtitle={q ? 'Try a different search query.' : 'Add your first member to get started.'}
              actionLabel={can(role, 'members.write') ? 'Add member' : undefined}
              onAction={can(role, 'members.write') ? () => router.push('/(app)/members/add') : undefined}
            />
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 76,
    gap: 12,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  badgeChip: {
    flexShrink: 0,
  },
  meta: {
    fontSize: 13,
    letterSpacing: -0.08,
  },
  endDate: {
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 1,
  },
  chevron: {
    marginLeft: 2,
  },
});
