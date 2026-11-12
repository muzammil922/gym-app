import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, CausticColor } from './GlassCard';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  caustic?: CausticColor;
  onPress?: () => void;
  style?: ViewStyle;
};

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  onPress,
  style,
}: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.outer, style]}>
      <GlassCard borderRadius={24} style={{ flex: 1 }}>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={({ pressed }) => [
            styles.cardInner,
            {
              opacity: pressed && onPress ? 0.8 : 1,
            },
          ]}
        >
          {/* Top Row: Label & Frosted Glass Circular Icon */}
          <View style={styles.topRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {label}
            </Text>
            {icon ? (
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.10)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.18)'
                      : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={16}
                  color={iconColor || (isDark ? '#FFFFFF' : '#0F1A19')}
                />
              </View>
            ) : null}
          </View>

          {/* Large Stat Metric Value */}
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    minWidth: 140,
    flex: 1,
  },
  cardInner: {
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 104,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
    letterSpacing: -0.2,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
});
