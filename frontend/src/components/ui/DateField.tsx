import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  label?: string;
  value: string;
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
};

function toIso(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function parseValue(value: string): Date | null {
  if (!value || value.length < 8) return null;
  const d = parseISO(value.length === 10 ? value : value.slice(0, 10));
  return isValid(d) ? d : null;
}

/** Allow typing digits and dashes, auto-insert dashes for YYYY-MM-DD */
function maskDateInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder = 'YYYY-MM-DD',
  maximumDate,
  minimumDate,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseValue(value) || new Date());

  const parsed = useMemo(() => parseValue(value), [value]);

  const borderColor = error
    ? colors.danger
    : focused
      ? isDark
        ? 'rgba(91, 74, 232, 0.8)'
        : colors.primary
      : isDark
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(255, 255, 255, 0.55)';

  const openPicker = () => {
    setDraft(parsed || new Date());
    setOpen(true);
  };

  const applyDate = (d: Date) => {
    onChange(toIso(d));
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) applyDate(selected);
      return;
    }
    if (selected) setDraft(selected);
  };

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: isDark
              ? focused
                ? 'rgba(255,255,255,0.10)'
                : 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.75)',
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(t) => onChange(maskDateInput(t))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={10}
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable onPress={openPicker} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          onChange={onPickerChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
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
                  backgroundColor: isDark ? '#15201E' : '#F4F7F6',
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
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
                    applyDate(draft);
                    setOpen(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
