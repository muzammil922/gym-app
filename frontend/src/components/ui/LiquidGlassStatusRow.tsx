import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { AttendanceStatus } from '@/src/api/types';

export type StatusOptionItem = {
  value: AttendanceStatus;
  label: string;
  color: string;
  accentDark: string;
  accentLight: string;
};

export const DEFAULT_ATTENDANCE_STATUSES: StatusOptionItem[] = [
  {
    value: 'check_in',
    label: 'Check In',
    color: '#10B981',
    accentDark: '#34D399',
    accentLight: '#047857',
  },
  {
    value: 'check_out',
    label: 'Check Out',
    color: '#06B6D4',
    accentDark: '#22D3EE',
    accentLight: '#0E7490',
  },
  {
    value: 'leave',
    label: 'Leave',
    color: '#F59E0B',
    accentDark: '#FBBF24',
    accentLight: '#B45309',
  },
  {
    value: 'absent',
    label: 'Absent',
    color: '#F43F5E',
    accentDark: '#FB7185',
    accentLight: '#BE123C',
  },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SinglePillProps = {
  item: StatusOptionItem;
  isSelected: boolean;
  onPress: () => void;
};

function StatusGlassPill({ item, isSelected, onPress }: SinglePillProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.pillOuter,
        animStyle,
        {
          backgroundColor: isSelected
            ? isDark
              ? `${item.color}2A`
              : `${item.color}1E`
            : isDark
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(255, 255, 255, 0.65)',
          borderColor: isSelected
            ? isDark
              ? `${item.color}80`
              : `${item.color}60`
            : isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(0, 0, 0, 0.08)',
          borderTopColor: isSelected
            ? isDark
              ? item.accentDark
              : item.color
            : isDark
              ? 'rgba(255, 255, 255, 0.30)'
              : 'rgba(255, 255, 255, 0.90)',
        },
      ]}
    >
      {/* iOS Frosted Glass Blur */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 28 : 45}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Liquid Caustic Specular Rim Gradient */}
      <LinearGradient
        colors={
          isSelected
            ? isDark
              ? [`${item.color}50`, `${item.color}12`, 'transparent']
              : [`${item.color}3E`, `${item.color}0A`, 'transparent']
            : isDark
              ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0.15)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.85 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Liquid Active Bottom Glow */}
      {isSelected ? (
        <LinearGradient
          colors={['transparent', isDark ? `${item.color}1C` : `${item.color}10`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {/* Clean text without icons */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.pillText,
          {
            color: isSelected
              ? isDark
                ? item.accentDark
                : item.accentLight
              : isDark
                ? '#E2E8F0'
                : '#334155',
            fontWeight: isSelected ? '700' : '600',
          },
        ]}
      >
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

type Props = {
  value: AttendanceStatus;
  onChange: (val: AttendanceStatus) => void;
  items?: StatusOptionItem[];
};

export function LiquidGlassStatusRow({
  value,
  onChange,
  items = DEFAULT_ATTENDANCE_STATUSES,
}: Props) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <StatusGlassPill
          key={item.value}
          item={item}
          isSelected={value === item.value}
          onPress={() => onChange(item.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  pillOuter: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 8,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  pillText: {
    fontSize: 12.5,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});

