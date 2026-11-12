import React, { useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Button } from './Button';

export type GlassDialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

type Tone = 'success' | 'error' | 'info' | 'warning';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  primaryAction?: GlassDialogAction;
  secondaryAction?: GlassDialogAction;
  onClose?: () => void;
  dismissible?: boolean;
  /** Auto-close after ms (e.g. 1000). Calls onAutoClose then onClose. */
  autoCloseMs?: number;
  onAutoClose?: () => void;
  /** Compact centered card (default) */
  size?: 'compact' | 'default';
};

const TONE_ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark',
  error: 'close',
  info: 'information',
  warning: 'alert',
};

export function GlassDialog({
  visible,
  title,
  message,
  tone = 'info',
  icon,
  primaryAction,
  secondaryAction,
  onClose,
  dismissible = true,
  autoCloseMs,
  onAutoClose,
  size = 'compact',
}: Props) {
  const { colors, isDark } = useTheme();
  const iconName = icon || TONE_ICON[tone];
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.92;
      opacity.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
  }, [visible, opacity, scale]);

  useEffect(() => {
    if (!visible || !autoCloseMs) return;
    const t = setTimeout(() => {
      onAutoClose?.();
      onClose?.();
    }, autoCloseMs);
    return () => clearTimeout(t);
  }, [visible, autoCloseMs, onAutoClose, onClose]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const close = () => {
    if (dismissible) onClose?.();
  };

  const run = (action?: GlassDialogAction) => {
    if (!action) return;
    action.onPress();
    onClose?.();
  };

  const core =
    tone === 'success'
      ? isDark
        ? '#2DD4BF'
        : '#0F766E'
      : tone === 'error'
        ? '#EF4444'
        : tone === 'warning'
          ? '#F59E0B'
          : isDark
            ? '#FFFFFF'
            : '#0F1A19';

  const soft =
    tone === 'success'
      ? isDark
        ? 'rgba(45, 212, 191, 0.18)'
        : 'rgba(15, 118, 110, 0.12)'
      : tone === 'error'
        ? 'rgba(239, 68, 68, 0.16)'
        : isDark
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(15,26,25,0.06)';

  const hasActions = !!(primaryAction || secondaryAction);
  const compact = size === 'compact';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(10, 18, 17, 0.48)' },
          ]}
          onPress={close}
        />

        <Animated.View
          style={[
            styles.card,
            compact && styles.cardCompact,
            cardStyle,
            {
              backgroundColor: isDark
                ? 'rgba(19, 34, 32, 0.95)'
                : 'rgba(255, 255, 255, 0.96)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.08)',
              borderTopColor: isDark
                ? 'rgba(255, 255, 255, 0.40)'
                : 'rgba(255, 255, 255, 0.98)',
              shadowOpacity: isDark ? 0.60 : 0.18,
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
                ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'transparent']
                : ['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.2)', 'transparent']
            }
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {tone === 'success' ? (
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(45,212,191,0.18)', 'transparent']
                  : ['rgba(45,212,191,0.22)', 'transparent']
              }
              style={styles.toneWash}
              pointerEvents="none"
            />
          ) : null}

          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: soft,
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.8)',
              },
            ]}
          >
            <Ionicons name={iconName} size={compact ? 26 : 30} color={core} />
          </View>

          <Text style={[styles.title, compact && styles.titleCompact, { color: colors.text }]}>
            {title}
          </Text>
          {message ? (
            <Text
              style={[styles.message, compact && styles.messageCompact, { color: colors.textSecondary }]}
            >
              {message}
            </Text>
          ) : null}

          {hasActions ? (
            <View style={styles.actions}>
              {primaryAction && secondaryAction ? (
                <View style={styles.actionRow}>
                  <View style={styles.actionFlex}>
                    <Button
                      title={secondaryAction.label}
                      variant={secondaryAction.variant || 'secondary'}
                      fullWidth
                      size="sm"
                      onPress={() => run(secondaryAction)}
                    />
                  </View>
                  <View style={styles.actionFlex}>
                    <Button
                      title={primaryAction.label}
                      variant={primaryAction.variant || 'primary'}
                      fullWidth
                      size="sm"
                      onPress={() => run(primaryAction)}
                    />
                  </View>
                </View>
              ) : primaryAction ? (
                <Button
                  title={primaryAction.label}
                  variant={primaryAction.variant || 'primary'}
                  fullWidth
                  size="sm"
                  onPress={() => run(primaryAction)}
                />
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 1.2,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 28,
    elevation: 16,
  },
  cardCompact: {
    maxWidth: 300,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  toneWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 18,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    marginTop: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionFlex: {
    flex: 1,
  },
});
