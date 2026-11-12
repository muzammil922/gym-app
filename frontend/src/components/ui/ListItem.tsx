import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  danger?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  pill?: boolean;
};

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  danger,
  icon,
  iconColor,
  pill = false,
}: Props) {
  const { colors, isDark, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderRadius: pill ? 999 : 20,
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.70)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.60)',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.90)',
          opacity: pressed ? 0.75 : 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {/* Specular Rim Light */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.10)', 'transparent']
            : ['rgba(255, 255, 255, 0.35)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.8 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isDark
                ? (iconColor || colors.primary) + '22'
                : (iconColor || colors.primary) + '15',
              borderColor: (iconColor || colors.primary) + '35',
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={iconColor || colors.primary} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: danger ? colors.danger : colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>

      {right ? (
        <Text style={[styles.right, { color: colors.textSecondary }]}>{right}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderBottomWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 56,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, marginTop: 2, letterSpacing: -0.1 },
  right: { fontSize: 14, fontWeight: '600', marginStart: 8 },
});
