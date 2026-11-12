import React from 'react';
import { Pressable, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** plain = no bg (default). glass = clear liquid glass rim (no white fill). */
  variant?: 'plain' | 'glass';
};

export function GlassIconButton({
  name,
  onPress,
  size = 40,
  style,
  accessibilityLabel,
  variant = 'plain',
}: Props) {
  const { isDark } = useTheme();
  const iconColor = isDark ? '#FFFFFF' : '#0F1A19';
  const isGlass = variant === 'glass';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={isGlass ? 6 : 8}
      style={({ pressed }) => [
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pressed ? (isGlass ? 0.78 : 0.45) : 1,
          backgroundColor: 'transparent',
          borderWidth: isGlass ? 1.2 : 0,
          borderColor: isGlass
            ? isDark
              ? 'rgba(255, 255, 255, 0.32)'
              : 'rgba(255, 255, 255, 0.45)'
            : 'transparent',
          shadowOpacity: isGlass ? 0.14 : 0,
          elevation: isGlass ? 2 : 0,
        },
        style,
      ]}
    >
      {isGlass && Platform.OS === 'ios' ? (
        <BlurView
          intensity={28}
          tint={isDark ? 'dark' : 'default'}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
        />
      ) : null}
      {isGlass ? (
        <LinearGradient
          colors={[
            isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)',
            'transparent',
            'transparent',
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <Ionicons name={name} size={Math.round(size * (isGlass ? 0.42 : 0.55))} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
});
