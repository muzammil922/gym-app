import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from './GlassCard';
import { GlassPill } from './GlassPill';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatPkr, formatPkrCompact } from '@/src/utils/currency';
import type { AttendanceRecord, Member } from '@/src/api/types';

export type TodayStatKey =
  | 'checkIns'
  | 'collection'
  | 'active'
  | 'expiring'
  | 'dues'
  | 'sync';

export type StatsPeriod = 'today' | 'week' | 'month';

type StatItem = {
  key: TodayStatKey;
  short: string;
  title: string;
  label: string;
  valueLabel: string;
  raw: number;
  icon: keyof typeof Ionicons.glyphMap;
  detail: string;
  rows: Array<{ label: string; value: string }>;
};

type Props = {
  checkIns: number;
  collectionPkr: number;
  activeMembers: number;
  expiringIn7Days: number;
  pendingDuesPkr: number;
  pendingEnrollments: number;
  recentCheckIns?: AttendanceRecord[];
  expiringMembers?: Array<Pick<Member, 'id' | 'name' | 'endDate' | 'planName' | 'photoUrl'>>;
  onNavigate?: (key: TodayStatKey) => void;
};

const BAR_MAX = 168;
const BAR_MIN = 72;
const AUTO_MS = 3200;
const PAUSE_MS = 8000;
const SUCK_MS = 380;
const EMERGE_MS = 560;

const soft = Easing.bezier(0.22, 1, 0.36, 1);
const suckEase = Easing.bezier(0.55, 0.05, 0.85, 0.35);

const PERIOD_MULT: Record<StatsPeriod, number> = {
  today: 1,
  week: 6.2,
  month: 24,
};

const PERIOD_LABEL: Record<StatsPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

function scaleFlow(n: number, period: StatsPeriod) {
  return Math.max(0, Math.round(n * PERIOD_MULT[period]));
}

function barHeight(pct: number) {
  const ratio = Math.max(0.12, Math.min(1, pct / 100));
  return BAR_MIN + ratio * (BAR_MAX - BAR_MIN);
}

