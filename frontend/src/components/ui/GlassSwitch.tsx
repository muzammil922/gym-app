import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
};

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const PAD = 3;

/**
 * Liquid-glass switch — BlurView track, translucent teal when on,
 * specular sheen + rim matching GlassIconButton / FloatingTabBar chips.
 */
export function GlassSwitch({ value, onValueChange, disabled, style }: Props) {
  const { isDark } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, { damping: 18, stiffness: 320, mass: 0.7 });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [0, TRACK_W - THUMB - PAD * 2]),
      },
    ],
  }));

  const onFillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const offFillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));

  const rimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      isDark
        ? ['rgba(255,255,255,0.28)', 'rgba(94,234,212,0.55)']
        : ['rgba(255,255,255,0.65)', 'rgba(13,148,136,0.45)'],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={({ pressed }) => [
        styles.hit,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      <View
        style={[
          styles.track,
          {
            shadowOpacity: isDark ? 0.28 : 0.12,
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 32 : 40}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <BlurView
            intensity={isDark ? 44 : 52}
            tint={isDark ? 'dark' : 'light'}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Off glass fill */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            offFillStyle,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.42)',
            },
          ]}
        />

        {/* On teal glass fill */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            onFillStyle,
            {
              backgroundColor: isDark
                ? 'rgba(94, 234, 212, 0.42)'
                : 'rgba(13, 148, 136, 0.34)',
            },
          ]}
        />

        {/* Specular sheen */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']
              : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.18)', 'transparent']
          }
          locations={[0, 0.42, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Rim */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.rim, rimStyle]}
        />

        {/* Thumb */}
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={24}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.88)'
                  : 'rgba(255,255,255,0.95)',
              },
            ]}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.35)', 'transparent']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.thumbRim,
              {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.55)'
                  : 'rgba(255,255,255,0.9)',
              },
            ]}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  rim: {
    borderRadius: TRACK_H / 2,
    borderWidth: 1.2,
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  thumbRim: {
    borderRadius: THUMB / 2,
    borderWidth: 1,
  },
});
