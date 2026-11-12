import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'tinted' | 'glass';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  fullWidth?: boolean;
  pill?: boolean;
  icon?: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  style,
  fullWidth,
  pill = true,
  icon,
}: Props) {
  const { colors, isDark } = useTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 350 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  const heights: Record<Size, number> = { sm: 38, md: 50, lg: 54 };
  const fontSizes: Record<Size, number> = { sm: 13, md: 16, lg: 17 };
  const fontWeights: Record<Size, '600' | '700'> = { sm: '600', md: '700', lg: '700' };
  const paddingH: Record<Size, number> = { sm: 16, md: 24, lg: 28 };
  const radius = pill ? 999 : 16;

  // Liquid Glass Button styles based on Image 1 showcase
  if (variant === 'primary' || variant === 'glass') {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          animatedStyle,
          styles.liquidContainer,
          {
            borderRadius: radius,
            alignSelf: fullWidth ? 'stretch' : 'auto',
            opacity: isDisabled ? 0.45 : 1,
            shadowColor: '#5B4AE8',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 14,
            elevation: 8,
          },
          style,
        ]}
      >
        {/* Soft Ambient Caustic Underneath */}
        <View
          style={[
            styles.causticUnderlay,
            {
              borderRadius: radius + 4,
              backgroundColor: 'rgba(91, 74, 232, 0.35)',
            },
          ]}
        />

        {/* Glossy Glass Button Body */}
        <LinearGradient
          colors={
            isDark
              ? ['#5B4AE8', '#4538C8', '#3125A2']
              : ['#6D5DF6', '#5B4AE8', '#4538C8']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.base,
            {
              minHeight: heights[size],
              borderRadius: radius,
              paddingHorizontal: paddingH[size],
              borderColor: 'rgba(255, 255, 255, 0.25)',
              borderTopColor: 'rgba(255, 255, 255, 0.65)',
              borderWidth: 1.2,
            },
          ]}
        >
          {/* Top Specular Curved Highlight */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.40)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.contentRow}>
              {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
              <Text
                style={[
                  styles.label,
                  {
                    color: '#FFFFFF',
                    fontSize: fontSizes[size],
                    fontWeight: fontWeights[size],
                  },
                ]}
              >
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  // Secondary/Ghost/Danger variants with glass styling
  const bg =
    variant === 'danger'
      ? colors.danger
      : variant === 'tinted'
        ? isDark
          ? 'rgba(91, 74, 232, 0.22)'
          : 'rgba(91, 74, 232, 0.12)'
        : variant === 'secondary'
          ? isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.75)'
          : 'transparent';

  const textColor =
    variant === 'danger'
      ? '#FFFFFF'
      : variant === 'tinted'
        ? colors.primary
        : colors.text;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        animatedStyle,
        styles.base,
        {
          minHeight: heights[size],
          borderRadius: radius,
          backgroundColor: bg,
          opacity: isDisabled ? 0.45 : 1,
          borderWidth: 1.2,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.55)',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.90)',
          paddingHorizontal: paddingH[size],
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: fontSizes[size],
                fontWeight: fontWeights[size],
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  liquidContainer: {
    position: 'relative',
  },
  causticUnderlay: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: -2,
    right: -2,
    opacity: 0.8,
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: -0.3,
  },
});
