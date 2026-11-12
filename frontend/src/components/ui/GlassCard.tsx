import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

export type CausticColor = 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose' | 'none';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  caustic?: CausticColor;
  intensity?: number;
  borderRadius?: number;
  elevated?: boolean;
};

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity = 40,
  borderRadius = 24,
  elevated = false,
}: Props) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.outerContainer, style]}>
      {/* Main Frosted Glass Shell */}
      <View
        style={[
          styles.glassShell,
          {
            borderRadius,
            backgroundColor: isDark
              ? elevated
                ? 'rgba(255, 255, 255, 0.09)'
                : 'rgba(255, 255, 255, 0.055)'
              : elevated
                ? 'rgba(255, 255, 255, 0.92)'
                : 'rgba(255, 255, 255, 0.75)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(255, 255, 255, 0.6)',
            borderTopColor: isDark
              ? 'rgba(255, 255, 255, 0.28)'
              : 'rgba(255, 255, 255, 0.95)',
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={intensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Specular Rim Light Gradient (Subtle white gloss only) */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.01)', 'transparent']
              : ['rgba(255, 255, 255, 0.50)', 'rgba(255, 255, 255, 0.08)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Card Content */}
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  glassShell: {
    overflow: 'hidden',
    borderWidth: 1.2,
    position: 'relative',
  },
});
