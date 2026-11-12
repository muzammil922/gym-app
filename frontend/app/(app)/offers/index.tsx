import React, { useCallback, useMemo, useState } from 'react';
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
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { GlassMultiSelect } from '@/src/components/ui/GlassMultiSelect';
import { GlassSelect } from '@/src/components/ui/GlassSelect';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { offersApi, plansApi } from '@/src/api/endpoints';
import { addDaysIso, formatDate, todayIso } from '@/src/utils/date';
import { formatPkr } from '@/src/utils/currency';
import type { Offer, Plan } from '@/src/api/types';

const DURATION_PRESETS = [
  { label: '15 Days', days: 15 },
  { label: '30 Days', days: 30 },
  { label: '60 Days', days: 60 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
];

/**
 * Frosted-glass sheet surface: BlurView + specular rim gradient behind content.
 * Used by both the editor sheet and the details sheet.
 */
function SheetGlass({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.modalSheet,
        {
          backgroundColor: isDark
            ? 'rgba(19, 34, 32, 0.92)'
            : 'rgba(255, 255, 255, 0.94)',
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
          borderTopColor: isDark
            ? 'rgba(255,255,255,0.34)'
            : 'rgba(255,255,255,0.98)',
          shadowOpacity: isDark ? 0.55 : 0.18,
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
      {children}
    </View>
  );
}

export default function OffersScreen() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();

  // Search and Filter State
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Modal State for Add / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  /** Preserved from an existing offer; not user-editable from this sheet. */
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
  const [discountVal, setDiscountVal] = useState('15');
  const [validityDays, setValidityDays] = useState(30);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Detail / Action Sheet State
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  // Queries
  const plansQ = useQuery({ queryKey: ['plans'], queryFn: plansApi.list });
  const allPlans: Plan[] = plansQ.data || [];

  const query = useInfiniteQuery({
    queryKey: ['offers', q, statusFilter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      offersApi.list({
        q: q || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: pageParam,
        pageSize: 15,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const offerList = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Offer>) => offersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Promotion offer created successfully.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Offer> }) =>
      offersApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setModalVisible(false);
      if (selectedOffer && selectedOffer.id === updated.id) {
        setSelectedOffer(updated);
      }
      resetForm();
      Alert.alert('Updated', 'Offer details updated.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const removeMutation = useMutation({
    mutationFn: offersApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setSelectedOffer(null);
      Alert.alert('Deleted', 'Offer removed.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const resetForm = () => {
    setEditingOfferId(null);
    setTitle('');
    setDescription('');
    setDiscountType('percent');
    setDiscountVal('15');
    setValidityDays(30);
    setSelectedPlanIds([]);
    setAutoSuggest(true);
    setIsActive(true);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (offer: Offer) => {
    setEditingOfferId(offer.id);
    setTitle(offer.title);
    setDescription(offer.description || '');
    if (offer.discountAmountPkr && offer.discountAmountPkr > 0) {
      setDiscountType('flat');
      setDiscountVal(String(offer.discountAmountPkr));
    } else {
      setDiscountType('percent');
      setDiscountVal(String(offer.discountPercent || 10));
    }
    setSelectedPlanIds(offer.planIds || []);
    setAutoSuggest(offer.autoSuggest !== false);
    setIsActive(offer.isActive !== false);
    setSelectedOffer(null);
    setModalVisible(true);
  };

  const handleSaveOffer = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an offer title.');
      return;
    }
    const numericVal = parseInt(discountVal, 10);
    if (isNaN(numericVal) || numericVal <= 0) {
      Alert.alert('Required', 'Please enter a valid discount amount or percentage.');
      return;
    }

    const payload: Partial<Offer> = {
      title: title.trim(),
      description:
        description.trim() ||
        (discountType === 'percent' ? `${numericVal}% discount offer` : `Rs ${numericVal} discount offer`),
      discountPercent: discountType === 'percent' ? numericVal : undefined,
      discountAmountPkr: discountType === 'flat' ? numericVal : undefined,
      validFrom: todayIso(),
      validTo: addDaysIso(todayIso(), validityDays),
      planIds: selectedPlanIds.length > 0 ? selectedPlanIds : allPlans.map((p) => p.id),
      autoSuggest,
      isActive,
    };

    if (editingOfferId) {
      updateMutation.mutate({ id: editingOfferId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = (offer: Offer) => {
    Alert.alert('Delete Offer', `Are you sure you want to delete "${offer.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeMutation.mutate(offer.id),
      },
    ]);
  };

  const toggleOfferStatus = (offer: Offer) => {
    updateMutation.mutate({
      id: offer.id,
      data: { isActive: !offer.isActive },
    });
  };

  // Render individual offer card in Liquid Glass design
  const renderItem = useCallback(
    ({ item }: { item: Offer }) => {
      const isOfferActive = item.isActive && item.validTo >= todayIso();
      const ringTone = isOfferActive ? '#10B981' : colors.textTertiary;
      const isPercent = !!item.discountPercent;
      const discountLabel = isPercent
        ? `${item.discountPercent}% OFF`
        : `Rs ${item.discountAmountPkr || 0} OFF`;

      return (
        <GlassCard borderRadius={20} style={styles.cardShell}>
          <Pressable
            onPress={() => setSelectedOffer(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${discountLabel}`}
            style={({ pressed }) => [
              styles.cardContent,
              {
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(15, 118, 110, 0.04)'
                  : 'transparent',
              },
            ]}
          >
            {/* Discount Icon Ring */}
            <View
              style={[
                styles.discountBadgeRing,
                {
                  borderColor: isDark ? `${ringTone}55` : `${ringTone}40`,
                  backgroundColor: isDark
                    ? isOfferActive
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(255, 255, 255, 0.04)'
                    : isOfferActive
                      ? 'rgba(16, 185, 129, 0.10)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              ]}
            >
              <Ionicons
                name={isPercent ? 'pricetag' : 'cash'}
                size={22}
                color={isOfferActive ? '#10B981' : colors.textTertiary}
              />
              <Text
                style={[
                  styles.discountBadgeText,
                  { color: isOfferActive ? '#10B981' : colors.textTertiary },
                ]}
                numberOfLines={1}
              >
                {isPercent ? `${item.discountPercent}%` : `-${item.discountAmountPkr}`}
              </Text>
            </View>

            {/* Info Copy */}
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Badge
                  label={isOfferActive ? 'Active' : 'Expired'}
                  variant={isOfferActive ? 'active' : 'expired'}
                  size="sm"
                  style={styles.badgeChip}
                />
                {item.autoSuggest ? (
                  <Badge
                    label="Auto Apply"
                    variant="pending"
                    size="sm"
                    style={styles.badgeChip}
                  />
                ) : null}
              </View>

              {item.description ? (
                <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Validity timeline */}
              <View style={styles.validityRow}>
                <Ionicons
                  name="calendar-outline"
                  size={12.5}
                  color={isDark ? '#2DD4BF' : '#0F766E'}
                />
                <Text
                  style={[
                    styles.validityText,
                    { color: isDark ? '#2DD4BF' : '#0F766E', fontWeight: '600' },
                  ]}
                >
                  {formatDate(item.validFrom)} → {formatDate(item.validTo)}
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textTertiary}
              style={styles.chevron}
            />
          </Pressable>
        </GlassCard>
      );
    },
    [colors, isDark],
  );

  return (
    <Screen padded={false}>
      {/* Top Header - Matching Staff Page exactly */}
      <View
        style={{
          paddingTop: 6,
          paddingHorizontal: spacing.lg,
          paddingBottom: 4,
        }}
      >
        <PageHeader
          title="Offers"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search offers & discounts..."
          rightSlot={
            <GlassIconButton
              name="add"
              accessibilityLabel="Add offer"
              onPress={openAddModal}
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
                label="Expired"
                size="sm"
                active={statusFilter === 'expired'}
                onPress={() => setStatusFilter('expired')}
              />
            </>
          }
        />
      </View>

      {/* Main Content List */}
      {query.isLoading ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <SkeletonList rows={5} />
        </View>
      ) : query.isError ? (
        <ErrorView
          message={(query.error as Error).message}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <FlatList
          data={offerList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 6,
            paddingBottom: tabPad + 40,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isFetchingNextPage}
              onRefresh={() => {
                void query.refetch();
              }}
            />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyView
              title="No Offers Found"
              subtitle={q ? 'Try a different search query.' : 'Tap "+" in the header to create a new promotion.'}
              actionLabel="Create Offer"
              onAction={openAddModal}
            />
          }
        />
      )}

      {/* ADD / EDIT OFFER MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <SheetGlass>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingOfferId ? 'Edit Promotion Offer' : 'New Promotion Offer'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Discount will be automatically suggested at member checkout
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
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
              contentContainerStyle={{ paddingBottom: 28 }}
            >
              {/* Offer Title */}
              <TextField
                label="Offer Title"
                placeholder="e.g. New Year Fitness Fest, Summer Cut"
                value={title}
                onChangeText={setTitle}
              />

              {/* Discount Type (Percentage vs Flat PKR) */}
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  DISCOUNT TYPE
                </Text>
                <View style={styles.typeSegmentRow}>
                  <Pressable
                    onPress={() => setDiscountType('percent')}
                    style={({ pressed }) => [
                      styles.typeSegmentBtn,
                      {
                        backgroundColor:
                          discountType === 'percent'
                            ? isDark
                              ? 'rgba(45, 212, 191, 0.20)'
                              : 'rgba(15, 118, 110, 0.14)'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.03)',
                        borderColor:
                          discountType === 'percent'
                            ? isDark
                              ? '#2DD4BF'
                              : '#0F766E'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="pricetag"
                      size={15}
                      color={
                        discountType === 'percent'
                          ? isDark
                            ? '#2DD4BF'
                            : '#0F766E'
                          : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.typeSegmentText,
                        {
                          color:
                            discountType === 'percent'
                              ? isDark
                                ? '#2DD4BF'
                                : '#0F766E'
                              : colors.textSecondary,
                          fontWeight: discountType === 'percent' ? '700' : '500',
                        },
                      ]}
                    >
                      Percentage (%)
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDiscountType('flat')}
                    style={({ pressed }) => [
                      styles.typeSegmentBtn,
                      {
                        backgroundColor:
                          discountType === 'flat'
                            ? isDark
                              ? 'rgba(45, 212, 191, 0.20)'
                              : 'rgba(15, 118, 110, 0.14)'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.03)',
                        borderColor:
                          discountType === 'flat'
                            ? isDark
                              ? '#2DD4BF'
                              : '#0F766E'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="cash"
                      size={15}
                      color={
                        discountType === 'flat'
                          ? isDark
                            ? '#2DD4BF'
                            : '#0F766E'
                          : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.typeSegmentText,
                        {
                          color:
                            discountType === 'flat'
                              ? isDark
                                ? '#2DD4BF'
                                : '#0F766E'
                              : colors.textSecondary,
                          fontWeight: discountType === 'flat' ? '700' : '500',
                        },
                      ]}
                    >
                      Flat PKR (Rs)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Discount Value */}
              <TextField
                label={discountType === 'percent' ? 'Discount Percentage (%)' : 'Discount Amount (PKR)'}
                placeholder={discountType === 'percent' ? 'e.g. 20' : 'e.g. 1000'}
                value={discountVal}
                onChangeText={setDiscountVal}
                keyboardType="numeric"
              />

              {/* Offer Validity Duration — liquid glass dropdown */}
              <GlassSelect
                label="Offer Validity Duration"
                placeholder="Select duration"
                value={String(validityDays)}
                options={DURATION_PRESETS.map((preset) => ({
                  value: String(preset.days),
                  label: preset.label,
                  hint: `Valid till ${formatDate(addDaysIso(todayIso(), preset.days))}`,
                }))}
                onChange={(next) => setValidityDays(Number(next))}
              />

              <Text
                style={[
                  styles.rangePreviewText,
                  { color: colors.textSecondary, marginTop: -6, marginBottom: 14 },
                ]}
              >
                Valid: {formatDate(todayIso())} → {formatDate(addDaysIso(todayIso(), validityDays))}
              </Text>

              {/* Applicable Plans — liquid glass multi-select */}
              {allPlans.length > 0 ? (
                <GlassMultiSelect
                  label="Applicable Membership Plans"
                  placeholder="Select membership plans"
                  allLabel="All membership plans"
                  values={selectedPlanIds}
                  options={allPlans.map((plan) => ({
                    value: plan.id,
                    label: plan.name,
                    hint: plan.durationDays
                      ? `${plan.durationDays} days · Rs ${plan.pricePkr.toLocaleString('en-PK')}`
                      : undefined,
                  }))}
                  onChange={setSelectedPlanIds}
                  searchable={allPlans.length > 6}
                  searchPlaceholder="Search plans…"
                />
              ) : null}

              {/* Auto-suggest Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Auto-suggest at Checkout
                  </Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                    Prompt trainer / front-desk to apply discount on member fee
                  </Text>
                </View>
                <GlassSwitch value={autoSuggest} onValueChange={setAutoSuggest} />
              </View>

              {/* Status Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Active Promotion
                  </Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                    Make offer immediately redeemable
                  </Text>
                </View>
                <GlassSwitch value={isActive} onValueChange={setIsActive} />
              </View>

              {/* Submit Button */}
              <Button
                title={editingOfferId ? 'Update Promotion Offer' : 'Save Promotion Offer'}
                loading={createMutation.isPending || updateMutation.isPending}
                style={{ marginTop: 18 }}
                onPress={handleSaveOffer}
              />
            </ScrollView>
          </SheetGlass>
        </KeyboardAvoidingView>
      </Modal>

      {/* OFFER DETAILS & ACTIONS SHEET */}
      <Modal
        visible={!!selectedOffer}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOffer(null)}
      >
        <View style={styles.modalBackdrop}>
          <SheetGlass>
            {selectedOffer ? (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Offer Details
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedOffer(null)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.modalCloseBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </Pressable>
                </View>

                {/* Offer Headline Box */}
                <View style={styles.detailHeadlineBox}>
                  <View
                    style={[
                      styles.detailDiscountBadge,
                      {
                        backgroundColor: selectedOffer.isActive
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'rgba(255, 255, 255, 0.06)',
                        borderColor: selectedOffer.isActive ? '#10B981' : colors.textTertiary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.detailDiscountText,
                        { color: selectedOffer.isActive ? '#10B981' : colors.textTertiary },
                      ]}
                    >
                      {selectedOffer.discountPercent
                        ? `${selectedOffer.discountPercent}% OFF`
                        : `Rs ${selectedOffer.discountAmountPkr} OFF`}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailOfferTitle, { color: colors.text }]}>
                      {selectedOffer.title}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Badge
                        label={selectedOffer.isActive ? 'Active' : 'Inactive'}
                        variant={selectedOffer.isActive ? 'active' : 'expired'}
                        size="sm"
                      />
                      {selectedOffer.autoSuggest ? (
                        <Badge label="Auto Apply" variant="pending" size="sm" />
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Info List Card */}
                <View style={styles.detailsListCard}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Discount Rate
                    </Text>
                    <Text style={[styles.detailRowValue, { color: colors.text, fontWeight: '700' }]}>
                      {selectedOffer.discountPercent
                        ? `${selectedOffer.discountPercent}% off fee`
                        : formatPkr(selectedOffer.discountAmountPkr || 0)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Validity Period
                    </Text>
                    <Text style={[styles.detailRowValue, { color: colors.text }]}>
                      {formatDate(selectedOffer.validFrom)} → {formatDate(selectedOffer.validTo)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Applicable Plans
                    </Text>
                    <Text
                      style={[styles.detailRowValue, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {selectedOffer.planIds && selectedOffer.planIds.length > 0
                        ? `${selectedOffer.planIds.length} Membership Plans`
                        : 'All Plans'}
                    </Text>
                  </View>

                  {selectedOffer.description ? (
                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                        Notes
                      </Text>
                      <Text
                        style={[
                          styles.detailRowValue,
                          { color: colors.textSecondary, flex: 1, textAlign: 'right' },
                        ]}
                      >
                        {selectedOffer.description}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Liquid Glass Action Pill Buttons */}
                <View style={styles.quickActionsRow}>
                  {/* Status Toggle Button */}
                  <Pressable
                    onPress={() => toggleOfferStatus(selectedOffer)}
                    style={({ pressed }) => [
                      styles.actionPillBtn,
                      {
                        backgroundColor: selectedOffer.isActive
                          ? isDark
                            ? 'rgba(239, 68, 68, 0.14)'
                            : 'rgba(239, 68, 68, 0.10)'
                          : isDark
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'rgba(16, 185, 129, 0.10)',
                        borderColor: selectedOffer.isActive ? '#EF4444' : '#10B981',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedOffer.isActive ? 'pause-circle' : 'play-circle'}
                      size={15}
                      color={selectedOffer.isActive ? '#EF4444' : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.actionPillText,
                        { color: selectedOffer.isActive ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      {selectedOffer.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>

                  {/* Edit Button */}
                  <Pressable
                    onPress={() => openEditModal(selectedOffer)}
                    style={({ pressed }) => [
                      styles.actionPillBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(45, 212, 191, 0.14)'
                          : 'rgba(15, 118, 110, 0.10)',
                        borderColor: isDark ? '#2DD4BF' : '#0F766E',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={isDark ? '#2DD4BF' : '#0F766E'}
                    />
                    <Text
                      style={[
                        styles.actionPillText,
                        { color: isDark ? '#2DD4BF' : '#0F766E' },
                      ]}
                    >
                      Edit Offer
                    </Text>
                  </Pressable>

                  {/* Delete Button */}
                  <Pressable
                    onPress={() => confirmDelete(selectedOffer)}
                    style={({ pressed }) => [
                      styles.actionPillBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239, 68, 68, 0.14)'
                          : 'rgba(239, 68, 68, 0.10)',
                        borderColor: '#EF4444',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text style={[styles.actionPillText, { color: '#EF4444' }]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </SheetGlass>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 82,
    gap: 12,
  },
  discountBadgeRing: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.24,
  },
  badgeChip: {
    flexShrink: 0,
  },
  desc: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  validityText: {
    fontSize: 11.5,
  },
  chevron: {
    marginLeft: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  typeSegmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeSegmentText: {
    fontSize: 13,
  },
  rangePreviewText: {
    fontSize: 11.5,
    marginTop: 6,
    fontStyle: 'italic',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  detailHeadlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  detailDiscountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  detailDiscountText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailOfferTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailsListCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailRowLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  detailRowValue: {
    fontSize: 13,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  actionPillBtn: {
    flex: 1,
    minWidth: 95,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  addOfferBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
