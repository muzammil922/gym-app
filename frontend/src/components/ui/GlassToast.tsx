import React, { useEffect, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

type Tone = 'success' | 'error' | 'info' | 'warning';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Default 2500 */
  durationMs?: number;
  onHide?: () => void;
};

const TONE_ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

export function GlassToast({
  visible,
  title,
  message,
  tone = 'success',
  icon,
  durationMs = 2500,
  onHide,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDismissedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const finishHide = () => {
    if (isDismissedRef.current) return;
    isDismissedRef.current = true;
    onHideRef.current?.();
  };

  const startAutoDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(finishHide)();
      });
    }, durationMs);
  };

  useEffect(() => {
    isDismissedRef.current = false;
    translateX.value = 0;
    translateY.value = 0;

    if (!visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      progress.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      return;
    }

    progress.value = withSpring(1, { damping: 16, stiffness: 180 });
    startAutoDismiss();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, durationMs, progress]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.value = gestureState.dx;
        translateY.value = gestureState.dy < 0 ? gestureState.dy : gestureState.dy * 0.25;
      },
      onPanResponderRelease: (_, gestureState) => {
        // Swipe UP to dismiss
        if (gestureState.dy < -25 || gestureState.vy < -0.4) {
          translateY.value = withTiming(-120, { duration: 150 }, (done) => {
            if (done) runOnJS(finishHide)();
          });
          return;
        }
        // Swipe Left or Right to dismiss
        if (Math.abs(gestureState.dx) > 60 || Math.abs(gestureState.vx) > 0.4) {
          const dest = gestureState.dx > 0 ? 400 : -400;
          translateX.value = withTiming(dest, { duration: 150 }, (done) => {
            if (done) runOnJS(finishHide)();
          });
          return;
        }
        // Simple tap to dismiss
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          translateY.value = withTiming(-100, { duration: 150 }, (done) => {
            if (done) runOnJS(finishHide)();
          });
          return;
        }
        // Otherwise spring back into place and resume timer
        translateX.value = withSpring(0, { damping: 15, stiffness: 260 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 260 });
        startAutoDismiss();
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(0, { damping: 15, stiffness: 260 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 260 });
        startAutoDismiss();
      },
    }),
  ).current;

  const animStyle = useAnimatedStyle(() => {
    const fadeOut = Math.max(0, 1 - Math.abs(translateX.value) / 250);
    return {
      opacity: progress.value * fadeOut,
      transform: [
        { translateY: (1 - progress.value) * -28 + translateY.value },
        { translateX: translateX.value },
        { scale: 0.96 + progress.value * 0.04 },
      ],
    };
  });

  if (!visible) return null;

  const iconName = icon || TONE_ICON[tone];
  const iconColor =
    tone === 'success'
      ? isDark
        ? '#2DD4BF'
        : '#0F766E'
      : tone === 'error'
        ? '#EF4444'
        : tone === 'warning'
          ? '#F59E0B'
          : colors.text;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
      <Animated.View
        pointerEvents="auto"
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          animStyle,
          {
            backgroundColor: isDark
              ? 'rgba(19, 34, 32, 0.95)'
              : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.08)',
            borderTopColor: isDark
              ? 'rgba(255, 255, 255, 0.40)'
              : 'rgba(255, 255, 255, 0.98)',
            shadowOpacity: isDark ? 0.55 : 0.18,
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={65}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']
              : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.25)', 'transparent']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                tone === 'success'
                  ? isDark
                    ? 'rgba(45,212,191,0.18)'
                    : 'rgba(15,118,110,0.12)'
                  : tone === 'error'
                    ? 'rgba(239,68,68,0.16)'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,26,25,0.06)',
            },
          ]}
        >
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 420,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1.2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '500',
  },
});
