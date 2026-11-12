import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { Button } from '@/src/components/ui/Button';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSelect } from '@/src/components/ui/GlassSelect';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { DateField } from '@/src/components/ui/DateField';
import { GlassDialog } from '@/src/components/ui/GlassDialog';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { ErrorView, LoadingView } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToastStore } from '@/src/store/toast-store';
import { membersApi, staffApi } from '@/src/api/endpoints';
import { editMemberSchema, EditMemberForm } from '@/src/features/members/schemas';

function StepHeader({ step, title }: { step: number; title: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.stepHeader}>
      <View
        style={[
          styles.stepBadge,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,26,25,0.08)',
            borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,26,25,0.08)',
          },
        ]}
      >
        <Text style={[styles.stepNum, { color: colors.text }]}>{step}</Text>
      </View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function onlyDigits(value: string, max = 11) {
  return value.replace(/\D/g, '').slice(0, max);
}

export default function EditMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const tabPad = useFloatingTabBarPad();
  const { colors, spacing, isDark } = useTheme();
  const qc = useQueryClient();
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [initialPhotoUri, setInitialPhotoUri] = useState<string | undefined>();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);
  const pendingRepeat = useRef<(() => void) | null>(null);
  const showToast = useToastStore((s) => s.show);
  const iconColor = isDark ? '#FFFFFF' : '#0F1A19';

  const memberQ = useQuery({
    queryKey: ['member', id],
    queryFn: () => membersApi.get(id!),
    enabled: !!id,
  });
  const staffQ = useQuery({
    queryKey: ['staff', 'all'],
    queryFn: async () => (await staffApi.list({ pageSize: 100 })).items,
  });

  const form = useForm<EditMemberForm>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      name: '',
      phone: '',
      whatsappPhone: '',
      gender: 'male',
      dateOfBirth: '1998-01-01',
      whatsappOptIn: true,
    },
  });

  const gender = form.watch('gender');
  const trainerId = form.watch('trainerId');
  const memberName = form.watch('name');

  useEffect(() => {
    const m = memberQ.data;
    if (!m) return;
    form.reset({
      name: m.name,
      phone: m.phone,
      whatsappPhone: m.whatsappPhone,
      gender: m.gender,
      dateOfBirth: m.dateOfBirth,
      trainerId: m.trainerId,
      whatsappOptIn: m.whatsappOptIn,
    });
    setPhotoUri(m.photoUrl);
    setInitialPhotoUri(m.photoUrl);
  }, [memberQ.data, form]);

  const isDirty = form.formState.isDirty || photoUri !== initialPhotoUri;
  const disablePreventionRef = useRef<() => void>(() => {});

  const disablePrevention = usePreventRemove(isDirty && !allowLeave, ({ repeat }) => {
    pendingRepeat.current = repeat;
    setLeaveOpen(true);
  });
  disablePreventionRef.current = disablePrevention;

  const mutation = useMutation({
    mutationFn: (data: EditMemberForm) =>
      membersApi.update(id!, {
        ...data,
        photoUri,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['member', id] });
      await qc.invalidateQueries({ queryKey: ['members'] });
      setAllowLeave(true);
      disablePreventionRef.current();
      showToast({
        tone: 'success',
        title: 'Changes saved',
        message: 'Profile updated',
      });
      router.back();
    },
    onError: (e: Error) => {
      showToast({
        tone: 'error',
        title: 'Save failed',
        message: e.message || 'Please try again',
      });
    },
  });

  const save = useCallback(() => {
    form.handleSubmit((data) => mutation.mutate(data))();
  }, [form, mutation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      onHeaderSave: save,
      headerSaving: mutation.isPending,
    } as never);
  }, [navigation, save, mutation.isPending]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to update profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri);
  };

  if (memberQ.isLoading || staffQ.isLoading) return <LoadingView />;
  if (memberQ.isError || !memberQ.data)
    return (
      <ErrorView
        message={(memberQ.error as Error)?.message || 'Member not found'}
        onRetry={() => {
          void memberQ.refetch();
        }}
      />
    );

  const trainers = (staffQ.data || []).filter((s) => s.role === 'trainer' && s.isActive);

  return (
    <>
      <Screen scroll padded={false} skeletonRows={4} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={[styles.page, { paddingHorizontal: spacing.lg }]}>
          <GlassCard borderRadius={28} elevated contentStyle={styles.heroCard}>
            <Pressable onPress={pickPhoto} style={styles.heroRow}>
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.65)',
                  },
                ]}
              >
                {Platform.OS === 'ios' ? (
                  <BlurView
                    intensity={28}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="camera-outline" size={28} color={iconColor} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  {memberName?.trim() || 'Member'}
                </Text>
                <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                  Tap to change profile photo
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          </GlassCard>

          <StepHeader step={1} title="Personal details" />
          <GlassCard borderRadius={26} contentStyle={styles.card}>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextField
                  label="Full name"
                  placeholder="e.g. Bilal Ahmed"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.name?.message}
                  pill
                />
              )}
            />
            <Controller
              control={form.control}
              name="phone"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextField
                  label="Phone"
                  placeholder="03001234567"
                  keyboardType="number-pad"
                  maxLength={11}
                  value={value}
                  onChangeText={(t) => {
                    const digits = onlyDigits(t, 11);
                    onChange(digits);
                    if (!form.getValues('whatsappPhone')) {
                      form.setValue('whatsappPhone', digits);
                    }
                  }}
                  onBlur={onBlur}
                  error={form.formState.errors.phone?.message}
                  pill
                />
              )}
            />
            <Controller
              control={form.control}
              name="whatsappPhone"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextField
                  label="WhatsApp"
                  placeholder="03001234567"
                  keyboardType="number-pad"
                  maxLength={11}
                  value={value}
                  onChangeText={(t) => onChange(onlyDigits(t, 11))}
                  onBlur={onBlur}
                  error={form.formState.errors.whatsappPhone?.message}
                  pill
                />
              )}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Gender</Text>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other'] as const).map((g) => (
                <GlassPill
                  key={g}
                  label={g.charAt(0).toUpperCase() + g.slice(1)}
                  size="sm"
                  active={gender === g}
                  onPress={() => form.setValue('gender', g)}
                />
              ))}
            </View>

            <Controller
              control={form.control}
              name="dateOfBirth"
              render={({ field: { onChange, value, onBlur } }) => (
                <DateField
                  label="Date of birth"
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.dateOfBirth?.message}
                  maximumDate={new Date()}
                />
              )}
            />
          </GlassCard>

          <StepHeader step={2} title="Trainer & WhatsApp" />
          <GlassCard borderRadius={26} contentStyle={styles.card}>
            <GlassSelect
              label="Trainer"
              placeholder="Select trainer"
              searchable
              searchPlaceholder="Search trainer..."
              value={trainerId || '__none__'}
              options={[
                { value: '__none__', label: 'Unassigned', hint: 'No trainer yet' },
                ...trainers.map((t) => ({
                  value: t.id,
                  label: t.name,
                  hint: t.role,
                })),
              ]}
              onChange={(next) =>
                form.setValue('trainerId', next === '__none__' ? undefined : next)
              }
            />

            <View
              style={[
                styles.switchRow,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,26,25,0.08)',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(255,255,255,0.45)',
                },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                  WhatsApp reminders
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Keep this member opted in for updates
                </Text>
              </View>
              <Controller
                control={form.control}
                name="whatsappOptIn"
                render={({ field: { value, onChange } }) => (
                  <GlassSwitch value={value} onValueChange={onChange} />
                )}
              />
            </View>
          </GlassCard>

          <Button
            title="Save profile"
            variant="primary"
            fullWidth
            loading={mutation.isPending}
            onPress={save}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </Screen>
      <GlassDialog
        visible={leaveOpen}
        tone="warning"
        title="Discard changes?"
        message="You have unsaved edits. Leave without saving?"
        dismissible={false}
        onClose={() => {
          pendingRepeat.current = null;
          setLeaveOpen(false);
        }}
        primaryAction={{
          label: 'Discard',
          variant: 'danger',
          onPress: () => {
            const repeat = pendingRepeat.current;
            pendingRepeat.current = null;
            setLeaveOpen(false);
            setAllowLeave(true);
            showToast({
              tone: 'warning',
              title: 'Changes discarded',
              message: 'Nothing was saved',
            });
            repeat?.();
          },
        }}
        secondaryAction={{
          label: 'Cancel',
          variant: 'secondary',
          onPress: () => {
            pendingRepeat.current = null;
            setLeaveOpen(false);
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 8,
  },
  heroCard: {
    padding: 14,
    marginBottom: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  card: {
    padding: 16,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
});
