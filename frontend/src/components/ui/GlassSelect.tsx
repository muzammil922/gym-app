import React, { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

export type GlassSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  value?: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  error?: string;
  /** Show search field with search icon inside the panel */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Max height of the open option list */
  maxListHeight?: number;
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  // Legacy-arch only. On the New Architecture this is a no-op and logs a warning.
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // ignore
  }
}

/**
 * Inline-expanding glass select.
 *
 * Deliberately does NOT use a nested <Modal>: opening a second modal from
 * inside a parent modal sheet causes the parent to relayout and the field to
 * jump. Expanding in place keeps the submit screen stable on iOS and Android.
 */
export function GlassSelect({
  label,
  placeholder = 'Select…',
  value,
  options,
  onChange,
  error,
  searchable = false,
  searchPlaceholder = 'Search…',
  maxListHeight = 280,
}: Props) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        (o.hint || '').toLowerCase().includes(needle),
    );
  }, [options, q]);

  const fieldBg = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(255, 255, 255, 0.75)';
  const fieldBorder = error
    ? colors.danger
    : isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(255, 255, 255, 0.55)';

  const accent = isDark ? '#2DD4BF' : '#0F766E';

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
    if (open) setQ('');
  };

  const pick = (next: string) => {
    onChange(next);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(false);
    setQ('');
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label || placeholder }}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: fieldBg,
            borderColor: open ? accent : fieldBorder,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255, 255, 255, 0.14)', 'transparent']
              : ['rgba(255, 255, 255, 0.40)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.value,
              { color: selected ? colors.text : colors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {selected?.label || placeholder}
          </Text>
          {selected?.hint ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={1}>
              {selected.hint}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(255, 255, 255, 0.85)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.10)', 'transparent']
                : ['rgba(255,255,255,0.60)', 'transparent']
            }
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {searchable ? (
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.85)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(15,26,25,0.08)',
                },
              ]}
            >
              <Ionicons name="search" size={17} color={colors.textSecondary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.text }]}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            style={{ maxHeight: maxListHeight }}
            bounces={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => pick(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={opt.label}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: active
                        ? isDark
                          ? 'rgba(45, 212, 191, 0.16)'
                          : 'rgba(15, 118, 110, 0.10)'
                        : pressed
                          ? isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)'
                          : 'transparent',
                      borderColor: active
                        ? isDark
                          ? 'rgba(45, 212, 191, 0.55)'
                          : 'rgba(15, 118, 110, 0.40)'
                        : 'transparent',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: colors.text,
                          fontWeight: active ? '800' : '600',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.hint ? (
                      <Text style={[styles.optionHint, { color: colors.textSecondary }]}>
                        {opt.hint}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={19} color={accent} />
                  ) : null}
                </Pressable>
              );
            })}
            {!filtered.length ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                No results
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: -0.08,
  },
  field: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  error: {
    marginTop: 5,
    fontSize: 12,
  },
  panel: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 15,
  },
  optionHint: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
    fontWeight: '600',
  },
});
