import React from 'react';
import { StyleSheet, Text, View, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

export type BadgeVariant =
  | 'active'
  | 'expired'
  | 'frozen'
  | 'pending'
  | 'neutral'
  | 'valid'
  | 'unpaid'
  | 'check_in'
  | 'check_out'
  | 'leave'
  | 'absent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

type Props = {
  label: string;
  variant?: BadgeVariant | (string & {});
  style?: ViewStyle;
  size?: 'sm' | 'md';
};

export function Badge({ label, variant = 'neutral', style, size = 'md' }: Props) {
  const { colors, isDark } = useTheme();

  const getTone = () => {
    switch (variant) {
      case 'active':
      case 'valid':
      case 'check_in':
      case 'success':
        return colors.success;
      case 'expired':
      case 'unpaid':
      case 'absent':
      case 'danger':
        return colors.danger;
      case 'frozen':
      case 'pending':
      case 'leave':
      case 'warning':
        return colors.warning;
      case 'check_out':
      case 'info':
        return colors.info;
      case 'neutral':
      default:
        return isDark ? '#FFFFFF' : '#0F1A19';
    }
  };

  const tone = getTone();
  const isSm = size === 'sm';
  const isNeutral = variant === 'neutral';

  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: 999,
          paddingHorizontal: isSm ? 10 : 12,
          paddingVertical: isSm ? 4 : 6,
          backgroundColor: isDark
            ? isNeutral
              ? 'rgba(255, 255, 255, 0.08)'
              : `${tone}22`
            : isNeutral
              ? 'rgba(255, 255, 255, 0.55)'
              : `${tone}18`,
          borderColor: isDark
            ? isNeutral
              ? 'rgba(255, 255, 255, 0.16)'
              : `${tone}55`
            : isNeutral
              ? 'rgba(255, 255, 255, 0.75)'
              : `${tone}40`,
          borderTopColor: isDark
            ? 'rgba(255, 255, 255, 0.32)'
            : 'rgba(255, 255, 255, 0.95)',
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={36}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'transparent']
            : ['rgba(255, 255, 255, 0.70)', 'rgba(255, 255, 255, 0.12)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.85 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Text
        style={[
          styles.text,
          {
            color: isNeutral ? (isDark ? '#FFFFFF' : '#0F1A19') : tone,
            fontSize: isSm ? 11 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.2,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
    zIndex: 1,
  },
});
