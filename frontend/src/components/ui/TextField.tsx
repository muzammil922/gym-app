import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  pill?: boolean;
};

export function TextField({
  label,
  error,
  helper,
  icon,
  pill = false,
  style,
  secureTextEntry,
  ...rest
}: Props) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  const radius = pill ? 999 : 18;

  const borderColor = error
    ? colors.danger
    : focused
      ? isDark
        ? 'rgba(91, 74, 232, 0.8)'
        : colors.primary
      : isDark
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(255, 255, 255, 0.55)';

  const borderTopColor = error
    ? colors.danger
    : focused
      ? '#7C6CF0'
      : isDark
        ? 'rgba(255, 255, 255, 0.35)'
        : 'rgba(255, 255, 255, 0.85)';

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.glassInputWrap,
          {
            borderRadius: radius,
            borderColor,
            borderTopColor,
            backgroundColor: isDark
              ? focused
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(255, 255, 255, 0.06)'
              : 'rgba(255, 255, 255, 0.75)',
            borderWidth: 1.2,
          },
        ]}
      >
        {/* Specular Rim Light */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.14)', 'transparent']
              : ['rgba(255, 255, 255, 0.40)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.8 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={colors.textSecondary}
            style={{ marginLeft: 14 }}
          />
        ) : null}

        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: 16,
              paddingLeft: icon ? 8 : 16,
            },
            style,
          ]}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            style={styles.eyeBtn}
            hitSlop={8}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={19}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '500', letterSpacing: -0.08 },
  glassInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontWeight: '400',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hint: {
    marginTop: 5,
    fontSize: 12,
    letterSpacing: 0,
  },
});