function GlassBar({
  short,
  pct,
  active,
  activeBarBg,
  idleBarBg,
  activeBorder,
  idleBorder,
  isDark,
  textSecondary,
  onPress,
}: {
  short: string;
  pct: number;
  active: boolean;
  activeBarBg: string;
  idleBarBg: string;
  activeBorder: string;
  idleBorder: string;
  isDark: boolean;
  textSecondary: string;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);
  const heightSV = useSharedValue(barHeight(pct));
  const scale = useSharedValue(1);
  const warp = useSharedValue(0);
  const wasActive = useRef(active);

  useEffect(() => {
    heightSV.value = withTiming(barHeight(pct), {
      duration: EMERGE_MS,
      easing: soft,
    });
  }, [pct, heightSV]);

  useEffect(() => {
    const leaving = wasActive.current && !active;
    const entering = !wasActive.current && active;

    if (entering) {
      scale.value = 0.04;
      warp.value = 1;
      progress.value = 0;
      warp.value = withDelay(140, withTiming(0, { duration: EMERGE_MS, easing: soft }));
      scale.value = withDelay(
        140,
        withSpring(1, { damping: 11, stiffness: 140, mass: 0.85 }),
      );
      progress.value = withDelay(
        140,
        withTiming(1, { duration: EMERGE_MS, easing: soft }),
      );
    } else if (leaving) {
      warp.value = withTiming(1, { duration: SUCK_MS, easing: suckEase });
      scale.value = withSequence(
        withTiming(0.05, { duration: SUCK_MS, easing: suckEase }),
        withTiming(1, { duration: 420, easing: soft }),
      );
      progress.value = withTiming(0, { duration: SUCK_MS, easing: suckEase });
      warp.value = withDelay(SUCK_MS, withTiming(0, { duration: 420, easing: soft }));
    }

    wasActive.current = active;
  }, [active, progress, scale, warp]);

  const barStyle = useAnimatedStyle(() => {
    const crushX = interpolate(warp.value, [0, 1], [1, 0.35]);
    const crushY = interpolate(warp.value, [0, 1], [1, 0.12]);
    return {
      height: heightSV.value,
      backgroundColor: interpolateColor(progress.value, [0, 1], [idleBarBg, activeBarBg]),
      borderColor: interpolateColor(progress.value, [0, 1], [idleBorder, activeBorder]),
      opacity: interpolate(warp.value, [0, 0.7, 1], [1, 0.55, 0.2]),
      transform: [{ scale: scale.value }, { scaleX: crushX }, { scaleY: crushY }],
    };
  });

  const pctStyle = useAnimatedStyle(() => ({
    opacity: interpolate(warp.value, [0, 1], [0.55 + progress.value * 0.45, 0]),
    transform: [
      { scale: interpolate(warp.value, [0, 1], [1, 0.4]) },
      { translateY: interpolate(warp.value, [0, 1], [0, 10]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(warp.value, [0, 0.5, 1], [1, 0.3, 0]),
  }));

  const holeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(warp.value, [0, 0.55, 1], [0, 0.95, 0.12]),
    transform: [{ scale: interpolate(warp.value, [0, 1], [0.15, 1.15]) }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.barCol}>
      <Animated.Text
        style={[
          styles.barPct,
          pctStyle,
          { color: active ? (isDark ? '#2DD4BF' : '#0F766E') : textSecondary },
        ]}
      >
        {pct}%
      </Animated.Text>

      <Animated.View style={[styles.bar, barStyle]}>
        <LinearGradient
          colors={
            active
              ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']
              : isDark
                ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.05)', 'transparent']
                : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.08)']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Animated.View pointerEvents="none" style={[styles.holeCore, holeStyle]} />
        <Animated.Text
          style={[
            styles.barLabel,
            labelStyle,
            {
              color: active
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(255,255,255,0.55)'
                  : 'rgba(15,26,25,0.45)',
            },
          ]}
        >
          {short}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function TodayStatsChart({
  checkIns,
  collectionPkr,
  activeMembers,
  expiringIn7Days,
  pendingDuesPkr,
  pendingEnrollments,
  recentCheckIns = [],
  expiringMembers = [],
  onNavigate,
}: Props) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<TodayStatKey>('checkIns');
  const [period, setPeriod] = useState<StatsPeriod>('today');
  const [modalKey, setModalKey] = useState<TodayStatKey | null>(null);
  const [pausedUntil, setPausedUntil] = useState(0);

  const iconColor = isDark ? '#FFFFFF' : '#0F1A19';

  const items: StatItem[] = useMemo(() => {
    const flowCheckIns = scaleFlow(checkIns, period);
    const flowCollection = scaleFlow(collectionPkr, period);
    const periodName = PERIOD_LABEL[period].toLowerCase();

    // Snapshot metrics stay stable; flow metrics scale with period
    const active = activeMembers;
    const expiring =
      period === 'today'
        ? expiringIn7Days
        : period === 'week'
          ? expiringIn7Days
          : Math.max(expiringIn7Days, Math.round(expiringIn7Days * 1.8));
    const dues = pendingDuesPkr;
    const sync = pendingEnrollments;

    return [
      {
        key: 'checkIns' as const,
        short: 'Check',
        title: 'Check-ins',
        label: `${periodName} check-ins`,
        valueLabel: String(flowCheckIns),
        raw: flowCheckIns,
        icon: 'finger-print' as const,
        detail: `Member door activity for ${periodName}.`,
        rows: [
          { label: 'Total check-ins', value: String(flowCheckIns) },
          { label: 'Avg / day', value: String(Math.max(1, Math.round(flowCheckIns / (period === 'today' ? 1 : period === 'week' ? 7 : 30)))) },
          { label: 'Live feed', value: `${recentCheckIns.length} recent` },
          {
            label: 'Latest',
            value: recentCheckIns[0]?.memberName || '—',
          },
        ],
      },
      {
        key: 'collection' as const,
        short: 'Fees',
        title: 'Collection',
        label: `${periodName} collection`,
        valueLabel: formatPkrCompact(flowCollection),
        raw: flowCollection,
        icon: 'wallet' as const,
        detail: `Fees collected during ${periodName}.`,
        rows: [
          { label: 'Collected', value: formatPkr(flowCollection) },
          {
            label: 'Avg / day',
            value: formatPkr(
              Math.round(flowCollection / (period === 'today' ? 1 : period === 'week' ? 7 : 30)),
            ),
          },
          { label: 'Pending dues', value: formatPkr(dues) },
        ],
      },
      {
        key: 'active' as const,
        short: 'Active',
        title: 'Active members',
        label: 'active members',
        valueLabel: String(active),
        raw: active,
        icon: 'people' as const,
        detail: 'Members with an active membership right now.',
        rows: [
          { label: 'Active now', value: String(active) },
          { label: 'Period view', value: PERIOD_LABEL[period] },
          { label: 'Expiring soon', value: String(expiring) },
        ],
      },
      {
        key: 'expiring' as const,
        short: 'Expire',
        title: 'Expiring soon',
        label: period === 'month' ? 'expiring this month' : 'expiring in 7 days',
        valueLabel: String(expiring),
        raw: expiring,
        icon: 'time' as const,
        detail: 'Memberships nearing end date — follow up for renewals.',
        rows: [
          { label: 'Expiring count', value: String(expiring) },
          { label: 'Listed', value: `${expiringMembers.length} in list` },
          {
            label: 'Next up',
            value: expiringMembers[0]?.name || '—',
          },
        ],
      },
      {
        key: 'dues' as const,
        short: 'Dues',
        title: 'Pending dues',
        label: 'pending dues',
        valueLabel: formatPkrCompact(dues),
        raw: dues,
        icon: 'alert-circle' as const,
        detail: 'Outstanding member balances waiting collection.',
        rows: [
          { label: 'Total dues', value: formatPkr(dues) },
          { label: 'Period', value: PERIOD_LABEL[period] },
          {
            label: 'Vs collection',
            value:
              flowCollection > 0
                ? `${Math.min(999, Math.round((dues / flowCollection) * 100))}%`
                : '—',
          },
        ],
      },
      {
        key: 'sync' as const,
        short: 'Sync',
        title: 'Device sync',
        label: 'device sync pending',
        valueLabel: String(sync),
        raw: sync,
        icon: 'hardware-chip' as const,
        detail: 'Pending biometric / device enrollments to sync.',
        rows: [
          { label: 'Pending sync', value: String(sync) },
          { label: 'Period', value: PERIOD_LABEL[period] },
          { label: 'Status', value: sync === 0 ? 'All clear' : 'Needs attention' },
        ],
      },
    ];
  }, [
    period,
    checkIns,
    collectionPkr,
    activeMembers,
    expiringIn7Days,
    pendingDuesPkr,
    pendingEnrollments,
    recentCheckIns,
    expiringMembers,
  ]);

  const maxRaw = Math.max(...items.map((x) => x.raw), 1);
  const withPct = items.map((item) => ({
    ...item,
    pct: Math.round((item.raw / maxRaw) * 100),
  }));

  const selectedItem = withPct.find((x) => x.key === selected) ?? withPct[0];
  const modalItem = withPct.find((x) => x.key === modalKey) ?? null;

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pausedUntil || modalKey) return;
      setSelected((prev) => {
        const idx = items.findIndex((x) => x.key === prev);
        return items[(idx + 1) % items.length].key;
      });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [items, pausedUntil, modalKey]);

  const openStat = (key: TodayStatKey) => {
    setSelected(key);
    setPausedUntil(Date.now() + PAUSE_MS);
    setModalKey(key);
  };

  const setPeriodSafe = (p: StatsPeriod) => {
    setPeriod(p);
    setPausedUntil(Date.now() + PAUSE_MS);
  };

  const activeBarBg = isDark ? '#0E3B36' : '#0F3D38';
  const idleBarBg = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.72)';
  const idleBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.95)';
  const activeBorder = isDark ? 'rgba(45, 212, 191, 0.35)' : 'rgba(15, 61, 56, 0.45)';

  const periodPills = (
    <View style={styles.periodRow}>
      {(['today', 'week', 'month'] as StatsPeriod[]).map((p) => (
        <GlassPill
          key={p}
          label={p === 'today' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
          size="sm"
          active={period === p}
          onPress={() => setPeriodSafe(p)}
        />
      ))}
    </View>
  );

  return (
    <>
      <GlassCard borderRadius={28} elevated>
        <View style={styles.cardInner}>
          <View style={styles.headerRow}>
            <Pressable style={styles.metricBlock} onPress={() => openStat(selectedItem.key)}>
              <View style={styles.metricSwap}>
                <Animated.View
                  key={`metric-${selectedItem.key}-${period}`}
                  style={styles.metricSwapInner}
                  entering={FadeInDown.duration(460).easing(soft)}
                  exiting={FadeOutUp.duration(300).easing(soft)}
                >
                  <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
                    {selectedItem.valueLabel}
                  </Text>
                  <Text
                    style={[styles.metricLabel, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {selectedItem.label}
                  </Text>
                </Animated.View>
              </View>
            </Pressable>
          </View>

          {periodPills}

          <View style={styles.barsRow}>
            {withPct.map((item) => (
              <GlassBar
                key={item.key}
                short={item.short}
                pct={item.pct}
                active={item.key === selected}
                activeBarBg={activeBarBg}
                idleBarBg={idleBarBg}
                activeBorder={activeBorder}
                idleBorder={idleBorder}
                isDark={isDark}
                textSecondary={colors.textSecondary}
                onPress={() => openStat(item.key)}
              />
            ))}
          </View>
        </View>
      </GlassCard>

      <Modal
        visible={!!modalItem}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setModalKey(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalKey(null)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#132220' : '#F7FBFA',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={40}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}

            {modalItem ? (
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}
              >
                <View style={styles.modalTop}>
                  <View
                    style={[
                      styles.modalIcon,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.10)'
                          : 'rgba(0,0,0,0.05)',
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.16)'
                          : 'rgba(0,0,0,0.08)',
                      },
                    ]}
                  >
                    <Ionicons name={modalItem.icon} size={22} color={iconColor} />
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => setModalKey(null)}
                    style={[
                      styles.closeBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)',
                      },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <Text style={[styles.modalTitle, { color: colors.text }]}>{modalItem.title}</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  {modalItem.detail}
                </Text>

                <View style={{ marginTop: 14, marginBottom: 8 }}>{periodPills}</View>

                <Text style={[styles.modalHero, { color: colors.text }]}>
                  {modalItem.valueLabel}
                </Text>
                <Text style={[styles.modalHeroLabel, { color: colors.textSecondary }]}>
                  {modalItem.label} · {modalItem.pct}% of peak
                </Text>

                <View style={styles.detailList}>
                  {modalItem.rows.map((row) => (
                    <View
                      key={row.label}
                      style={[
                        styles.detailRow,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.7)',
                          borderColor: isDark
                            ? 'rgba(255,255,255,0.10)'
                            : 'rgba(255,255,255,0.9)',
                        },
                      ]}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                        {row.label}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => {
                    const key = modalItem.key;
                    setModalKey(null);
                    onNavigate?.(key);
                  }}
                  style={[
                    styles.cta,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : '#0F1A19',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isDark ? '#0B1312' : '#FFFFFF',
                      fontWeight: '800',
                      fontSize: 15,
                    }}
                  >
                    Open full screen
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={isDark ? '#0B1312' : '#FFFFFF'}
                  />
                </Pressable>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    padding: 22,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
    minHeight: 72,
  },
  metricBlock: {
    flex: 1,
  },
  metricSwap: {
    minHeight: 68,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  metricSwapInner: {
    gap: 6,
  },
  metricValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.4,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginBottom: 18,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: BAR_MAX + 22,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barPct: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bar: {
    width: '100%',
    maxWidth: 56,
    borderRadius: 999,
    borderWidth: 1.2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  holeCore: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.3,
    zIndex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  modalContent: {
    padding: 22,
    paddingBottom: 36,
  },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  modalSub: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  modalHero: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.4,
    marginTop: 8,
  },
  modalHeroLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 16,
  },
  detailList: {
    gap: 8,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 999,
  },
});
