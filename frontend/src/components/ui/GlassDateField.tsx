import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isValid, parseISO } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatDate } from '@/src/utils/date';

type Props = {
  label?: string;
  /** ISO yyyy-MM-dd for mode="date" (default), or HH:mm for mode="time" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Compact pill without label, for inline range rows */
  compact?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  mode?: 'date' | 'time';
};

function parseValue(value: string, mode: 'date' | 'time'): Date | null {
  if (!value) return null;
  if (mode === 'time') {
    const m = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!m) return null;
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  if (value.length < 8) return null;
  const d = parseISO(value.slice(0, 10));
  return isValid(d) ? d : null;
}

/**
 * Glass date field: tap → native picker.
 * No raw ISO text input, so the field always reads as a human date.
 */
export function GlassDateField({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  compact = false,
  icon,
  error,
  mode = 'date',
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseValue(value, mode) || new Date());

  const parsed = useMemo(() => parseValue(value, mode), [value, mode]);
  const resolvedPlaceholder = placeholder ?? (mode === 'time' ? 'Select time' : 'Select date');
  const display = parsed
    ? mode === 'time'
      ? formatDate(parsed, 'hh:mm a')
      : formatDate(parsed, compact ? 'dd MMM' : undefined)
    : resolvedPlaceholder;

  const openPicker = () => {
    setDraft(parsed || new Date());
    setOpen(true);
  };

  const apply = (d: Date) => {
    onChange(mode === 'time' ? format(d, 'HH:mm') : format(d, 'yyyy-MM-dd'));
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) apply(selected);
      return;
    }
    if (selected) setDraft(selected);
  };

  const fieldBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.75)';
  const fieldBorder = error
    ? colors.danger
    : isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(255, 255, 255, 0.55)';

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      {label && !compact ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${display}` : display}
        style={({ pressed }) => [
          styles.field,
          compact && styles.fieldCompact,
          {
            backgroundColor: fieldBg,
            borderColor: fieldBorder,
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
        <Ionicons
          name={icon ?? (mode === 'time' ? 'time-outline' : 'calendar-outline')}
          size={compact ? 14 : 16}
          color={parsed ? (isDark ? '#2DD4BF' : '#0F766E') : colors.textTertiary}
        />
        <Text
          style={[
            styles.value,
            compact && styles.valueCompact,
            { color: parsed ? colors.text : colors.textTertiary },
          ]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={15} color={colors.textSecondary} />
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          onChange={onPickerChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          is24Hour={false}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.iosBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            <View
              style={[
                styles.iosSheet,
                {
                  backgroundColor: isDark
                    ? 'rgba(19, 34, 32, 0.92)'
                    : 'rgba(255, 255, 255, 0.94)',
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.14)'
                    : 'rgba(0, 0, 0, 0.06)',
                  borderTopColor: isDark
                    ? 'rgba(255, 255, 255, 0.32)'
                    : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
            >
              <BlurView
                intensity={60}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'transparent']
                    : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.15)', 'transparent']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.8 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={styles.handle} />
              <View style={styles.iosHeader}>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                    Cancel
                  </Text>
                </Pressable>
                <Text style={[styles.iosTitle, { color: colors.text }]}>
                  {label || 'Select date'}
                </Text>
                <Pressable
                  onPress={() => {
                    apply(draft);
                    setOpen(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: isDark ? '#2DD4BF' : '#0F766E', fontWeight: '800', fontSize: 15 }}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                onChange={onPickerChange}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  wrapCompact: { flex: 1 },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: -0.08,
  },
  field: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  fieldCompact: {
    minHeight: 42,
    paddingHorizontal: 10,
    gap: 6,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  valueCompact: {
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    marginTop: 5,
    fontSize: 12,
  },
  iosBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iosSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.45)',
    marginBottom: 12,
  },
  iosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  iosTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
