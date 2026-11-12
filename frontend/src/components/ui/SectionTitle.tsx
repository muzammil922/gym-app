import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  title: string;
  actionText?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export function SectionTitle({ title, actionText, onAction, style }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.wrap, { marginTop: spacing.xl, marginBottom: spacing.sm }, style]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        {title.toUpperCase()}
      </Text>
      {actionText && onAction ? (
        <Pressable hitSlop={8} onPress={onAction}>
          <Text style={[styles.action, { color: colors.primary }]}>
            {actionText}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
  },
});

