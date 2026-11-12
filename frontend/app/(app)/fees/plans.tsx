import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { plansApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import type { Plan } from '@/src/api/types';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function PlansScreen() {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Add / edit sheet
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('5000');
  const [days, setDays] = useState('30');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const query = useQuery({ queryKey: ['plans'], queryFn: plansApi.list });

  const create = useMutation({
    mutationFn: (data: Partial<Plan>) => plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Saved', 'Membership plan created.');
    },
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) =>
      plansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Updated', 'Membership plan updated.');
    },
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const remove = useMutation({
    mutationFn: plansApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
    onError: (e: Error) => Alert.alert('Failed', e.message),
  });

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('5000');
    setDays('30');
    setDescription('');
    setIsActive(true);
  };

  const openAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setName(plan.name);
    setPrice(String(plan.pricePkr));
    setDays(String(plan.durationDays));
    setDescription(plan.description || '');
    setIsActive(plan.isActive);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a plan name.');
      return;
    }
    const priceNum = Number(price);
    const daysNum = Number(days);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Alert.alert('Required', 'Please enter a valid price.');
      return;
    }
    if (!Number.isFinite(daysNum) || daysNum <= 0) {
      Alert.alert('Required', 'Please enter a valid duration in days.');
      return;
    }

    const payload: Partial<Plan> = {
      name: name.trim(),
      pricePkr: priceNum,
      durationDays: daysNum,
      description: description.trim() || undefined,
      isActive,
    };

    if (editingId) {
      update.mutate({ id: editingId, data: payload });
    } else {
      create.mutate(payload);
    }
  };

  const confirmDelete = (plan: Plan) => {
    Alert.alert('Delete Plan', `Delete "${plan.name}"? Members on this plan keep their record.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(plan.id) },
    ]);
  };

  const plans = useMemo(() => {
    const list = query.data || [];
    const needle = q.trim().toLowerCase();
    return list.filter((plan) => {
      if (statusFilter === 'active' && !plan.isActive) return false;
      if (statusFilter === 'inactive' && plan.isActive) return false;
      if (!needle) return true;
      return (
        plan.name.toLowerCase().includes(needle) ||
        (plan.description || '').toLowerCase().includes(needle)
      );
    });
  }, [query.data, q, statusFilter]);

  const renderPlan = ({ item }: { item: Plan }) => (
    <Pressable
      onPress={() => openEdit(item)}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
      style={{ marginBottom: 10 }}
    >
      <GlassCard borderRadius={20} contentStyle={{ padding: 14 }}>
        <View style={styles.planRow}>
          <View
            style={[
              styles.planIcon,
              {
                borderColor: item.isActive
                  ? 'rgba(16, 185, 129, 0.45)'
                  : isDark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(0,0,0,0.08)',
                backgroundColor: item.isActive
                  ? 'rgba(16, 185, 129, 0.14)'
                  : isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)',
              },
            ]}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={item.isActive ? '#10B981' : colors.textTertiary}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.planTitleRow}>
              <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Badge
                label={item.isActive ? 'Active' : 'Inactive'}
                variant={item.isActive ? 'active' : 'expired'}
                size="sm"
              />
            </View>

            <Text style={[styles.planPrice, { color: colors.text }]}>
              {formatPkr(item.pricePkr)}
            </Text>

            <Text style={[styles.planMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.durationDays} days
              {item.durationDays >= 365
                ? ' · yearly'
                : item.durationDays >= 90
                  ? ' · quarterly'
                  : ''}
            </Text>

            {item.description ? (
              <Text
                style={[styles.planDesc, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => confirmDelete(item)}
            hitSlop={10}
            accessibilityLabel={`Delete ${item.name}`}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(239, 68, 68, 0.14)'
                  : 'rgba(239, 68, 68, 0.10)',
                borderColor: 'rgba(239, 68, 68, 0.35)',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </Pressable>
        </View>
      </GlassCard>
    </Pressable>
  );

  if (query.isLoading) return <SkeletonList />;

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Membership Plans"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search plans..."
          rightSlot={
            <GlassIconButton
              name="add"
              accessibilityLabel="Add plan"
              onPress={openAdd}
            />
          }
          filterContent={
            <>
              <GlassPill
                label="All"
                size="sm"
                active={statusFilter === 'all'}
                onPress={() => setStatusFilter('all')}
              />
              <GlassPill
                label="Active"
                size="sm"
                active={statusFilter === 'active'}
                onPress={() => setStatusFilter('active')}
              />
              <GlassPill
                label="Inactive"
                size="sm"
                active={statusFilter === 'inactive'}
                onPress={() => setStatusFilter('inactive')}
              />
            </>
          }
        />
      </View>

      {query.isError ? (
        <ErrorView
          message={(query.error as Error).message}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlan}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                void query.refetch();
              }}
            />
          }
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 6,
            paddingBottom: tabPad + 40,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <EmptyView
              title="No Plans Found"
              subtitle={
                q
                  ? 'Try a different search query.'
                  : 'Tap "+" in the header to create a membership plan.'
              }
              actionLabel="Create Plan"
              onAction={openAdd}
            />
          }
        />
      )}

      {/* ADD / EDIT PLAN SHEET */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark
                  ? 'rgba(19, 34, 32, 0.92)'
                  : 'rgba(255, 255, 255, 0.94)',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                borderTopColor: isDark
                  ? 'rgba(255,255,255,0.34)'
                  : 'rgba(255,255,255,0.98)',
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={70}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <BlurView
                intensity={isDark ? 55 : 65}
                tint={isDark ? 'dark' : 'light'}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'transparent']
                  : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.16)', 'transparent']
              }
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.7 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {editingId ? 'Edit Plan' : 'New Plan'}
                </Text>
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
                  Price and duration apply to new memberships and renewals
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.14)'
                      : 'rgba(0, 0, 0, 0.10)',
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <TextField
                label="Plan Name"
                placeholder="e.g. Monthly Premium"
                value={name}
                onChangeText={setName}
              />
              <TextField
                label="Price (PKR)"
                placeholder="e.g. 5000"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
              <TextField
                label="Duration (days)"
                placeholder="e.g. 30"
                value={days}
                onChangeText={setDays}
                keyboardType="numeric"
                helper={
                  Number(days) >= 365
                    ? 'Yearly plan'
                    : Number(days) >= 90
                      ? 'Quarterly plan'
                      : Number(days) > 0
                        ? 'Monthly plan'
                        : undefined
                }
              />
              <TextField
                label="Description"
                placeholder="e.g. Includes locker + trainer support"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />

              <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Active Plan
                  </Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                    Available when adding or renewing members
                  </Text>
                </View>
                <GlassSwitch value={isActive} onValueChange={setIsActive} />
              </View>

              <Button
                title={editingId ? 'Update Plan' : 'Create Plan'}
                loading={create.isPending || update.isPending}
                style={{ marginTop: 18 }}
                onPress={handleSave}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    flexShrink: 1,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  planMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  planDesc: {
    fontSize: 12.5,
    marginTop: 6,
    lineHeight: 16,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
