import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassSelect, type GlassSelectOption } from '@/src/components/ui/GlassSelect';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { staffApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import type { Role, StaffMember } from '@/src/api/types';

export default function StaffScreen() {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();

  // Search and Filter State
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State for Add / Edit (Only 5 fields: Name, Mobile, Designation, Status, Salary)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designations, setDesignations] = useState<string[]>([
    'Trainer',
    'Manager',
    'Receptionist',
    'Cleaner',
    'Accountant',
    'Physiotherapist',
  ]);
  const [designation, setDesignation] = useState('Trainer');
  const [showNewDesInput, setShowNewDesInput] = useState(false);
  const [newDesText, setNewDesText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [salary, setSalary] = useState('');

  // Dropdown options for designations
  const designationOptions = useMemo<GlassSelectOption[]>(() => {
    const list = Array.from(new Set([...designations, designation].filter(Boolean)));
    return list.map((d) => ({
      value: d,
      label: d,
    }));
  }, [designations, designation]);

  const handleAddNewDesignation = () => {
    const trimmed = newDesText.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a designation title.');
      return;
    }
    if (!designations.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      setDesignations((prev) => [...prev, trimmed]);
    }
    setDesignation(trimmed);
    setNewDesText('');
    setShowNewDesInput(false);
  };

  // Detail / Action sheet state
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Queries
  const query = useInfiniteQuery({
    queryKey: ['staff', q, statusFilter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      staffApi.list({
        q: q || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: pageParam,
        pageSize: 15,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const staffList = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<StaffMember>) => staffApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Staff member added successfully.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffMember> }) =>
      staffApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setModalVisible(false);
      if (selectedStaff && selectedStaff.id === updated.id) {
        setSelectedStaff(updated);
      }
      resetForm();
      Alert.alert('Updated', 'Staff member updated successfully.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const salaryMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'unpaid' }) =>
      staffApi.setSalary(id, status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      if (selectedStaff && selectedStaff.id === updated.id) {
        setSelectedStaff(updated);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: staffApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setSelectedStaff(null);
      Alert.alert('Removed', 'Staff member removed.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const resetForm = () => {
    setEditingStaffId(null);
    setName('');
    setPhone('');
    setDesignation('Trainer');
    setShowNewDesInput(false);
    setNewDesText('');
    setIsActive(true);
    setSalary('');
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaffId(staff.id);
    setName(staff.name);
    setPhone(staff.phone);
    const des = staff.designation || (staff.role ? staff.role.charAt(0).toUpperCase() + staff.role.slice(1) : 'Trainer');
    setDesignation(des);
    setShowNewDesInput(false);
    setNewDesText('');
    setIsActive(staff.isActive !== false);
    setSalary(staff.salaryPkr ? String(staff.salaryPkr) : '');
    setSelectedStaff(null);
    setModalVisible(true);
  };

  const handleSaveStaff = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter staff name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter mobile number.');
      return;
    }

    // Map designation to closest system role
    const desLower = designation.toLowerCase();
    let role: Exclude<Role, 'member'> = 'trainer';
    if (desLower.includes('manager') || desLower.includes('owner')) role = 'manager';
    else if (desLower.includes('reception') || desLower.includes('front')) role = 'receptionist';

    const payload: Partial<StaffMember> = {
      name: name.trim(),
      phone: phone.trim(),
      designation: designation.trim() || 'Staff',
      role,
      isActive,
      salaryPkr: parseInt(salary, 10) || 0,
      salaryStatus: 'unpaid',
    };

    if (editingStaffId) {
      updateMutation.mutate({ id: editingStaffId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = (staff: StaffMember) => {
    Alert.alert('Remove Staff', `Are you sure you want to remove ${staff.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(staff.id),
      },
    ]);
  };

  // Render individual staff card identical to MemberListCard design
  const renderItem = useCallback(
    ({ item }: { item: StaffMember }) => {
      const active = item.isActive !== false;
      const ringTone = active ? colors.primary : colors.textTertiary;
      const displayDesignation =
        item.designation ||
        (item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : 'Staff');

      return (
        <GlassCard borderRadius={20} style={styles.cardShell}>
          <Pressable
            onPress={() => setSelectedStaff(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${displayDesignation}`}
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
            {/* Avatar Ring */}
            <View
              style={[
                styles.avatarRing,
                {
                  borderColor: isDark ? `${ringTone}55` : `${ringTone}40`,
                  backgroundColor: isDark ? `${ringTone}14` : `${ringTone}10`,
                },
              ]}
            >
              <Avatar name={item.name} uri={item.photoUrl} size={44} />
            </View>

            {/* Info Copy */}
            <View style={styles.copy}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Badge
                  label={active ? 'Active' : 'Inactive'}
                  variant={active ? 'active' : 'expired'}
                  size="sm"
                  style={styles.badgeChip}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name="briefcase-outline"
                  size={12.5}
                  color={isDark ? '#2DD4BF' : '#0F766E'}
                />
                <Text
                  style={[styles.meta, { color: isDark ? '#2DD4BF' : '#0F766E', fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  {displayDesignation}
                </Text>
              </View>

              <View style={styles.subMetaRow}>
                <Text style={[styles.subMetaText, { color: colors.textSecondary }]}>
                  {item.phone || 'No phone'}
                </Text>
                <Text style={[styles.subMetaDot, { color: colors.textTertiary }]}>•</Text>
                <Text style={[styles.salaryText, { color: colors.text }]}>
                  {formatPkr(item.salaryPkr)}
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
      {/* Top Header - Matching Members Page exactly */}
      <View
        style={{
          paddingTop: 6,
          paddingHorizontal: spacing.lg,
          paddingBottom: 4,
        }}
      >
        <PageHeader
          title="Staff"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search staff by name, phone, role..."
          rightSlot={
            <GlassIconButton
              name="person-add"
              accessibilityLabel="Add staff"
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
                label="Inactive"
                size="sm"
                active={statusFilter === 'inactive'}
                onPress={() => setStatusFilter('inactive')}
              />
            </>
          }
        />
      </View>

      {/* Main Staff List */}
      {query.isLoading ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <SkeletonList rows={6} />
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
          data={staffList}
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
              title="No Staff Found"
              subtitle={q ? 'Try a different search query.' : 'Tap "+" to add your first staff member.'}
              actionLabel="Add Staff"
              onAction={openAddModal}
            />
          }
        />
      )}

      {/* ADD / EDIT STAFF MODAL (ONLY 5 FIELDS: Name, Mobile, Designation, Status, Salary) */}
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
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#141E1D' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingStaffId ? 'Edit Staff' : 'Add New Staff'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Fill staff details to save
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
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Field 1: Name */}
              <TextField
                label="Full Name"
                placeholder="e.g. Muhammad Usman"
                value={name}
                onChangeText={setName}
              />

              {/* Field 2: Mobile Number */}
              <TextField
                label="Mobile Number"
                placeholder="e.g. 03001234567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              {/* Field 3: Designation (Dropdown with Plus Icon) */}
              <View style={{ marginBottom: 14 }}>
                <View style={styles.designationHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    DESIGNATION
                  </Text>
                  <Pressable
                    onPress={() => setShowNewDesInput((prev) => !prev)}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.addDesHeaderBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(45, 212, 191, 0.16)'
                          : 'rgba(15, 118, 110, 0.10)',
                        borderColor: isDark
                          ? 'rgba(45, 212, 191, 0.38)'
                          : 'rgba(15, 118, 110, 0.30)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={14} color={isDark ? '#2DD4BF' : '#0F766E'} />
                    <Text
                      style={[
                        styles.addDesHeaderText,
                        { color: isDark ? '#2DD4BF' : '#0F766E' },
                      ]}
                    >
                      {showNewDesInput ? 'Close' : 'New Designation'}
                    </Text>
                  </Pressable>
                </View>

                {/* Inline Add New Designation Box */}
                {showNewDesInput ? (
                  <View
                    style={[
                      styles.inlineNewDesCard,
                      {
                        backgroundColor: isDark
                          ? 'rgba(45, 212, 191, 0.08)'
                          : 'rgba(15, 118, 110, 0.05)',
                        borderColor: isDark
                          ? 'rgba(45, 212, 191, 0.35)'
                          : 'rgba(15, 118, 110, 0.28)',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <TextField
                          placeholder="Type designation (e.g. Physiotherapist)"
                          value={newDesText}
                          onChangeText={setNewDesText}
                          autoFocus
                        />
                      </View>
                      <Pressable
                        onPress={handleAddNewDesignation}
                        style={({ pressed }) => [
                          styles.newDesSubmitBtn,
                          {
                            backgroundColor: isDark ? '#2DD4BF' : '#0F766E',
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* Dropdown with adjacent + Icon button */}
                <View style={styles.dropdownRow}>
                  <View style={{ flex: 1 }}>
                    <GlassSelect
                      placeholder="Select designation..."
                      value={designation}
                      options={designationOptions}
                      onChange={setDesignation}
                      searchable
                      searchPlaceholder="Search designation..."
                    />
                  </View>
                  <Pressable
                    onPress={() => setShowNewDesInput((prev) => !prev)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Add new designation"
                    style={({ pressed }) => [
                      styles.plusIconBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(45, 212, 191, 0.16)'
                          : 'rgba(15, 118, 110, 0.10)',
                        borderColor: isDark
                          ? 'rgba(45, 212, 191, 0.38)'
                          : 'rgba(15, 118, 110, 0.30)',
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={22} color={isDark ? '#2DD4BF' : '#0F766E'} />
                  </Pressable>
                </View>
              </View>

              {/* Field 4: Status (Active / Inactive) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>STATUS</Text>
                <View style={styles.statusSegmentRow}>
                  <Pressable
                    onPress={() => setIsActive(true)}
                    style={({ pressed }) => [
                      styles.statusSegmentBtn,
                      {
                        backgroundColor: isActive
                          ? isDark
                            ? 'rgba(16, 185, 129, 0.20)'
                            : 'rgba(16, 185, 129, 0.14)'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isActive
                          ? '#10B981'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.10)'
                            : 'rgba(0, 0, 0, 0.08)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={isActive ? '#10B981' : colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.statusSegmentText,
                        {
                          color: isActive ? '#10B981' : colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      Active
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsActive(false)}
                    style={({ pressed }) => [
                      styles.statusSegmentBtn,
                      {
                        backgroundColor: !isActive
                          ? isDark
                            ? 'rgba(239, 68, 68, 0.20)'
                            : 'rgba(239, 68, 68, 0.14)'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.03)',
                        borderColor: !isActive
                          ? '#EF4444'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.10)'
                            : 'rgba(0, 0, 0, 0.08)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={!isActive ? '#EF4444' : colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.statusSegmentText,
                        {
                          color: !isActive ? '#EF4444' : colors.textSecondary,
                          fontWeight: !isActive ? '700' : '500',
                        },
                      ]}
                    >
                      Inactive
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Field 5: Salary */}
              <TextField
                label="Salary (PKR)"
                placeholder="e.g. 40000"
                value={salary}
                onChangeText={setSalary}
                keyboardType="numeric"
              />

              {/* Action Button */}
              <Button
                title={editingStaffId ? 'Update Staff Member' : 'Save Staff Member'}
                loading={createMutation.isPending || updateMutation.isPending}
                style={{ marginTop: 14 }}
                onPress={handleSaveStaff}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* STAFF DETAILS & ACTIONS SHEET */}
      <Modal
        visible={!!selectedStaff}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStaff(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#141E1D' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              },
            ]}
          >
            {selectedStaff ? (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Staff Details
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedStaff(null)}
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

                {/* Profile Overview */}
                <View style={styles.detailOverviewBox}>
                  <Avatar name={selectedStaff.name} uri={selectedStaff.photoUrl} size={58} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailStaffName, { color: colors.text }]}>
                      {selectedStaff.name}
                    </Text>
                    <Text
                      style={[
                        styles.detailDesignation,
                        { color: isDark ? '#2DD4BF' : '#0F766E' },
                      ]}
                    >
                      {selectedStaff.designation || selectedStaff.role}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Badge
                        label={selectedStaff.isActive !== false ? 'Active' : 'Inactive'}
                        variant={selectedStaff.isActive !== false ? 'active' : 'expired'}
                        size="sm"
                      />
                      <Badge
                        label={selectedStaff.salaryStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        variant={selectedStaff.salaryStatus === 'paid' ? 'paid' : 'unpaid'}
                        size="sm"
                      />
                    </View>
                  </View>
                </View>

                {/* Details list */}
                <View style={styles.detailsListCard}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Mobile Number
                    </Text>
                    <Text style={[styles.detailRowValue, { color: colors.text }]}>
                      {selectedStaff.phone || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Salary
                    </Text>
                    <Text style={[styles.detailRowValue, { color: colors.text, fontWeight: '700' }]}>
                      {formatPkr(selectedStaff.salaryPkr)}
                    </Text>
                  </View>

                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>
                      Salary Status
                    </Text>
                    <Text
                      style={[
                        styles.detailRowValue,
                        {
                          color: selectedStaff.salaryStatus === 'paid' ? '#10B981' : '#EF4444',
                          fontWeight: '700',
                          textTransform: 'capitalize',
                        },
                      ]}
                    >
                      {selectedStaff.salaryStatus || 'Unpaid'}
                    </Text>
                  </View>
                </View>

                {/* Quick Action Buttons: Call, WhatsApp, Toggle Salary */}
                <View style={styles.quickActionsRow}>
                  {selectedStaff.phone ? (
                    <>
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${selectedStaff.phone}`)}
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
                        <Ionicons name="call" size={15} color={isDark ? '#2DD4BF' : '#0F766E'} />
                        <Text
                          style={[
                            styles.actionPillText,
                            { color: isDark ? '#2DD4BF' : '#0F766E' },
                          ]}
                        >
                          Call
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `whatsapp://send?phone=${selectedStaff.phone.replace(/[^0-9]/g, '')}`,
                          )
                        }
                        style={({ pressed }) => [
                          styles.actionPillBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(37, 211, 102, 0.14)'
                              : 'rgba(37, 211, 102, 0.10)',
                            borderColor: '#25D366',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                        <Text style={[styles.actionPillText, { color: '#25D366' }]}>
                          WhatsApp
                        </Text>
                      </Pressable>
                    </>
                  ) : null}

                  <Pressable
                    onPress={() =>
                      salaryMutation.mutate({
                        id: selectedStaff.id,
                        status: selectedStaff.salaryStatus === 'paid' ? 'unpaid' : 'paid',
                      })
                    }
                    style={({ pressed }) => [
                      styles.actionPillBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(245, 158, 11, 0.10)',
                        borderColor: '#F59E0B',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selectedStaff.salaryStatus === 'paid' ? 'close-circle' : 'cash'}
                      size={15}
                      color="#F59E0B"
                    />
                    <Text style={[styles.actionPillText, { color: '#F59E0B' }]}>
                      {selectedStaff.salaryStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                    </Text>
                  </Pressable>
                </View>

                {/* Edit & Delete Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Button
                    title="Edit Staff"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => openEditModal(selectedStaff)}
                  />
                  <Button
                    title="Remove"
                    variant="danger"
                    style={{ flex: 1 }}
                    onPress={() => confirmDelete(selectedStaff)}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 76,
    gap: 12,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
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
  meta: {
    fontSize: 13,
    letterSpacing: -0.08,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  subMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  subMetaDot: {
    fontSize: 12,
  },
  salaryText: {
    fontSize: 12,
    fontWeight: '700',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  designationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addDesHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  addDesHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineNewDesCard: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  newDesSubmitBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSegmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusSegmentText: {
    fontSize: 13,
  },
  detailOverviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  detailStaffName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  detailDesignation: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
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
    marginTop: 14,
  },
  actionPillBtn: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
