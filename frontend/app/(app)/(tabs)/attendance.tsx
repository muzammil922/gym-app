import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { Badge } from '@/src/components/ui/Badge';
import { Avatar } from '@/src/components/ui/Avatar';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { attendanceApi } from '@/src/api/endpoints';
import { useInfiniteList } from '@/src/hooks/use-infinite-list';
import { formatTime } from '@/src/utils/date';
import { getAttendanceStatusMeta } from '@/src/utils/attendance';
import { useAuthStore } from '@/src/store/auth-store';
import { can } from '@/src/utils/permissions';

export default function AttendanceTab() {
  const { colors, spacing, isDark } = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const tabPad = useFloatingTabBarPad();
  const iconColor = isDark ? '#FFFFFF' : '#0B1312';
  const [q, setQ] = useState('');

  const query = useInfiniteList({
    queryKey: ['attendance', 'live'],
    q,
    pageSize: 10,
    fetchPage: ({ page, pageSize, q: needle }) =>
      attendanceApi.live({ page, pageSize, q: needle }),
  });

  return (
    <Screen padded={false} withTabBar>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <PageHeader
          title="Attendance"
          onBack={() => router.navigate('/(app)/(tabs)')}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search check-ins..."
          rightSlot={
            <GlassIconButton
              name="add"
              accessibilityLabel="Mark Attendance"
              onPress={() => router.push('/(app)/attendance/manual')}
            />
          }
          filterContent={
            <>
              <GlassPill
                label="Check-in"
                size="sm"
                icon={<Ionicons name="checkmark-circle-outline" size={15} color={iconColor} />}
                onPress={() => router.push('/(app)/attendance/manual')}
              />
              <GlassPill
                label="History"
                size="sm"
                icon={<Ionicons name="time-outline" size={15} color={iconColor} />}
                onPress={() => router.push('/(app)/attendance/history')}
              />
              {can(role, 'attendance.devices') ? (
                <GlassPill
                  label="Devices"
                  size="sm"
                  icon={<Ionicons name="hardware-chip-outline" size={15} color={iconColor} />}
                  onPress={() => router.push('/(app)/attendance/devices')}
                />
              ) : null}
            </>
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
          data={query.items}
          keyExtractor={(item) => item.id}
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
            padding: spacing.lg,
            paddingTop: 10,
            paddingBottom: tabPad,
            flexGrow: 1,
          }}
          renderItem={({ item }) => {
            const statusMeta = getAttendanceStatusMeta(item.status, (item as any).direction);
            return (
              <GlassCard borderRadius={22} style={{ marginBottom: 10 }}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/members/[id]',
                      params: { id: item.memberId, tab: 'attendance' },
                    })
                  }
                  style={({ pressed }) => [styles.cardRow, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Avatar name={item.memberName} uri={item.memberPhotoUrl} size={46} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{item.memberName}</Text>
                    <Text style={[styles.details, { color: colors.textSecondary }]}>
                      {formatTime(item.checkedInAt)} · {statusMeta.label}
                    </Text>
                    {item.deviceName ? (
                      <Text style={[styles.sub, { color: colors.textTertiary }]}>
                        Device: {item.deviceName}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={statusMeta.label} variant={statusMeta.variant} />
                </Pressable>
              </GlassCard>
            );
          }}
          ListEmptyComponent={
            <EmptyView
              title="No check-ins yet"
              subtitle="Today's attendance check-ins will stream here automatically."
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.textSecondary} />
            ) : undefined
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 70,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  details: {
    fontSize: 13,
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
});
