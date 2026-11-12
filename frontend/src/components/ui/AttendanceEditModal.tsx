import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Button } from '@/src/components/ui/Button';
import { Avatar } from '@/src/components/ui/Avatar';
import { LiquidGlassStatusRow } from '@/src/components/ui/LiquidGlassStatusRow';
import { formatDate, formatTime } from '@/src/utils/date';
import type { AttendanceRecord, AttendanceStatus } from '@/src/api/types';

export type AttendanceFormValues = {
  status: AttendanceStatus;
  direction: 'in' | 'out';
  checkedInAt: string;
  reason?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberPhotoUrl?: string;
  /** If provided, we are editing this existing attendance record */
  record?: AttendanceRecord | null;
  onSave: (values: AttendanceFormValues, recordId?: string) => Promise<void>;
  onDelete?: (recordId: string) => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
};

export function AttendanceEditModal({
  visible,
  onClose,
  memberName,
  memberPhotoUrl,
  record,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<AttendanceStatus>('check_in');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');

  // Picker visibility controls
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      if (record) {
        const s = (record.status || 'check_in') as AttendanceStatus;
        setStatus(s);
        setDirection(record.direction || (s === 'check_out' ? 'out' : 'in'));
        const d = new Date(record.checkedInAt);
        setSelectedDate(Number.isNaN(d.getTime()) ? new Date() : d);
        setReason(record.reason || '');
      } else {
        setStatus('check_in');
        setDirection('in');
        setSelectedDate(new Date());
        setReason('');
      }
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible, record]);

  const handleStatusSelect = (newStatus: AttendanceStatus) => {
    setStatus(newStatus);
    setDirection(newStatus === 'check_out' ? 'out' : 'in');
  };

  const handleDateChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (d && event.type !== 'dismissed') {
      const updated = new Date(selectedDate);
      updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(updated);
    }
  };

  const handleTimeChange = (event: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (d && event.type !== 'dismissed') {
      const updated = new Date(selectedDate);
      updated.setHours(d.getHours(), d.getMinutes(), 0, 0);
      setSelectedDate(updated);
    }
  };

  const handleSetToNow = () => {
    setSelectedDate(new Date());
  };

  const handleSubmit = async () => {
    await onSave(
      {
        status,
        direction,
        checkedInAt: selectedDate.toISOString(),
        reason: reason.trim() || undefined,
      },
      record?.id,
    );
  };

  const handleDelete = () => {
    if (!record || !onDelete) return;
    Alert.alert(
      'Delete Attendance?',
      'Are you sure you want to remove this attendance record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDelete(record.id);
          },
        },
      ],
    );
  };

  const isEditing = !!record;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.70)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#14201E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {/* Top Grab Handle */}
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.handle,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' },
              ]}
            />
          </View>

          {/* Sheet Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Avatar name={memberName} uri={memberPhotoUrl} size={38} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {isEditing ? 'Edit Attendance' : 'Mark Attendance'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {memberName}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons
                name="close"
                size={22}
                color={isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {/* Status Choices - Liquid Glass 1 Line */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
              SELECT STATUS
            </Text>
            <View style={{ marginBottom: 16 }}>
              <LiquidGlassStatusRow
                value={status}
                onChange={handleStatusSelect}
              />
            </View>

            {/* Date & Time Section */}
            <View style={styles.dateTimeHeader}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 0 }]}>
                DATE & TIME
              </Text>
              <Pressable
                onPress={handleSetToNow}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.nowBtn,
                  {
                    backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(15,118,110,0.10)',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={14} color={isDark ? '#2DD4BF' : '#0F766E'} />
                <Text style={[styles.nowText, { color: isDark ? '#2DD4BF' : '#0F766E' }]}>
                  Set to Now
                </Text>
              </Pressable>
            </View>

            <View style={styles.pickersRow}>
              {/* Date Box */}
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [
                  styles.pickerBox,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.08)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.pickerValue, { color: colors.text }]}>
                    {formatDate(selectedDate.toISOString())}
                  </Text>
                </View>
              </Pressable>

              {/* Time Box */}
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={({ pressed }) => [
                  styles.pickerBox,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.08)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="alarm-outline" size={18} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Time</Text>
                  <Text style={[styles.pickerValue, { color: colors.text }]}>
                    {formatTime(selectedDate.toISOString())}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* DateTimePickers */}
            {showDatePicker ? (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            ) : null}

            {showTimePicker ? (
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
            ) : null}

            {/* Reason / Note */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 14 }]}>
              REASON / NOTE (OPTIONAL)
            </Text>
            <View
              style={[
                styles.reasonBox,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Device miss, manual entry, permission"
                placeholderTextColor={colors.textTertiary}
                style={[styles.reasonInput, { color: colors.text }]}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsWrap}>
              <Button
                title={isEditing ? 'Save Changes' : 'Record Attendance'}
                variant="primary"
                fullWidth
                loading={isSaving}
                onPress={handleSubmit}
              />

              {isEditing && onDelete ? (
                <Button
                  title="Delete Record"
                  variant="danger"
                  fullWidth
                  loading={isDeleting}
                  onPress={handleDelete}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    marginBottom: 14,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  content: {
    paddingBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  dateTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nowText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  pickerLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  reasonBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reasonInput: {
    fontSize: 14,
    padding: 0,
  },
  actionsWrap: {
    marginTop: 20,
  },
});

