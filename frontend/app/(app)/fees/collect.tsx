import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { Button } from '@/src/components/ui/Button';
import { SectionTitle } from '@/src/components/ui/SectionTitle';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSelect, type GlassSelectOption } from '@/src/components/ui/GlassSelect';
import { ErrorView, LoadingView } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { membersApi, paymentsApi, plansApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import { printAndShareInvoice } from '@/src/features/fees/invoice';

const PREF_PAYMENT_METHOD_KEY = 'pref_payment_method';

const PAYMENT_METHOD_OPTIONS: GlassSelectOption[] = [
  { value: 'cash', label: 'Cash', hint: 'Physical cash received' },
  { value: 'easypaisa', label: 'EasyPaisa', hint: 'Mobile wallet transfer' },
  { value: 'jazzcash', label: 'JazzCash', hint: 'Mobile wallet transfer' },
  { value: 'bank', label: 'Bank Transfer', hint: 'Direct bank account transfer' },
];

const schema = z.object({
  memberId: z.string().min(1, 'Please select a member'),
  amountPkr: z.number().min(1, 'Enter valid amount'),
  discountPkr: z.number().min(0),
  method: z.enum(['cash', 'easypaisa', 'jazzcash', 'bank']),
  notes: z.string().optional(),
  renew: z.boolean(),
  planId: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function CollectPaymentScreen() {
  const { memberId: paramMemberId, paymentId } = useLocalSearchParams<{
    memberId?: string;
    paymentId?: string;
  }>();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [lastPaymentId, setLastPaymentId] = useState<string | undefined>(paymentId);

  const membersQ = useQuery({ queryKey: ['members', 'all'], queryFn: () => membersApi.list({ pageSize: 100 }) });
  const plansQ = useQuery({ queryKey: ['plans'], queryFn: plansApi.list });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      memberId: paramMemberId || '',
      amountPkr: 0,
      discountPkr: 0,
      method: 'cash',
      renew: false,
    },
  });

  // Load user's saved payment method preference
  useEffect(() => {
    void AsyncStorage.getItem(PREF_PAYMENT_METHOD_KEY).then((saved) => {
      if (saved && ['cash', 'easypaisa', 'jazzcash', 'bank'].includes(saved)) {
        form.setValue('method', saved as Form['method']);
      }
    });
  }, [form]);

  const handleSelectMethod = (m: Form['method']) => {
    form.setValue('method', m);
    void AsyncStorage.setItem(PREF_PAYMENT_METHOD_KEY, m);
  };

  useEffect(() => {
    if (paramMemberId) form.setValue('memberId', paramMemberId);
  }, [paramMemberId, form]);

  const selectedId = form.watch('memberId');
  const selected = membersQ.data?.items.find((m) => m.id === selectedId);

  useEffect(() => {
    if (selected && !form.getValues('amountPkr')) {
      form.setValue('amountPkr', selected.outstandingPkr || 0);
      form.setValue('planId', selected.planId);
    }
  }, [selected, form]);

  const memberOptions = useMemo<GlassSelectOption[]>(() => {
    return (membersQ.data?.items || []).map((m) => ({
      value: m.id,
      label: m.name,
      hint: `${m.phone || 'No phone'} · ${m.planName} · Dues: ${formatPkr(m.outstandingPkr || 0)}`,
    }));
  }, [membersQ.data?.items]);

  const planOptions = useMemo<GlassSelectOption[]>(() => {
    return (plansQ.data || []).map((p) => ({
      value: p.id,
      label: `${p.name} · ${formatPkr(p.pricePkr)}`,
      hint: `${p.durationDays} days`,
    }));
  }, [plansQ.data]);

  const collect = useMutation({
    mutationFn: paymentsApi.collect,
    onSuccess: async (res) => {
      setLastPaymentId(res.payment.id);
      void AsyncStorage.setItem(PREF_PAYMENT_METHOD_KEY, res.payment.method);
      await qc.invalidateQueries({ queryKey: ['payments'] });
      await qc.invalidateQueries({ queryKey: ['members'] });
      await qc.invalidateQueries({ queryKey: ['dues'] });
      Alert.alert('Payment Recorded', `${res.payment.invoiceNumber} · ${formatPkr(res.payment.paidPkr)}`, [
        {
          text: 'Share PDF',
          onPress: async () => {
            await printAndShareInvoice(res.invoice);
          },
        },
        {
          text: 'Send WhatsApp',
          onPress: async () => {
            await paymentsApi.sendWhatsApp(res.payment.id);
            Alert.alert('Queued', 'Invoice WhatsApp message queued.');
          },
        },
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
    onError: (e: Error) => Alert.alert('Payment Failed', e.message),
  });

  if (membersQ.isLoading) return <LoadingView />;
  if (membersQ.isError) return <ErrorView message={(membersQ.error as Error).message} />;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 16 }}>
      <View>
        {/* Section 1: Member Selection */}
        <SectionTitle title="Select Member" />
        <GlassCard caustic="violet" borderRadius={26} contentStyle={styles.card}>
          <GlassSelect
            label="Member"
            placeholder="Choose member…"
            value={selectedId}
            options={memberOptions}
            searchable
            searchPlaceholder="Search member name or phone…"
            onChange={(id) => {
              form.setValue('memberId', id);
              const m = membersQ.data?.items.find((item) => item.id === id);
              if (m) {
                form.setValue('amountPkr', m.outstandingPkr || 0);
                form.setValue('planId', m.planId);
              }
            }}
            error={form.formState.errors.memberId?.message}
          />

          {selected ? (
            <View style={styles.dueBox}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                  {selected.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {selected.planName} · {selected.phone || 'No phone'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Outstanding</Text>
                <Text
                  style={{
                    color: selected.outstandingPkr > 0 ? '#F87171' : '#34D399',
                    fontWeight: '800',
                    fontSize: 17,
                  }}
                >
                  {formatPkr(selected.outstandingPkr)}
                </Text>
              </View>
            </View>
          ) : null}
        </GlassCard>

        {/* Section 2: Payment Amount */}
        <SectionTitle title="Payment Details" />
        <GlassCard caustic="emerald" borderRadius={26} contentStyle={styles.card}>
          <Controller
            control={form.control}
            name="amountPkr"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextField
                label="Amount Paid (PKR)"
                placeholder="0"
                keyboardType="numeric"
                value={String(value)}
                onChangeText={(t) => onChange(Number(t || 0))}
                onBlur={onBlur}
                error={form.formState.errors.amountPkr?.message}
                icon="cash-outline"
                pill
              />
            )}
          />
          <Controller
            control={form.control}
            name="discountPkr"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextField
                label="Discount (PKR)"
                placeholder="0"
                keyboardType="numeric"
                value={String(value)}
                onChangeText={(t) => onChange(Number(t || 0))}
                onBlur={onBlur}
                icon="pricetag-outline"
                pill
              />
            )}
          />

          <View style={{ marginTop: 8 }}>
            <GlassSelect
              label="Payment Method"
              placeholder="Select payment method…"
              value={form.watch('method')}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={(m) => handleSelectMethod(m as Form['method'])}
            />
          </View>
        </GlassCard>

        {/* Section 3: Membership Renewal */}
        <SectionTitle title="Renewal Option" />
        <GlassCard caustic="amber" borderRadius={26} contentStyle={styles.card}>
          <GlassPill
            label={form.watch('renew') ? '✓ Renew membership on payment' : '+ Renew membership on payment'}
            active={form.watch('renew')}
            caustic="amber"
            onPress={() => {
              const next = !form.watch('renew');
              form.setValue('renew', next);
              if (next && !form.watch('planId') && selected?.planId) {
                form.setValue('planId', selected.planId);
              }
            }}
          />

          {form.watch('renew') ? (
            <View style={{ marginTop: 14 }}>
              <GlassSelect
                label="Select Renewal Plan"
                placeholder="Choose a renewal plan…"
                value={form.watch('planId')}
                options={planOptions}
                searchable
                searchPlaceholder="Search plans…"
                onChange={(pId) => {
                  form.setValue('planId', pId);
                  const p = plansQ.data?.find((item) => item.id === pId);
                  if (p && (!form.getValues('amountPkr') || form.getValues('amountPkr') === 0)) {
                    form.setValue('amountPkr', p.pricePkr);
                  }
                }}
              />
            </View>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <Controller
              control={form.control}
              name="notes"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextField
                  label="Internal Note (optional)"
                  placeholder="e.g. Received by reception"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  icon="document-text-outline"
                  pill
                />
              )}
            />
          </View>
        </GlassCard>

        {/* Submit Actions */}
        <Button
          title="Record Payment & Generate Invoice"
          variant="primary"
          loading={collect.isPending}
          onPress={form.handleSubmit((v) => collect.mutate(v))}
          fullWidth
          style={{ marginTop: spacing.xl }}
        />

        {lastPaymentId ? (
          <Button
            title="Re-share Last Invoice PDF"
            variant="secondary"
            fullWidth
            style={{ marginTop: 10 }}
            onPress={async () => {
              const invoice = await paymentsApi.invoice(lastPaymentId);
              await printAndShareInvoice(invoice);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  dueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
});
