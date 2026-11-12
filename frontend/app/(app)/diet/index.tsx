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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassSelect, type GlassSelectOption } from '@/src/components/ui/GlassSelect';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { dietApi, membersApi } from '@/src/api/endpoints';
import { useAuthStore } from '@/src/store/auth-store';
import type { DietMeal, DietTemplate } from '@/src/api/types';

type MealInput = {
  name: string;
  notes: string;
  calories: string;
  proteinG: string;
};

const DEFAULT_NEW_MEALS: MealInput[] = [
  { name: 'Breakfast', notes: '4 Boiled Eggs, 60g Oatmeal with milk, 1 Banana', calories: '450', proteinG: '30' },
  { name: 'Lunch', notes: '150g Grilled Chicken Breast, 1 cup Rice, Mixed Green Salad', calories: '550', proteinG: '45' },
  { name: 'Evening Snack', notes: '1 Scoop Whey Protein, 10 Almonds, 1 Apple', calories: '220', proteinG: '25' },
  { name: 'Dinner', notes: '180g Baked Fish or Lean Beef, Steamed Veggies, Lentils', calories: '480', proteinG: '40' },
];

export default function DietScreen() {
  const { colors, spacing, radii, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [searchQuery, setSearchQuery] = useState('');

  // Assignment section state
  const memberScope = user?.role === 'member' ? user.memberId : undefined;
  const [selectedMemberId, setSelectedMemberId] = useState(memberScope || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Template modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<DietTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [templateMeals, setTemplateMeals] = useState<MealInput[]>(DEFAULT_NEW_MEALS);

  // Queries
  const templatesQ = useQuery({ queryKey: ['diet-templates'], queryFn: dietApi.templates });
  const membersQ = useQuery({
    queryKey: ['members', 'all'],
    queryFn: () => membersApi.list({ pageSize: 100 }),
    enabled: user?.role !== 'member',
  });

  // Options for Member & Template Selects
  const memberOptions = useMemo<GlassSelectOption[]>(() => {
    return (membersQ.data?.items || []).map((m) => ({
      value: m.id,
      label: m.name,
      hint: `${m.planName} · ${m.phone || 'No phone'}`,
    }));
  }, [membersQ.data?.items]);

  const templateOptions = useMemo<GlassSelectOption[]>(() => {
    return (templatesQ.data || []).map((t) => {
      const totalCals = t.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
      return {
        value: t.id,
        label: t.name,
        hint: `${totalCals > 0 ? `${totalCals} kcal · ` : ''}${t.meals.length} meals`,
      };
    });
  }, [templatesQ.data]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: dietApi.assign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diet-assignments'] });
      setSelectedMemberId('');
      Alert.alert('Diet Assigned', 'Diet plan has been assigned to the member.');
    },
    onError: (err: Error) => Alert.alert('Assignment Failed', err.message),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: Partial<DietTemplate>) => dietApi.createTemplate(data),
    onSuccess: (newTpl) => {
      qc.invalidateQueries({ queryKey: ['diet-templates'] });
      setShowCreateModal(false);
      resetTemplateForm();
      setSelectedTemplateId(newTpl.id);
      Alert.alert('Template Saved', `"${newTpl.name}" is now saved in your diet library.`);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: dietApi.deleteTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diet-templates'] });
      if (detailTemplate) setDetailTemplate(null);
    },
  });

  const resetTemplateForm = () => {
    setTplName('');
    setTplDescription('');
    setTemplateMeals(DEFAULT_NEW_MEALS);
  };

  const handleMealChange = (index: number, field: keyof MealInput, val: string) => {
    setTemplateMeals((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleAddMealRow = () => {
    setTemplateMeals((prev) => [
      { name: '', notes: '', calories: '', proteinG: '' },
      ...prev,
    ]);
  };

  const handleRemoveMealRow = (index: number) => {
    if (templateMeals.length <= 1) {
      Alert.alert('Warning', 'A diet plan must contain at least one meal.');
      return;
    }
    setTemplateMeals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = () => {
    if (!tplName.trim()) {
      Alert.alert('Required', 'Please enter a name for the diet template.');
      return;
    }
    const mealsData: DietMeal[] = templateMeals.map((m, idx) => ({
      id: `meal_${Date.now()}_${idx}`,
      name: m.name.trim() || `Meal ${idx + 1}`,
      notes: m.notes.trim() || undefined,
      calories: parseInt(m.calories, 10) || 0,
      proteinG: parseInt(m.proteinG, 10) || 0,
      carbsG: 0,
      fatsG: 0,
    }));

    createTemplateMutation.mutate({
      name: tplName.trim(),
      description: tplDescription.trim() || 'Custom Nutrition Plan',
      meals: mealsData,
    });
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    Alert.alert('Delete Template', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTemplateMutation.mutate(id),
      },
    ]);
  };

  const filteredTemplates = useMemo(() => {
    const list = templatesQ.data || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.meals.some((m) => m.name.toLowerCase().includes(q) || m.notes?.toLowerCase().includes(q)),
    );
  }, [templatesQ.data, searchQuery]);

  return (
    <Screen padded={false}>
      {/* Top Header - Single unified liquid glass header */}
      <View
        style={{
          paddingTop: 6,
          paddingHorizontal: spacing.lg,
          paddingBottom: 4,
        }}
      >
        <PageHeader
          title="Diet & Nutrition"
          showBack
          showFilter={false}
          showSearch={true}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search diet templates..."
          rightSlot={
            <GlassIconButton
              name="add"
              onPress={() => {
                resetTemplateForm();
                setShowCreateModal(true);
              }}
            />
          }
        />
      </View>

      {/* Main Content Area */}
      {templatesQ.isLoading ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <SkeletonList rows={5} />
        </View>
      ) : templatesQ.isError ? (
        <ErrorView
          message={(templatesQ.error as Error)?.message || 'Failed to load nutrition plans'}
          onRetry={() => {
            void templatesQ.refetch();
          }}
        />
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={templatesQ.isRefetching}
              onRefresh={() => {
                void templatesQ.refetch();
              }}
            />
          }
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 8,
            paddingBottom: 100,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            user?.role !== 'member' ? (
              <View style={{ marginBottom: 16 }}>
                {/* Quick Assign Card */}
                <GlassCard borderRadius={22} style={{ marginBottom: 16 }}>
                  <View style={styles.assignCard}>
                    <View style={styles.assignHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="sparkles" size={17} color={isDark ? '#2DD4BF' : '#0F766E'} />
                        <Text style={[styles.assignCardTitle, { color: colors.text }]}>
                          Assign Diet to Member
                        </Text>
                      </View>
                      <Badge label="Quick Assign" variant="pending" size="sm" />
                    </View>

                    <Text style={[styles.assignCardSubtitle, { color: colors.textSecondary }]}>
                      Pick template, search member, and assign meal plan directly.
                    </Text>

                    {/* Template Dropdown */}
                    <View style={{ marginTop: 12 }}>
                      <GlassSelect
                        label="1. Choose Diet Template"
                        placeholder="Select template (e.g. Fat Loss, Bulking)..."
                        value={selectedTemplateId}
                        options={templateOptions}
                        onChange={setSelectedTemplateId}
                      />
                    </View>

                    {/* Searchable Member Dropdown */}
                    <View style={{ marginTop: 10 }}>
                      <GlassSelect
                        label="2. Search Member"
                        placeholder="Search member by name or phone..."
                        value={selectedMemberId}
                        options={memberOptions}
                        searchable
                        searchPlaceholder="Type member name to filter..."
                        onChange={setSelectedMemberId}
                      />
                    </View>

                    {/* Submit Button */}
                    <Button
                      title="Assign Diet Plan"
                      disabled={!selectedMemberId || !selectedTemplateId}
                      loading={assignMutation.isPending}
                      style={{ marginTop: 14 }}
                      onPress={() =>
                        assignMutation.mutate({
                          memberId: selectedMemberId,
                          templateId: selectedTemplateId,
                        })
                      }
                    />
                  </View>
                </GlassCard>

                {/* Section Title */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeadingTitle, { color: colors.text }]}>
                    DIET TEMPLATES
                  </Text>
                  <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
                    {filteredTemplates.length} Plans
                  </Text>
                </View>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyView
              title="No Diet Templates"
              subtitle="Tap '+' in top header to create your first reusable diet plan."
            />
          }
          renderItem={({ item }) => {
            const totalCalories = item.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
            const totalProtein = item.meals.reduce((sum, m) => sum + (m.proteinG || 0), 0);

            return (
              <GlassCard borderRadius={20} style={{ marginBottom: 12 }}>
                <Pressable
                  onPress={() => setDetailTemplate(item)}
                  style={({ pressed }) => [
                    styles.templateCardCompact,
                    { opacity: pressed ? 0.78 : 1 },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.templateTitleRow}>
                      <Text style={[styles.tplName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {/* Delete button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(item.id, item.name);
                        }}
                        hitSlop={8}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </Pressable>
                    </View>

                    {/* Macro Pills */}
                    <View style={styles.macroPillRow}>
                      {totalCalories > 0 ? (
                        <View
                          style={[
                            styles.macroPill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.05)',
                            },
                          ]}
                        >
                          <Ionicons name="flame-outline" size={13} color="#F59E0B" />
                          <Text style={[styles.macroPillText, { color: colors.text }]}>
                            {totalCalories} kcal
                          </Text>
                        </View>
                      ) : null}

                      {totalProtein > 0 ? (
                        <View
                          style={[
                            styles.macroPill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.05)',
                            },
                          ]}
                        >
                          <Ionicons name="fitness-outline" size={13} color="#10B981" />
                          <Text style={[styles.macroPillText, { color: colors.text }]}>
                            {totalProtein}g Protein
                          </Text>
                        </View>
                      ) : null}

                      <View
                        style={[
                          styles.macroPill,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        ]}
                      >
                        <Ionicons name="restaurant-outline" size={13} color={colors.textSecondary} />
                        <Text style={[styles.macroPillText, { color: colors.textSecondary }]}>
                          {item.meals.length} Meals
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.chevronWrap}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </View>
                </Pressable>
              </GlassCard>
            );
          }}
        />
      )}

      {/* TEMPLATE DETAIL MODAL (Opens on Card Click) */}
      <Modal
        visible={!!detailTemplate}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailTemplate(null)}
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
            {detailTemplate ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                      {detailTemplate.name}
                    </Text>
                    {detailTemplate.description ? (
                      <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                        {detailTemplate.description}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setDetailTemplate(null)}
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
                  {/* Detailed Meals Breakdown */}
                  <View style={styles.templateMealsList}>
                    {detailTemplate.meals.map((meal) => (
                      <View
                        key={meal.id}
                        style={[
                          styles.mealDetailBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.025)',
                            borderColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.06)',
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.mealDetailTitle, { color: colors.text }]}>
                            {meal.name}
                          </Text>
                          {meal.calories > 0 ? (
                            <Text style={[styles.mealDetailCals, { color: colors.textSecondary }]}>
                              {meal.calories} kcal · {meal.proteinG || 0}g protein
                            </Text>
                          ) : null}
                        </View>
                        {meal.notes ? (
                          <Text style={[styles.mealDetailNotes, { color: colors.textSecondary }]}>
                            {meal.notes}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>

                  <Button
                    title="Select & Assign this Template"
                    style={{ marginTop: 16 }}
                    onPress={() => {
                      setSelectedTemplateId(detailTemplate.id);
                      setDetailTemplate(null);
                    }}
                  />
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* CREATE DIET TEMPLATE MODAL */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Diet Plan</Text>
              </View>
              <Pressable
                onPress={() => setShowCreateModal(false)}
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
              <TextField
                label="Plan Name"
                placeholder="e.g. Fat Loss & Lean Cut"
                value={tplName}
                onChangeText={setTplName}
              />

              <TextField
                label="Description (Optional)"
                placeholder="e.g. High protein, clean carbs & healthy fats"
                value={tplDescription}
                onChangeText={setTplDescription}
              />

              {/* Meals List */}
              <View style={styles.mealsHeaderSection}>
                <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                  MEALS
                </Text>
                <Pressable
                  onPress={handleAddMealRow}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.addMealPillBtn,
                    {
                      backgroundColor: isDark ? 'rgba(45, 212, 191, 0.16)' : 'rgba(15, 118, 110, 0.10)',
                      borderColor: isDark ? 'rgba(45, 212, 191, 0.38)' : 'rgba(15, 118, 110, 0.30)',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add" size={15} color={isDark ? '#2DD4BF' : '#0F766E'} />
                  <Text style={[styles.addMealPillText, { color: isDark ? '#2DD4BF' : '#0F766E' }]}>
                    Add Meal
                  </Text>
                </Pressable>
              </View>

              {templateMeals.map((meal, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.mealFormCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <View style={styles.mealFormHeader}>
                    <Text style={[styles.mealFormNumber, { color: colors.textSecondary }]}>
                      {meal.name.trim() || `Meal #${idx + 1}`}
                    </Text>
                    {templateMeals.length > 1 ? (
                      <Pressable
                        onPress={() => handleRemoveMealRow(idx)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.removeMealBtn,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.10)',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="close" size={14} color="#EF4444" />
                      </Pressable>
                    ) : null}
                  </View>

                  <TextField
                    label="Meal Name"
                    placeholder="e.g. Breakfast, Lunch, Dinner, Snack"
                    value={meal.name}
                    onChangeText={(val) => handleMealChange(idx, 'name', val)}
                  />

                  <TextField
                    label="Food Items"
                    placeholder="e.g. 4 Boiled Eggs, 60g Oatmeal with milk, 1 Banana"
                    value={meal.notes}
                    onChangeText={(val) => handleMealChange(idx, 'notes', val)}
                    multiline
                    numberOfLines={2}
                  />

                  <View style={styles.macroInputsRow}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Calories"
                        placeholder="450"
                        keyboardType="numeric"
                        value={meal.calories}
                        onChangeText={(val) => handleMealChange(idx, 'calories', val)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Protein (g)"
                        placeholder="30"
                        keyboardType="numeric"
                        value={meal.proteinG}
                        onChangeText={(val) => handleMealChange(idx, 'proteinG', val)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <Button
                title="Save Diet Template"
                loading={createTemplateMutation.isPending}
                style={{ marginTop: 16 }}
                onPress={handleSaveTemplate}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assignCard: {
    padding: 16,
  },
  assignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  assignCardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  sectionHeadingTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  templateCardCompact: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chevronWrap: {
    paddingLeft: 4,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tplName: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  macroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  macroPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  templateMealsList: {
    gap: 8,
    marginTop: 4,
  },
  mealDetailBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  mealDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  mealDetailCals: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  mealDetailNotes: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
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
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  mealsHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addMealPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  addMealPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mealFormCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  mealFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  removeMealBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealFormNumber: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
