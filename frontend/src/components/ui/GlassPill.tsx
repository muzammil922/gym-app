import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { CausticColor } from './GlassCard';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  caustic?: CausticColor;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassPill({
  label,
  active = false,
  onPress,
  icon,
  rightElement,
  style,
  size = 'md',
}: Props) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  const heights = { sm: 34, md: 42, lg: 48 };
  const fontSizes = { sm: 12, md: 14, lg: 15 };
  const paddingsH = { sm: 14, md: 18, lg: 22 };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animatedStyle,
        styles.outer,
        {
          minHeight: heights[size],
          borderRadius: 999,
          paddingHorizontal: paddingsH[size],
          backgroundColor: active
            ? isDark
              ? '#FFFFFF'
              : '#0F1A19'
            : isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.05)',
          borderColor: active
            ? isDark
              ? '#FFFFFF'
              : '#0F1A19'
            : isDark
              ? 'rgba(255, 255, 255, 0.16)'
              : 'rgba(0, 0, 0, 0.10)',
          borderTopColor: active
            ? isDark
              ? '#FFFFFF'
              : '#0F1A19'
            : isDark
              ? 'rgba(255, 255, 255, 0.32)'
              : 'rgba(0, 0, 0, 0.15)',
        },
        style,
      ]}
    >
      {/* Specular sheen when inactive */}
      {!active ? (
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.02)', 'transparent']
              : ['rgba(255, 255, 255, 0.60)', 'rgba(255, 255, 255, 0.10)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.8 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.content}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              fontSize: fontSizes[size],
              color: active
                ? isDark
                  ? '#0B1312'
                  : '#FFFFFF'
                : isDark
                  ? '#FFFFFF'
                  : '#0F1A19',
              fontWeight: active ? '700' : '600',
            },
          ]}
        >
          {label}
        </Text>
        {rightElement ? <View style={styles.rightSlot}>{rightElement}</View> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    marginLeft: 6,
  },
  label: {
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});
