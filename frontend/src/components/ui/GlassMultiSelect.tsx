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

export type GlassMultiSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  /** Empty array means "no restriction" — every option is treated as selected. */
  values: string[];
  options: GlassMultiSelectOption[];
  onChange: (values: string[]) => void;
  /** Shown when every option is selected. */
  allLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  selectAllLabel?: string;
  clearAllLabel?: string;
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
 * Inline-expanding glass multi-select.
 *
 * Deliberately does NOT use a nested <Modal>: opening a second modal from
 * inside a parent modal sheet causes the parent to relayout and the field to
 * jump. Expanding in place keeps the submit screen stable on iOS and Android.
 */
export function GlassMultiSelect({
  label,
  placeholder = 'Select…',
  values,
  options,
  onChange,
  allLabel = 'All selected',
  searchable = false,
  searchPlaceholder = 'Search…',
  selectAllLabel = 'Select All',
  clearAllLabel = 'Clear All',
  maxListHeight = 280,
}: Props) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const allIds = useMemo(() => options.map((o) => o.value), [options]);
  const allSelected = options.length > 0 && values.length >= options.length;
  const selectedSet = useMemo(
    () => new Set(values.length === 0 ? allIds : values),
    [values, allIds],
  );

  const selectedLabels = useMemo(
    () => options.filter((o) => selectedSet.has(o.value)).map((o) => o.label),
    [options, selectedSet],
  );

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : allSelected
        ? allLabel
        : selectedLabels.join(', ');

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
  const fieldBorder = isDark
    ? 'rgba(255, 255, 255, 0.15)'
    : 'rgba(255, 255, 255, 0.55)';

  const accent = isDark ? '#2DD4BF' : '#0F766E';

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
    if (open) setQ('');
  };

  const emit = (next: string[]) => {
    // Full selection collapses to "no restriction" so it always matches all plans.
    onChange(next.length >= options.length ? [] : next);
  };

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    emit(allIds.filter((value) => next.has(value)));
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <Pressable
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        accessibilityValue={{ text: summary }}
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
              {
                color: selectedLabels.length ? colors.text : colors.textTertiary,
              },
            ]}
            numberOfLines={1}
          >
            {summary}
          </Text>
        </View>
        <View
          style={[
            styles.countPill,
            {
              backgroundColor: isDark
                ? 'rgba(45, 212, 191, 0.16)'
                : 'rgba(15, 118, 110, 0.10)',
              borderColor: isDark
                ? 'rgba(45, 212, 191, 0.4)'
                : 'rgba(15, 118, 110, 0.28)',
            },
          ]}
        >
          <Text style={[styles.countText, { color: accent }]}>
            {selectedLabels.length}/{options.length}
          </Text>
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

          <View style={styles.bulkRow}>
            <Text style={[styles.bulkCount, { color: colors.textSecondary }]}>
              {selectedLabels.length} of {options.length} plans
            </Text>
            <Pressable
              onPress={() => emit(allSelected ? [] : allIds)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.bulkBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(45, 212, 191, 0.16)'
                    : 'rgba(15, 118, 110, 0.10)',
                  borderColor: isDark
                    ? 'rgba(45, 212, 191, 0.45)'
                    : 'rgba(15, 118, 110, 0.30)',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={allSelected ? 'close-circle-outline' : 'checkmark-done-outline'}
                size={14}
                color={accent}
              />
              <Text style={[styles.bulkBtnText, { color: accent }]}>
                {allSelected ? clearAllLabel : selectAllLabel}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: maxListHeight }}
            bounces={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((opt) => {
              const active = selectedSet.has(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggle(opt.value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
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
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={21}
                    color={active ? accent : colors.textTertiary}
                  />
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
    fontSize: 15,
    fontWeight: '600',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
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
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  bulkCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  bulkBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
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
