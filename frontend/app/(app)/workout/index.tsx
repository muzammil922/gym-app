import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { workoutApi } from '@/src/api/endpoints';
import { weekdayKey } from '@/src/utils/date';
import type { Weekday, WorkoutDay, WorkoutPlan } from '@/src/api/types';

const DAYS: { key: Weekday; label: string; full: string }[] = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
];

const MUSCLE_SUGGESTIONS = [
  'Chest',
  'Back',
  'Shoulders',
  'Legs',
  'Quads',
  'Hamstrings',
  'Biceps',
  'Triceps',
  'Core',
  'Cardio',
];

export default function WorkoutScreen() {
  const { colors, spacing, radii, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const currentDay = weekdayKey() as Weekday;
  const [selectedDay, setSelectedDay] = useState<Weekday>(currentDay || 'mon');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDayEditModal, setShowDayEditModal] = useState(false);

  // Add exercise form state
  const [targetDay, setTargetDay] = useState<Weekday>(selectedDay);
  const [exName, setExName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('Chest');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10-12');
  const [restSec, setRestSec] = useState('60');
  const [instructions, setInstructions] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [videoUri, setVideoUri] = useState<string | undefined>();

  // Day title / notes edit form state
  const [dayTitleInput, setDayTitleInput] = useState('');
  const [dayNotesInput, setDayNotesInput] = useState('');

  const plansQ = useQuery({ queryKey: ['workout-plans'], queryFn: workoutApi.plans });

  const activePlan: WorkoutPlan | undefined = useMemo(() => {
    return plansQ.data?.[0];
  }, [plansQ.data]);

  const activeDayObj: WorkoutDay | undefined = useMemo(() => {
    return activePlan?.days.find((d) => d.day === selectedDay);
  }, [activePlan, selectedDay]);

  const selectedDayMeta = useMemo(
    () => DAYS.find((d) => d.key === selectedDay),
    [selectedDay],
  );

  const exercises = activeDayObj?.exercises || [];

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const q = searchQuery.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.exerciseName.toLowerCase().includes(q) ||
        ex.muscleGroup?.toLowerCase().includes(q) ||
        ex.instructions?.toLowerCase().includes(q),
    );
  }, [exercises, searchQuery]);

  // Mutations
  const addExerciseMutation = useMutation({
    mutationFn: workoutApi.addExerciseToDay,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-plans'] });
      setShowAddModal(false);
      resetExerciseForm();
      Alert.alert('Success', 'Exercise added to routine.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: ({ day, index }: { day: Weekday; index: number }) => {
      if (!activePlan) throw new Error('No active plan');
      return workoutApi.deleteDayExercise(activePlan.id, day, index);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-plans'] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const updateDayNotesMutation = useMutation({
    mutationFn: async ({
      title,
      notes,
    }: {
      title: string;
      notes: string;
    }) => {
      if (!activePlan) throw new Error('No active plan');
      const updatedDays = activePlan.days.map((d) => {
        if (d.day === selectedDay) {
          return { ...d, title: title.trim(), notes: notes.trim() };
        }
        return d;
      });
      return workoutApi.updatePlan(activePlan.id, { days: updatedDays });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-plans'] });
      setShowDayEditModal(false);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const resetExerciseForm = () => {
    setExName('');
    setMuscleGroup('Chest');
    setSets('3');
    setReps('10-12');
    setRestSec('60');
    setInstructions('');
    setImageUri(undefined);
    setVideoUri(undefined);
  };

  const handleOpenAdd = () => {
    setTargetDay(selectedDay);
    resetExerciseForm();
    setShowAddModal(true);
  };

  const handleOpenDayEdit = () => {
    setDayTitleInput(activeDayObj?.title || '');
    setDayNotesInput(activeDayObj?.notes || '');
    setShowDayEditModal(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access required to upload exercise image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setImageUri(res.assets[0].uri);
    }
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Media library access required to upload exercise video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setVideoUri(res.assets[0].uri);
    }
  };

  const handleSaveExercise = () => {
    if (!exName.trim()) {
      Alert.alert('Required', 'Please enter exercise name.');
      return;
    }
    addExerciseMutation.mutate({
      planId: activePlan?.id,
      day: targetDay,
      exercise: {
        exerciseName: exName.trim(),
        muscleGroup: muscleGroup.trim(),
        sets: parseInt(sets, 10) || 3,
        reps: reps.trim() || '10-12',
        restSec: parseInt(restSec, 10) || 60,
        instructions: instructions.trim() || undefined,
        imageUrl: imageUri,
        videoUrl: videoUri,
      },
    });
  };

  const handleDeleteExercise = (index: number, name: string) => {
    Alert.alert('Delete Exercise', `Remove "${name}" from ${selectedDay.toUpperCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExerciseMutation.mutate({ day: selectedDay, index }),
      },
    ]);
  };

  return (
    <Screen padded={false}>
      {/* Top Header - Single unified header with filter removed */}
      <View
        style={{
          paddingTop: 6,
          paddingHorizontal: spacing.lg,
          paddingBottom: 4,
        }}
      >
        <PageHeader
          title="Workout Plans"
          showBack
          showFilter={false}
          showSearch={true}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search exercises..."
          rightSlot={<GlassIconButton name="add" onPress={handleOpenAdd} />}
        />
      </View>

      {plansQ.isLoading ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <SkeletonList rows={5} />
        </View>
      ) : plansQ.isError ? (
        <ErrorView
          message={(plansQ.error as Error).message}
          onRetry={() => {
            void plansQ.refetch();
          }}
        />
      ) : (
        <>
          {/* Day Selector Tabs (Liquid Glass 1 Line Horizontal) */}
          <View style={styles.daysScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.daysBarContainer, { paddingHorizontal: spacing.lg }]}
        >
          {DAYS.map((d) => {
            const isSelected = selectedDay === d.key;
            const isToday = currentDay === d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => setSelectedDay(d.key)}
                style={({ pressed }) => [
                  styles.dayPill,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(45, 212, 191, 0.22)'
                        : 'rgba(15, 118, 110, 0.16)'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isSelected
                      ? isDark
                        ? '#2DD4BF'
                        : '#0F766E'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.08)',
                    borderTopColor: isSelected
                      ? isDark
                        ? '#5EEAD4'
                        : '#14B8A6'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.25)'
                        : 'rgba(255, 255, 255, 0.85)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    {
                      color: isSelected
                        ? isDark
                          ? '#2DD4BF'
                          : '#0F766E'
                        : colors.textSecondary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {d.label}
                </Text>
                {isToday ? (
                  <View
                    style={[
                      styles.todayDot,
                      { backgroundColor: isSelected ? (isDark ? '#2DD4BF' : '#0F766E') : '#10B981' },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Exercises List for Selected Day */}
      <FlatList
        data={filteredExercises}
        keyExtractor={(_, index) => `${selectedDay}_${index}`}
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={plansQ.isRefetching}
            onRefresh={() => {
              void plansQ.refetch();
            }}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 8,
          paddingBottom: 16,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            {/* Day Title & Notes Banner */}
            <GlassCard borderRadius={18} style={{ marginBottom: 14 }}>
              <View style={styles.dayHeaderCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.dayFullTitle, { color: colors.text }]}>
                      {activeDayObj?.title || `${selectedDayMeta?.full} Routine`}
                    </Text>
                    <Badge
                      label={`${exercises.length} Ex`}
                      variant={exercises.length > 0 ? 'active' : 'neutral'}
                      size="sm"
                    />
                  </View>
                  {activeDayObj?.notes ? (
                    <Text style={[styles.dayNotesText, { color: colors.textSecondary }]}>
                      {activeDayObj.notes}
                    </Text>
                  ) : (
                    <Text style={[styles.dayNotesEmpty, { color: colors.textTertiary }]}>
                      No specific notes added for {selectedDayMeta?.full}. Tap edit to add instructions.
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={handleOpenDayEdit}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.editNotesBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.05)',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            </GlassCard>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyView
              title={`No exercises on ${selectedDayMeta?.full}`}
              subtitle="Rest day or active recovery. Tap below to add exercises to this day."
            />
            <Button
              title={`+ Add Exercise to ${selectedDayMeta?.label}`}
              style={{ marginTop: 12, alignSelf: 'center', minWidth: 220 }}
              onPress={handleOpenAdd}
            />
          </View>
        }
        renderItem={({ item, index }) => (
          <GlassCard borderRadius={20} style={{ marginBottom: 12 }}>
            <View style={styles.exerciseCard}>
              {/* Image Preview (if present) */}
              {item.imageUrl ? (
                <View style={styles.mediaContainer}>
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.exerciseImage}
                    resizeMode="cover"
                  />
                  <View style={styles.mediaOverlayBadge}>
                    <Ionicons name="image-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.mediaBadgeText}>Photo</Text>
                  </View>
                </View>
              ) : null}

              {/* Video Badge (if present) */}
              {item.videoUrl ? (
                <View
                  style={[
                    styles.videoBadgeRow,
                    {
                      backgroundColor: isDark
                        ? 'rgba(6, 182, 212, 0.16)'
                        : 'rgba(8, 145, 178, 0.12)',
                      borderColor: isDark
                        ? 'rgba(6, 182, 212, 0.40)'
                        : 'rgba(8, 145, 178, 0.30)',
                    },
                  ]}
                >
                  <Ionicons name="videocam" size={16} color={isDark ? '#22D3EE' : '#0891B2'} />
                  <Text
                    style={[
                      styles.videoBadgeText,
                      { color: isDark ? '#22D3EE' : '#0891B2' },
                    ]}
                  >
                    Video Demo Attached
                  </Text>
                </View>
              ) : null}

              {/* Title & Muscle Row */}
              <View style={styles.exerciseHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.exTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.exerciseName}
                  </Text>
                  {item.muscleGroup ? (
                    <Text style={[styles.exMuscle, { color: colors.textSecondary }]}>
                      Target: {item.muscleGroup}
                    </Text>
                  ) : null}
                </View>

                {/* Delete button */}
                <Pressable
                  onPress={() => handleDeleteExercise(index, item.exerciseName)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>

              {/* Sets, Reps & Rest Tags */}
              <View style={styles.tagsRow}>
                <View
                  style={[
                    styles.tagBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Ionicons name="barbell-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.tagText, { color: colors.text }]}>
                    {item.sets} Sets × {item.reps}
                  </Text>
                </View>

                {item.restSec ? (
                  <View
                    style={[
                      styles.tagBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Ionicons name="timer-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      Rest {item.restSec}s
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Instructions / Guidance text */}
              {item.instructions ? (
                <View
                  style={[
                    styles.instructionBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.025)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={colors.textTertiary}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                    {item.instructions}
                  </Text>
                </View>
              ) : null}
            </View>
          </GlassCard>
        )}
      />
        </>
      )}

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Exercise</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Attach photo, video & instructions
                </Text>
              </View>
              <Pressable
                onPress={() => setShowAddModal(false)}
                hitSlop={10}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Day Selector in Modal */}
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Select Day</Text>
              <View style={styles.modalDayRow}>
                {DAYS.map((d) => (
                  <Pressable
                    key={d.key}
                    onPress={() => setTargetDay(d.key)}
                    style={[
                      styles.modalDayBtn,
                      {
                        backgroundColor: targetDay === d.key
                          ? (isDark ? '#2DD4BF' : '#0F766E')
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalDayBtnText,
                        {
                          color: targetDay === d.key
                            ? (isDark ? '#0F1A19' : '#FFFFFF')
                            : colors.text,
                          fontWeight: targetDay === d.key ? '700' : '500',
                        },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Exercise Name */}
              <TextField
                label="Exercise Name"
                placeholder="e.g. Incline Dumbbell Press"
                value={exName}
                onChangeText={setExName}
              />

              {/* Muscle Group */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                Target Muscle
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
                contentContainerStyle={{ gap: 6 }}
              >
                {MUSCLE_SUGGESTIONS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMuscleGroup(m)}
                    style={[
                      styles.muscleChip,
                      {
                        backgroundColor: muscleGroup === m
                          ? (isDark ? 'rgba(45,212,191,0.22)' : 'rgba(15,118,110,0.16)')
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        borderColor: muscleGroup === m
                          ? (isDark ? '#2DD4BF' : '#0F766E')
                          : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.muscleChipText,
                        {
                          color: muscleGroup === m
                            ? (isDark ? '#2DD4BF' : '#0F766E')
                            : colors.textSecondary,
                          fontWeight: muscleGroup === m ? '700' : '500',
                        },
                      ]}
                    >
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Sets & Reps in row */}
              <View style={styles.inputsRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Sets"
                    value={sets}
                    onChangeText={setSets}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Reps"
                    placeholder="e.g. 10-12"
                    value={reps}
                    onChangeText={setReps}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Rest (sec)"
                    value={restSec}
                    onChangeText={setRestSec}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Text Instructions / Guidance */}
              <TextField
                label="Instructions / Guidance (Text)"
                placeholder="e.g. Keep back flat, full stretch at bottom, squeeze chest at top."
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
              />

              {/* Upload Media Section */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Upload Exercise Photo & Video
              </Text>
              <View style={styles.uploadRow}>
                {/* Upload Image */}
                <Pressable
                  onPress={pickImage}
                  style={({ pressed }) => [
                    styles.uploadBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                      borderColor: imageUri
                        ? '#10B981'
                        : isDark
                          ? 'rgba(255,255,255,0.14)'
                          : 'rgba(0,0,0,0.10)',
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={imageUri ? 'checkmark-circle' : 'image-outline'}
                    size={22}
                    color={imageUri ? '#10B981' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.uploadBoxTitle,
                      { color: imageUri ? '#10B981' : colors.text },
                    ]}
                  >
                    {imageUri ? 'Image Selected' : 'Upload Image'}
                  </Text>
                </Pressable>

                {/* Upload Video */}
                <Pressable
                  onPress={pickVideo}
                  style={({ pressed }) => [
                    styles.uploadBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                      borderColor: videoUri
                        ? '#06B6D4'
                        : isDark
                          ? 'rgba(255,255,255,0.14)'
                          : 'rgba(0,0,0,0.10)',
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={videoUri ? 'checkmark-circle' : 'videocam-outline'}
                    size={22}
                    color={videoUri ? '#06B6D4' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.uploadBoxTitle,
                      { color: videoUri ? '#06B6D4' : colors.text },
                    ]}
                  >
                    {videoUri ? 'Video Selected' : 'Upload Video'}
                  </Text>
                </Pressable>
              </View>

              {/* Previews if selected */}
              {imageUri ? (
                <View style={styles.selectedMediaRow}>
                  <Image source={{ uri: imageUri }} style={styles.thumbImage} />
                  <Text style={[styles.selectedMediaText, { color: colors.textSecondary }]}>
                    Photo attached
                  </Text>
                  <Pressable onPress={() => setImageUri(undefined)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              ) : null}

              {videoUri ? (
                <View style={styles.selectedMediaRow}>
                  <Ionicons name="film" size={20} color="#06B6D4" />
                  <Text
                    style={[styles.selectedMediaText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    Video clip attached
                  </Text>
                  <Pressable onPress={() => setVideoUri(undefined)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              ) : null}

              {/* Submit Button */}
              <Button
                title="Add Exercise"
                loading={addExerciseMutation.isPending}
                style={{ marginTop: 20 }}
                onPress={handleSaveExercise}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Day Title & Notes Modal */}
      <Modal
        visible={showDayEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayEditModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheetSmall,
              {
                backgroundColor: isDark ? '#141E1D' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedDayMeta?.full} Routine Text
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Set day focus & text guidance
                </Text>
              </View>
              <Pressable
                onPress={() => setShowDayEditModal(false)}
                hitSlop={10}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <TextField
              label="Day Title / Focus"
              placeholder="e.g. Push Day (Chest & Triceps)"
              value={dayTitleInput}
              onChangeText={setDayTitleInput}
            />

            <TextField
              label="Day Instructions / Guidance (Text)"
              placeholder="e.g. Warm up 5 mins, focus on mind-muscle connection, keep 60-90s rest."
              value={dayNotesInput}
              onChangeText={setDayNotesInput}
              multiline
              numberOfLines={4}
            />

            <Button
              title="Save Day Text"
              loading={updateDayNotesMutation.isPending}
              style={{ marginTop: 16 }}
              onPress={() =>
                updateDayNotesMutation.mutate({
                  title: dayTitleInput,
                  notes: dayNotesInput,
                })
              }
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  daysScrollWrapper: {
    paddingVertical: 8,
  },
  daysBarContainer: {
    gap: 8,
    alignItems: 'center',
  },
  dayPill: {
    minWidth: 54,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayPillText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dayHeaderCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayFullTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dayNotesText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  dayNotesEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  editNotesBtn: {
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  exerciseCard: {
    padding: 14,
  },
  mediaContainer: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#000000',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  mediaOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mediaBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  videoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  videoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  exTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  exMuscle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  instructionText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
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
  modalSheetSmall: {
    margin: 20,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignSelf: 'stretch',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  modalDayRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 14,
  },
  modalDayBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDayBtnText: {
    fontSize: 11,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  muscleChipText: {
    fontSize: 12,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  uploadBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    gap: 6,
  },
  uploadBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  thumbImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  selectedMediaText: {
    flex: 1,
    fontSize: 12,
  },
});
