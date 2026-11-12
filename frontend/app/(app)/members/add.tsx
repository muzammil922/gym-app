import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useNavigation, usePreventRemove } from 'expo-router';
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
import { membersApi, offersApi, plansApi, staffApi } from '@/src/api/endpoints';
import { addMemberSchema, AddMemberForm } from '@/src/features/members/schemas';
import { todayIso } from '@/src/utils/date';
import { formatPkr } from '@/src/utils/currency';

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

export default function AddMemberScreen() {
  const { colors, spacing, isDark } = useTheme();
  const navigation = useNavigation();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);
  const pendingRepeat = useRef<(() => void) | null>(null);
  const showToast = useToastStore((s) => s.show);
  const iconColor = isDark ? '#FFFFFF' : '#0F1A19';

  const plansQ = useQuery({ queryKey: ['plans'], queryFn: plansApi.list });
  const staffQ = useQuery({
    queryKey: ['staff', 'all'],
    queryFn: async () => (await staffApi.list({ pageSize: 100 })).items,
  });
  const offersQ = useQuery({
    queryKey: ['offers', 'all'],
    queryFn: async () => (await offersApi.list({ active: true, pageSize: 100 })).items,
  });

  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      name: '',
      phone: '',
      whatsappPhone: '',
      gender: 'male',
      dateOfBirth: '1998-01-01',
      planId: '',
      startDate: todayIso(),
      openingPaymentPkr: 0,
      advancePkr: 0,
      paymentMethod: 'cash',
      whatsappOptIn: true,
    },
  });

  const planId = form.watch('planId');
  const gender = form.watch('gender');
  const paymentMethod = form.watch('paymentMethod');
  const trainerId = form.watch('trainerId');
  const offerId = form.watch('offerId');
  const memberName = form.watch('name');
  const openingPaymentPkr = form.watch('openingPaymentPkr');
  const advancePkr = form.watch('advancePkr');
  const invoiceTotal = (openingPaymentPkr || 0) + (advancePkr || 0);

  const suggestQ = useQuery({
    queryKey: ['offers', 'suggest', planId],
    queryFn: () => offersApi.suggest(planId),
    enabled: !!planId,
  });

  const selectedPlan = useMemo(
    () => (plansQ.data || []).find((p) => p.id === planId),
    [plansQ.data, planId],
  );

  const availableOffers = useMemo(() => {
    const list = offersQ.data || [];
    const suggested = suggestQ.data || [];
    const map = new Map<string, (typeof list)[0]>();
    for (const o of suggested) {
      map.set(o.id, o);
    }
    for (const o of list) {
      if (!planId || !o.planIds?.length || o.planIds.includes(planId)) {
        if (!map.has(o.id)) {
          map.set(o.id, o);
        }
      }
    }
    return Array.from(map.values());
  }, [offersQ.data, suggestQ.data, planId]);

  useEffect(() => {
    if (plansQ.data?.length && !form.getValues('planId')) {
      form.setValue('planId', plansQ.data[0].id);
    }
  }, [plansQ.data, form]);

  useEffect(() => {
    const offer = suggestQ.data?.[0];
    if (offer) form.setValue('offerId', offer.id);
  }, [suggestQ.data, form]);

  useEffect(() => {
    if (selectedPlan && form.getValues('openingPaymentPkr') === 0) {
      form.setValue('openingPaymentPkr', selectedPlan.pricePkr);
    }
  }, [selectedPlan, form]);

  const isDirty = form.formState.isDirty || !!photoUri;
  const disablePreventionRef = useRef<() => void>(() => {});

  const disablePrevention = usePreventRemove(isDirty && !allowLeave, ({ repeat }) => {
    pendingRepeat.current = repeat;
    setLeaveOpen(true);
  });
  disablePreventionRef.current = disablePrevention;

  const mutation = useMutation({
    mutationFn: membersApi.create,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['members'] });
      setAllowLeave(true);
      disablePreventionRef.current();
      showToast({
        tone: 'success',
        title: 'Member ready',
        message: 'Saved successfully',
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
    form.handleSubmit((values) => mutation.mutate({ ...values, photoUri }))();
  }, [form, mutation, photoUri]);

  useLayoutEffect(() => {
    navigation.setOptions({
      onHeaderSave: save,
      headerSaving: mutation.isPending,
    } as never);
  }, [navigation, save, mutation.isPending]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach a member photo.');
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

  if (plansQ.isLoading || staffQ.isLoading) return <LoadingView />;
  if (plansQ.isError) return <ErrorView message={(plansQ.error as Error).message} />;

  const trainers = (staffQ.data || []).filter((s) => s.role === 'trainer' && s.isActive);
  const methods = [
    { id: 'cash' as const, label: 'Cash' },
    { id: 'easypaisa' as const, label: 'Easypaisa' },
    { id: 'jazzcash' as const, label: 'JazzCash' },
    { id: 'bank' as const, label: 'Bank' },
  ];
  const activePlans = (plansQ.data || []).filter((p) => p.isActive);

  return (
    <>
    <Screen scroll padded={false} skeletonRows={4} contentContainerStyle={{ paddingBottom: 16 }}>
      <View style={[styles.page, { paddingHorizontal: spacing.lg }]}>
        {/* Photo hero — single clear focus */}
        <GlassCard borderRadius={28} elevated contentStyle={styles.heroCard}>
          <Pressable onPress={pickPhoto} style={styles.heroRow}>
            <View
              style={[
                styles.avatarRing,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)',
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
                {memberName?.trim() || 'New member'}
              </Text>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Tap to add profile photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        </GlassCard>

        {/* 1 · Personal */}
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
                  if (!form.getValues('whatsappPhone')) form.setValue('whatsappPhone', digits);
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

        {/* 2 · Membership */}
        <StepHeader step={2} title="Membership" />
        <GlassCard borderRadius={26} contentStyle={styles.card}>
          <Controller
            control={form.control}
            name="startDate"
            render={({ field: { onChange, value, onBlur } }) => (
              <DateField
                label="Start date"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                error={form.formState.errors.startDate?.message}
              />
            )}
          />

          <GlassSelect
            label="Plan"
            placeholder="Select membership plan"
            searchable
            searchPlaceholder="Search plans..."
            value={planId || undefined}
            options={activePlans.map((p) => ({
              value: p.id,
              label: p.name,
              hint: `${formatPkr(p.pricePkr)} · ${p.durationDays} days`,
            }))}
            onChange={(id) => {
              form.setValue('planId', id);
              const plan = activePlans.find((p) => p.id === id);
              if (plan) form.setValue('openingPaymentPkr', plan.pricePkr);
            }}
            error={form.formState.errors.planId?.message}
          />

          <GlassSelect
            label="Offer"
            placeholder="Select offer"
            searchable
            searchPlaceholder="Search offers..."
            value={offerId || '__none__'}
            options={[
              { value: '__none__', label: 'None', hint: 'No offer applied' },
              ...availableOffers.map((o) => ({
                value: o.id,
                label: o.title,
                hint:
                  o.discountAmountPkr
                    ? `${formatPkr(o.discountAmountPkr)} off`
                    : o.discountPercent
                      ? `${o.discountPercent}% off`
                      : o.description || undefined,
              })),
            ]}
            onChange={(id) => {
              const chosen = id === '__none__' ? undefined : id;
              form.setValue('offerId', chosen);
              if (selectedPlan) {
                if (!chosen) {
                  form.setValue('openingPaymentPkr', selectedPlan.pricePkr);
                } else {
                  const offer = availableOffers.find((x) => x.id === chosen);
                  if (offer) {
                    let finalPrice = selectedPlan.pricePkr;
                    if (offer.discountAmountPkr) {
                      finalPrice = Math.max(0, finalPrice - offer.discountAmountPkr);
                    } else if (offer.discountPercent) {
                      finalPrice = Math.max(
                        0,
                        Math.round(finalPrice * (1 - offer.discountPercent / 100)),
                      );
                    }
                    form.setValue('openingPaymentPkr', finalPrice);
                  }
                }
              }
            }}
          />

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
            onChange={(id) =>
              form.setValue('trainerId', id === '__none__' ? undefined : id)
            }
          />
        </GlassCard>

        {/* 3 · Payment */}
        <StepHeader step={3} title="Opening payment" />
        <GlassCard borderRadius={26} contentStyle={styles.card}>
          <Controller
            control={form.control}
            name="openingPaymentPkr"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextField
                label="Opening amount (PKR)"
                placeholder="0"
                keyboardType="number-pad"
                value={String(value || '')}
                onChangeText={(t) => onChange(Number(onlyDigits(t, 8) || 0))}
                onBlur={onBlur}
                error={form.formState.errors.openingPaymentPkr?.message}
                pill
              />
            )}
          />

          <Controller
            control={form.control}
            name="advancePkr"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextField
                label="Advance (PKR)"
                placeholder="0"
                keyboardType="number-pad"
                value={String(value || '')}
                onChangeText={(t) => onChange(Number(onlyDigits(t, 8) || 0))}
                onBlur={onBlur}
                error={form.formState.errors.advancePkr?.message}
                pill
              />
            )}
          />

          <View
            style={[
              styles.invoiceHint,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,26,25,0.05)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,26,25,0.08)',
              },
            ]}
          >
            <Text style={[styles.invoiceHintLabel, { color: colors.textSecondary }]}>
              One invoice total
            </Text>
            <Text style={[styles.invoiceHintValue, { color: colors.text }]}>
              {formatPkr(invoiceTotal)}
            </Text>
            <Text style={[styles.invoiceHintSub, { color: colors.textTertiary }]}>
              Opening {formatPkr(openingPaymentPkr || 0)} + Advance {formatPkr(advancePkr || 0)}
            </Text>
          </View>

          <GlassSelect
            label="Method"
            placeholder="Select payment method"
            value={paymentMethod}
            options={methods.map((m) => ({
              value: m.id,
              label: m.label,
            }))}
            onChange={(id) =>
              form.setValue('paymentMethod', id as typeof paymentMethod)
            }
          />

          <View
            style={[
              styles.switchRow,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,26,25,0.08)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={20}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[
                styles.glassIcon,
                {
                  backgroundColor: isDark ? 'rgba(37, 211, 102, 0.16)' : 'rgba(37, 211, 102, 0.12)',
                  borderColor: isDark ? 'rgba(37, 211, 102, 0.35)' : 'rgba(37, 211, 102, 0.30)',
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
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </View>

            <View style={{ flex: 1, marginLeft: 12, paddingRight: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                WhatsApp welcome
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                Send welcome + receipt automatically
              </Text>
            </View>
            <Controller
              control={form.control}
              name="whatsappOptIn"
              render={({ field: { value, onChange } }) => (
                <GlassSwitch
                  value={value}
                  onValueChange={onChange}
                />
              )}
            />
          </View>
        </GlassCard>

        <Button
          title="Create member"
          variant="primary"
          loading={mutation.isPending}
          onPress={save}
          fullWidth
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </Screen>
    <GlassDialog
      visible={leaveOpen}
      tone="warning"
      title="Discard changes?"
      message="You have unsaved details. Leave without saving?"
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glassIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 6,
  },
  invoiceHint: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    marginTop: 2,
  },
  invoiceHintLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceHintValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  invoiceHintSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
