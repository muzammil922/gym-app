import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/src/components/ui/Screen';
import { ErrorView, LoadingView, SkeletonList } from '@/src/components/feedback/StateViews';
import { SectionTitle } from '@/src/components/ui/SectionTitle';
import { Badge } from '@/src/components/ui/Badge';
import { Avatar } from '@/src/components/ui/Avatar';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { TodayStatsChart, TodayStatKey } from '@/src/components/ui/TodayStatsChart';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/auth-store';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPkrCompact } from '@/src/utils/currency';
import { formatDate, formatTime } from '@/src/utils/date';
import { can, isStaff } from '@/src/utils/permissions';
import { useT } from '@/src/i18n';

const doNowBounce = FadeInDown.duration(320).springify().damping(14).stiffness(180);

type AttentionItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeVariant?: 'unpaid' | 'pending' | 'expired' | 'neutral';
  onPress: () => void;
};

function attentionTone(
  variant: AttentionItem['badgeVariant'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (variant) {
    case 'unpaid':
    case 'expired':
      return colors.danger;
    case 'pending':
      return colors.warning;
    default:
      return colors.primary;
  }
}

export default function DashboardScreen() {
  const { colors, spacing, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [doNowOpen, setDoNowOpen] = useState(true);
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    enabled: isStaff(user?.role),
  });

  if (!isStaff(user?.role)) {
    return (
      <Screen scroll withTabBar padded={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: spacing.md }}>
        <View>
          <GlassCard borderRadius={26} elevated style={styles.headerCard}>
            <View style={styles.headerInner}>
              <Avatar name={user?.name || 'Member'} uri={user?.avatarUrl} size={52} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Hi</Text>
                <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
                  {user?.name}
                </Text>
                <Text style={[styles.subGreeting, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('dash.memberHomeHint')}
                </Text>
              </View>
            </View>
          </GlassCard>

          <View style={styles.memberGrid}>
            <GlassCard borderRadius={24} style={styles.memberHalf}>
              <Pressable onPress={() => router.push('/(app)/diet')} style={styles.memberActionStack}>
                <View
                  style={[
                    styles.actionIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Ionicons name="nutrition" size={22} color={isDark ? '#FFFFFF' : '#0B1312'} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 14 }}>
                  {t('dash.diet')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {t('dash.dietSub')}
                </Text>
              </Pressable>
            </GlassCard>

            <GlassCard borderRadius={24} style={styles.memberHalf}>
              <Pressable onPress={() => router.push('/(app)/workout')} style={styles.memberActionStack}>
                <View
                  style={[
                    styles.actionIconCircle,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <Ionicons name="barbell" size={22} color={isDark ? '#FFFFFF' : '#0B1312'} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 14 }}>
                  {t('dash.workout')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {t('dash.workoutSub')}
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        </View>
      </Screen>
    );
  }

  if (query.isLoading) return <LoadingView />;
  if (query.isError)
    return <ErrorView message={(query.error as Error).message} onRetry={() => { void query.refetch(); }} />;
  if (!query.data) return <SkeletonList />;

  const d = query.data;
  const iconColor = isDark ? '#FFFFFF' : '#0B1312';
  const problemCheckIns = d.recentCheckIns.filter(
    (a) => a.status === 'unpaid' || a.status === 'expired' || a.status === 'frozen',
  ).length;

  const attention: AttentionItem[] = [];
  if (can(user?.role, 'fees') && d.pendingDuesPkr > 0) {
    attention.push({
      key: 'dues',
      title: t('dash.duesTitle', { amount: formatPkrCompact(d.pendingDuesPkr) }),
      subtitle: t('dash.duesSub'),
      icon: 'cash-outline',
      badge: 'dues',
      badgeVariant: 'unpaid',
      onPress: () => router.push('/(app)/fees/dues'),
    });
  }
  if (d.expiringIn7Days > 0) {
    attention.push({
      key: 'expiring',
      title: t('dash.expiringTitle', { count: d.expiringIn7Days }),
      subtitle: t('dash.expiringSub'),
      icon: 'time-outline',
      badge: 'soon',
      badgeVariant: 'pending',
      onPress: () => router.push('/(app)/(tabs)/members'),
    });
  }
  if (problemCheckIns > 0) {
    attention.push({
      key: 'checkin-issues',
      title: t('dash.checkinIssueTitle', { count: problemCheckIns }),
      subtitle: t('dash.checkinIssueSub'),
      icon: 'alert-circle-outline',
      badge: 'alert',
      badgeVariant: 'expired',
      onPress: () => router.push('/(app)/(tabs)/attendance'),
    });
  }
  if (d.pendingEnrollments > 0) {
    attention.push({
      key: 'sync',
      title: t('dash.syncTitle', { count: d.pendingEnrollments }),
      subtitle: t('dash.syncSub'),
      icon: 'hardware-chip-outline',
      badge: 'sync',
      badgeVariant: 'pending',
      onPress: () => router.push('/(app)/attendance/devices'),
    });
  }

  const allClear = attention.length === 0;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen
      scroll
      withTabBar
      padded={false}
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: spacing.sm }}
    >
      <>
        <GlassCard borderRadius={26} elevated style={styles.headerCard}>
          <View style={styles.headerInner}>
            <Avatar name={user?.name || 'Coach'} uri={user?.avatarUrl} size={52} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{hello}</Text>
              <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
                {user?.name || 'Coach'}
              </Text>
              {allClear ? (
                <Text style={[styles.subGreeting, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('dash.greetingClear')}
                </Text>
              ) : null}
            </View>
            <Badge label={user?.role || 'staff'} variant="neutral" size="sm" />
          </View>
        </GlassCard>

        {allClear ? (
          <>
            <SectionTitle title={t('dash.sectionStatus')} />
            <GlassCard borderRadius={20} contentStyle={styles.emptyBox}>
              <View
                style={[
                  styles.actionIconCircle,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 12 }}>
                {t('dash.allClearTitle')}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {t('dash.allClearBody')}
              </Text>
            </GlassCard>
          </>
        ) : doNowOpen ? (
          <Animated.View
            key="do-now-open"
            entering={doNowBounce}
            style={{ marginTop: spacing.xl }}
          >
            <Pressable
              onPress={() => setDoNowOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={`${t('dash.sectionDoNow')}, ${attention.length}`}
              style={({ pressed }) => [styles.doNowHeader, { opacity: pressed ? 0.72 : 1 }]}
            >
              <View style={styles.doNowHeaderLeft}>
                <Text style={[styles.doNowLabel, { color: colors.textSecondary }]}>
                  {t('dash.sectionDoNow').toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(45, 212, 191, 0.16)'
                        : 'rgba(15, 118, 110, 0.10)',
                      borderColor: isDark
                        ? 'rgba(45, 212, 191, 0.32)'
                        : 'rgba(15, 118, 110, 0.18)',
                    },
                  ]}
                >
                  <Text style={[styles.countPillText, { color: colors.primary }]}>
                    {attention.length}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-up" size={16} color={colors.textTertiary} />
            </Pressable>

            <GlassCard borderRadius={20}>
              {attention.map((item, index) => {
                const tone = attentionTone(item.badgeVariant, colors);
                return (
                  <Animated.View
                    key={item.key}
                    entering={FadeInDown.delay(36 + index * 40)
                      .duration(280)
                      .springify()
                      .damping(16)
                      .stiffness(180)}
                  >
                    {index > 0 ? (
                      <View
                        style={[
                          styles.doNowSeparator,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.06)',
                          },
                        ]}
                      />
                    ) : null}
                    <Pressable
                      onPress={item.onPress}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.doNowRow,
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
                          styles.doNowIcon,
                          {
                            backgroundColor: isDark ? `${tone}22` : `${tone}14`,
                            borderColor: isDark ? `${tone}40` : `${tone}28`,
                          },
                        ]}
                      >
                        <Ionicons name={item.icon} size={18} color={tone} />
                      </View>
                      <View style={styles.doNowCopy}>
                        <Text
                          style={[styles.doNowTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[styles.doNowSubtitle, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                      {item.badge && item.badgeVariant ? (
                        <Badge label={item.badge} variant={item.badgeVariant} size="sm" />
                      ) : null}
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textTertiary}
                        style={styles.doNowChevron}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </GlassCard>
          </Animated.View>
        ) : (
          <Animated.View
            key="do-now-closed"
            entering={doNowBounce}
            style={{ marginTop: spacing.xl }}
          >
            <GlassCard borderRadius={20}>
              <Pressable
                onPress={() => setDoNowOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('dash.needAttention')}, ${attention.length}`}
                style={({ pressed }) => [
                  styles.collapsedCard,
                  {
                    opacity: pressed ? 0.78 : 1,
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
                    styles.countPillLg,
                    {
                      backgroundColor: isDark
                        ? 'rgba(45, 212, 191, 0.16)'
                        : 'rgba(15, 118, 110, 0.10)',
                      borderColor: isDark
                        ? 'rgba(45, 212, 191, 0.32)'
                        : 'rgba(15, 118, 110, 0.18)',
                    },
                  ]}
                >
                  <Text style={[styles.countPillLgText, { color: colors.primary }]}>
                    {attention.length}
                  </Text>
                </View>
                <View style={styles.doNowCopy}>
                  <Text style={[styles.collapsedTitle, { color: colors.text }]}>
                    {t('dash.needAttention')}
                  </Text>
                  <Text style={[styles.doNowSubtitle, { color: colors.textSecondary }]}>
                    {t('dash.sectionDoNow')}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </Pressable>
            </GlassCard>
          </Animated.View>
        )}

        <SectionTitle title={t('dash.fastActions')} />
        <View style={styles.actionRow}>
          {can(user?.role, 'members.write') ? (
            <GlassPill
              label={t('dash.addMember')}
              size="md"
              style={styles.actionPill}
              icon={<Ionicons name="person-add" size={15} color={iconColor} />}
              onPress={() => router.push('/(app)/members/add')}
            />
          ) : null}
          {can(user?.role, 'fees') ? (
            <GlassPill
              label={t('dash.collectFee')}
              size="md"
              style={styles.actionPill}
              icon={<Ionicons name="cash-outline" size={16} color={iconColor} />}
              onPress={() => router.push('/(app)/fees/collect')}
            />
          ) : null}
          <GlassPill
            label={t('dash.checkIn')}
            size="md"
            style={styles.actionPill}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color={iconColor} />}
            onPress={() => router.push('/(app)/attendance/manual')}
          />
        </View>

        <SectionTitle title={t('dash.numbers')} />
        <TodayStatsChart
          checkIns={d.todayCheckIns}
          collectionPkr={d.todayCollectionPkr}
          activeMembers={d.activeMembers}
          expiringIn7Days={d.expiringIn7Days}
          pendingDuesPkr={d.pendingDuesPkr}
          pendingEnrollments={d.pendingEnrollments}
          recentCheckIns={d.recentCheckIns}
          expiringMembers={d.expiringMembers}
          onNavigate={(key: TodayStatKey) => {
            if (key === 'checkIns') router.push('/(app)/(tabs)/attendance');
            else if (key === 'collection' || key === 'dues') {
              router.push(key === 'dues' ? '/(app)/fees/dues' : '/(app)/(tabs)/fees');
            } else if (key === 'active' || key === 'expiring') {
              router.push('/(app)/(tabs)/members');
            } else if (key === 'sync') {
              router.push('/(app)/attendance/devices');
            }
          }}
        />

        <SectionTitle
          title={t('dash.inGym')}
          actionText={t('dash.viewAll')}
          onAction={() => router.push('/(app)/(tabs)/attendance')}
        />
        {d.recentCheckIns.length === 0 ? (
          <GlassCard borderRadius={20} contentStyle={styles.emptyBox}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('dash.noCheckins')}</Text>
            <Pressable
              onPress={() => router.push('/(app)/attendance/manual')}
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('dash.manualCheckin')}
              </Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View style={styles.feedStack}>
            {d.recentCheckIns.slice(0, 4).map((a) => (
              <GlassCard key={a.id} borderRadius={20}>
                <Pressable
                  onPress={() => router.push(`/(app)/members/${a.memberId}`)}
                  style={({ pressed }) => [styles.feedRow, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Avatar name={a.memberName} uri={a.memberPhotoUrl} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: 15,
                        letterSpacing: -0.2,
                      }}
                    >
                      {a.memberName}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {formatTime(a.checkedInAt)} · {a.source}
                    </Text>
                  </View>
                  <Badge label={a.status} variant={a.status as any} />
                </Pressable>
              </GlassCard>
            ))}
          </View>
        )}

        <SectionTitle
          title={t('dash.renewSoon')}
          actionText={t('dash.members')}
          onAction={() => router.push('/(app)/(tabs)/members')}
        />
        {d.expiringMembers.length === 0 ? (
          <GlassCard borderRadius={20} contentStyle={styles.emptyBox}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('dash.noExpiring')}</Text>
          </GlassCard>
        ) : (
          <View style={styles.feedStack}>
            {d.expiringMembers.slice(0, 4).map((m) => (
              <GlassCard key={m.id} borderRadius={20}>
                <View style={styles.feedRow}>
                  <Pressable
                    onPress={() => router.push(`/(app)/members/${m.id}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  >
                    <Avatar name={m.name} uri={m.photoUrl} size={42} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '700',
                          fontSize: 15,
                          letterSpacing: -0.2,
                        }}
                      >
                        {m.name}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {m.planName} · {formatDate(m.endDate)}
                      </Text>
                    </View>
                  </Pressable>
                  {can(user?.role, 'fees') ? (
                    <GlassPill
                      label={t('dash.renew')}
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/fees/collect',
                          params: { memberId: m.id },
                        })
                      }
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  )}
                </View>
              </GlassCard>
            ))}
          </View>
        )}
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: 2,
    marginTop: 0,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingRight: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subGreeting: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  doNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
    minHeight: 32,
  },
  doNowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doNowLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countPillLg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillLgText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  doNowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  doNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    gap: 12,
  },
  doNowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doNowCopy: {
    flex: 1,
    minWidth: 0,
  },
  doNowTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  doNowSubtitle: {
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.08,
  },
  doNowChevron: {
    marginLeft: 2,
  },
  collapsedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    gap: 12,
  },
  collapsedTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  feedStack: {
    gap: 8,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 66,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  memberHalf: {
    flex: 1,
  },
  memberActionStack: {
    padding: 18,
    minHeight: 148,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
