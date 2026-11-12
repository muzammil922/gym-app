import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Button } from '@/src/components/ui/Button';

function SpinnerRing() {
  const { isDark } = useTheme();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0.85);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse, spin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }, { scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.spinnerOuter, ringStyle]}>
      <LinearGradient
        colors={
          isDark
            ? ['#FFFFFF', 'rgba(255,255,255,0.15)', 'transparent']
            : ['#0F1A19', 'rgba(15,26,25,0.2)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.spinnerGradient}
      />
      <View
        style={[
          styles.spinnerHole,
          { backgroundColor: isDark ? '#0F1A19' : '#F4F7F6' },
        ]}
      />
    </Animated.View>
  );
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.center}>
      <View
        style={[
          styles.loaderCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        <SpinnerRing />
        <Text style={[styles.loaderLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

export function EmptyView({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.text, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: 16, minWidth: 160 }} />
      ) : null}
    </Animated.View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.center}>
      <Text style={[styles.title, { color: colors.danger }]}>Something went wrong</Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {message || 'Please try again.'}
      </Text>
      {onRetry ? (
        <Button title="Retry" onPress={onRetry} style={{ marginTop: 16, minWidth: 140 }} />
      ) : null}
    </Animated.View>
  );
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View style={[styles.offline, { backgroundColor: colors.warning }]}>
      <Text style={styles.offlineText}>
        You are offline. Showing cached data when available.
      </Text>
    </View>
  );
}

function SkeletonRow({ index, height = 72 }: { index: number; height?: number }) {
  const { colors, isDark, radii } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withDelay(
      index * 80,
      withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [index, shimmer]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.35, 0.85]),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-6, 6]) }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(280)}
      style={[
        styles.skeletonRow,
        {
          height,
          borderRadius: radii.lg,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.skeleton,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['transparent', 'rgba(255,255,255,0.12)', 'transparent']
            : ['transparent', 'rgba(255,255,255,0.65)', 'transparent']
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 10, padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </View>
  );
}

/** Profile-style skeleton used while member/detail screens load */
export function SkeletonProfile() {
  const { isDark } = useTheme();
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{ width: 40, height: 40, marginBottom: 4 }}>
        <SkeletonRow index={0} height={40} />
      </View>
      <View
        style={[
          styles.profileSkeleton,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonRow index={1} height={18} />
            <SkeletonRow index={2} height={14} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <SkeletonRow index={3} height={44} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonRow index={4} height={44} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonRow index={5} height={44} />
          </View>
        </View>
      </View>
      <SkeletonRow index={6} height={54} />
      <SkeletonRow index={7} height={54} />
      <SkeletonRow index={8} height={54} />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active
          ? '#5B4AE8'
          : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.65)',
        borderWidth: 1.2,
        borderColor: active
          ? 'rgba(124, 108, 240, 0.8)'
          : isDark
            ? 'rgba(255, 255, 255, 0.15)'
            : 'rgba(255, 255, 255, 0.55)',
        borderTopColor: active
          ? 'rgba(255, 255, 255, 0.85)'
          : isDark
            ? 'rgba(255, 255, 255, 0.38)'
            : 'rgba(255, 255, 255, 0.95)',
        marginRight: 8,
        minHeight: 34,
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A',
          fontWeight: active ? '700' : '600',
          fontSize: 13,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 200,
  },
  loaderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 26,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    minWidth: 140,
  },
  loaderLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  spinnerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spinnerGradient: {
    ...StyleSheet.absoluteFill,
    borderRadius: 22,
  },
  spinnerHole: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  text: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  offline: { paddingVertical: 10, paddingHorizontal: 16 },
  offlineText: { color: '#000000', textAlign: 'center', fontWeight: '600', fontSize: 13 },
  skeletonRow: {
    overflow: 'hidden',
    width: '100%',
  },
  profileSkeleton: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
});
