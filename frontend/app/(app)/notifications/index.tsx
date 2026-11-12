import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { SectionTitle } from '@/src/components/ui/SectionTitle';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { notificationsApi } from '@/src/api/endpoints';
import { formatDateTime } from '@/src/utils/date';
import { scheduleNotificationSafely } from '@/src/utils/notifications';

export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationsApi.list({ pageSize: 50 })).items,
    refetchInterval: 15_000,
  });

  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readOne = useMutation({
    mutationFn: notificationsApi.read,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const unread = (query.data || []).filter((n) => !n.read);
    if (!unread.length) return;
    const latest = unread[0];
    void scheduleNotificationSafely(latest.title, latest.body);
  }, [query.data?.[0]?.id]);

  if (query.isLoading) return <SkeletonList />;
  if (query.isError)
    return <ErrorView message={(query.error as Error).message} onRetry={() => { void query.refetch(); }} />;

  const unreadCount = (query.data || []).filter((n) => !n.read).length;

  return (
    <Screen padded={false}>
      <FlatList
        data={query.data || []}
        keyExtractor={(i) => i.id}
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 16, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle title="Notification Center" />
              {unreadCount > 0 ? (
                <Badge label={`${unreadCount} New`} variant="pending" size="sm" />
              ) : null}
            </View>
            <Text style={[styles.infoBanner, { color: colors.textSecondary }]}>
              Real-time in-app alerts and notifications.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyView
            title="All caught up"
            subtitle="You don't have any new notifications right now."
          />
        }
        ListFooterComponent={
          (query.data || []).length > 0 && unreadCount > 0 ? (
            <Button
              title="Mark All as Read"
              variant="secondary"
              fullWidth
              style={{ marginTop: 14 }}
              loading={readAll.isPending}
              onPress={() => readAll.mutate()}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <GlassCard
            borderRadius={22}
            style={{ marginBottom: 8 }}
            caustic={!item.read ? 'cyan' : 'none'}
          >
            <Pressable
              onPress={() => {
                if (!item.read) readOne.mutate(item.id);
              }}
              style={({ pressed }) => [
                styles.cardContent,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: item.read ? 'rgba(255,255,255,0.06)' : 'rgba(6, 182, 212, 0.2)',
                    borderColor: item.read ? 'rgba(255,255,255,0.1)' : 'rgba(6, 182, 212, 0.4)',
                  },
                ]}
              >
                <Ionicons
                  name={item.read ? 'notifications-outline' : 'notifications'}
                  size={19}
                  color={item.read ? colors.textSecondary : '#38BDF8'}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: colors.text,
                        fontWeight: item.read ? '600' : '700',
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {!item.read ? (
                    <View style={styles.unreadDot} />
                  ) : null}
                </View>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  {item.body}
                </Text>
                <Text style={[styles.date, { color: colors.textTertiary }]}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            </Pressable>
          </GlassCard>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    fontSize: 13,
    marginTop: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    letterSpacing: -0.2,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginLeft: 6,
    marginTop: 4,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  body: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    marginTop: 4,
  },
});
