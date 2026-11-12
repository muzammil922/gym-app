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
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { Badge } from '@/src/components/ui/Badge';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { whatsappApi } from '@/src/api/endpoints';
import type { WhatsAppSettings, WhatsAppTemplate } from '@/src/api/types';

import { isMockMode } from '@/src/api/client';

type SettingKey = keyof Pick<
  WhatsAppSettings,
  | 'enabled'
  | 'providerConnected'
  | 'paymentDetailsInclude'
  | 'gymInfoInclude'
>;

function SettingRow({
  label,
  description,
  value,
  onChange,
  last,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.settingRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <GlassSwitch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function WhatsAppScreen() {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabPad = useFloatingTabBarPad();
  const qc = useQueryClient();

  const settingsQ = useQuery({ queryKey: ['wa-settings'], queryFn: whatsappApi.settings });
  const connectionQ = useQuery({
    queryKey: ['wa-connection'],
    queryFn: whatsappApi.connection,
    enabled: !isMockMode(),
    refetchInterval: (query) => (query.state.data?.connected ? false : 8000),
  });
  const templatesQ = useQuery({ queryKey: ['wa-templates'], queryFn: whatsappApi.templates });

  const update = useMutation({
    mutationFn: whatsappApi.updateSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wa-settings'] });
      void qc.invalidateQueries({ queryKey: ['wa-connection'] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const connectWa = useMutation({
    mutationFn: whatsappApi.connect,
    onSuccess: (conn) => {
      void qc.invalidateQueries({ queryKey: ['wa-settings'] });
      void qc.invalidateQueries({ queryKey: ['wa-connection'] });
      if (conn.qrDataUrl) {
        Alert.alert('Scan QR', 'Open WhatsApp → Linked devices and scan the QR shown in admin.');
      } else if (conn.connected) {
        Alert.alert('Connected', 'WhatsApp provider is connected.');
      }
    },
    onError: (err: Error) => Alert.alert('Connect failed', err.message),
  });

  // Search + filter
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing'>('all');

  // Template sheet state
  const [tplOpen, setTplOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tplKey, setTplKey] = useState('');
  const [tplName, setTplName] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplLanguage, setTplLanguage] = useState('en');

  const saveTemplate = useMutation({
    mutationFn: whatsappApi.saveTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-templates'] });
      setTplOpen(false);
      resetTemplateForm();
      Alert.alert('Saved', 'WhatsApp template saved.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const resetTemplateForm = () => {
    setEditingKey(null);
    setTplKey('');
    setTplName('');
    setTplBody('');
    setTplLanguage('en');
  };

  const openAddTemplate = () => {
    resetTemplateForm();
    setTplOpen(true);
  };

  const openEditTemplate = (tpl: WhatsAppTemplate) => {
    setEditingKey(tpl.key);
    setTplKey(tpl.key);
    setTplName(tpl.name);
    setTplBody(tpl.body);
    setTplLanguage(tpl.language || 'en');
    setTplOpen(true);
  };

  const handleSaveTemplate = () => {
    const key = tplKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key) {
      Alert.alert('Required', 'Please enter a template key.');
      return;
    }
    if (!tplName.trim()) {
      Alert.alert('Required', 'Please enter a template name.');
      return;
    }
    if (!tplBody.trim()) {
      Alert.alert('Required', 'Please enter the message body.');
      return;
    }
    saveTemplate.mutate({
      key,
      name: tplName.trim(),
      body: tplBody.trim(),
      language: tplLanguage.trim() || 'en',
    });
  };

  const patch = (partial: Partial<WhatsAppSettings>) => {
    if (!settingsQ.data) return;
    update.mutate({ ...settingsQ.data, ...partial });
  };

  const templates = useMemo(() => {
    const list = templatesQ.data || [];
    const needle = q.trim().toLowerCase();
    return list.filter((tpl) => {
      if (statusFilter === 'ready' && !tpl.isActive) return false;
      if (statusFilter === 'missing' && tpl.isActive) return false;
      if (!needle) return true;
      return (
        tpl.name.toLowerCase().includes(needle) ||
        tpl.key.toLowerCase().includes(needle) ||
        tpl.body.toLowerCase().includes(needle)
      );
    });
  }, [templatesQ.data, q, statusFilter]);

  if (settingsQ.isLoading) return <SkeletonList />;
  if (settingsQ.isError)
    return (
      <ErrorView
        message={(settingsQ.error as Error).message}
        onRetry={() => {
          void settingsQ.refetch();
        }}
      />
    );

  const s = settingsQ.data!;
  const connection = connectionQ.data;
  const providerConnected = isMockMode() ? s.providerConnected : (connection?.connected ?? s.providerConnected);
  const connectionLabel = connection?.status ?? (providerConnected ? 'connected' : 'disconnected');

  const renderToggle = (key: SettingKey, label: string, description?: string, last?: boolean) => (
    <SettingRow
      label={label}
      description={description}
      value={s[key]}
      onChange={(v) => patch({ [key]: v } as Partial<WhatsAppSettings>)}
      last={last}
    />
  );

  const renderTemplate = ({ item }: { item: WhatsAppTemplate }) => (
    <Pressable
      onPress={() => openEditTemplate(item)}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
      style={{ marginBottom: 10 }}
    >
      <GlassCard borderRadius={20} contentStyle={{ padding: 14 }}>
        <View style={styles.tplHeader}>
          <Text style={[styles.tplName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Badge
            label={item.isActive ? 'Ready' : 'Missing'}
            variant={item.isActive ? 'active' : 'expired'}
            size="sm"
          />
        </View>
        <Text style={[styles.tplKey, { color: colors.textTertiary }]}>
          {item.key} · {item.language}
        </Text>
        <Text style={[styles.tplBody, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
      </GlassCard>
    </Pressable>
  );

  return (
    <Screen padded={false}>
      <View
        style={{
          paddingTop: 6,
          paddingHorizontal: spacing.lg,
          paddingBottom: 4,
        }}
      >
        <PageHeader
          title="WhatsApp"
          showBack
          onBack={() => router.back()}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Search templates..."
          rightSlot={
            <GlassIconButton
              name="add"
              accessibilityLabel="Add template"
              onPress={openAddTemplate}
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
                label="Ready"
                size="sm"
                active={statusFilter === 'ready'}
                onPress={() => setStatusFilter('ready')}
              />
              <GlassPill
                label="Missing"
                size="sm"
                active={statusFilter === 'missing'}
                onPress={() => setStatusFilter('missing')}
              />
            </>
          }
        />
      </View>

      <FlatList
        data={templates}
        keyExtractor={(i) => i.id}
        renderItem={renderTemplate}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={templatesQ.isRefetching || settingsQ.isRefetching}
            onRefresh={() => {
              void settingsQ.refetch();
              void templatesQ.refetch();
            }}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 6,
          paddingBottom: tabPad + 40,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Automation</Text>
            <GlassCard borderRadius={20} contentStyle={{ paddingHorizontal: 14 }}>
              <View
                style={[
                  styles.settingRow,
                  { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Connection</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    {providerConnected ? `Connected (${connectionLabel})` : `Not connected (${connectionLabel})`}
                  </Text>
                </View>
                {!providerConnected ? (
                  <Button
                    title="Connect"
                    size="sm"
                    loading={connectWa.isPending}
                    onPress={() => connectWa.mutate()}
                  />
                ) : (
                  <Badge label="Live" variant="active" size="sm" />
                )}
              </View>
              {renderToggle('enabled', 'Enabled', 'Send automated WhatsApp messages')}
              {isMockMode()
                ? renderToggle('providerConnected', 'Provider connected', 'Meta Cloud API connection')
                : null}
              {renderToggle(
                'paymentDetailsInclude',
                'Include payment details',
                'Add Easypaisa / JazzCash / bank info',
              )}
              {renderToggle('gymInfoInclude', 'Include gym info', 'Gym name, address, timings', true)}
            </GlassCard>

            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>
              Templates
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyView
            title="No Templates Found"
            subtitle={
              q
                ? 'Try a different search query.'
                : 'Tap "+" in the header to add a WhatsApp template.'
            }
            actionLabel="Add Template"
            onAction={openAddTemplate}
          />
        }
      />

      {/* TEMPLATE ADD / EDIT SHEET */}
      <Modal
        visible={tplOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTplOpen(false)}
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
                  {editingKey ? 'Edit Template' : 'New Template'}
                </Text>
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
                  Use {'{{memberName}}'} style variables in the body
                </Text>
              </View>
              <Pressable
                onPress={() => setTplOpen(false)}
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
                label="Template Key"
                placeholder="e.g. payment_reminder"
                value={tplKey}
                onChangeText={setTplKey}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!editingKey}
                helper={editingKey ? 'Key cannot be changed after creation' : undefined}
              />
              <TextField
                label="Template Name"
                placeholder="e.g. Payment Reminder"
                value={tplName}
                onChangeText={setTplName}
              />
              <TextField
                label="Message Body"
                placeholder="Hi {{memberName}}, your {{planName}} plan expires on {{validTo}}."
                value={tplBody}
                onChangeText={setTplBody}
                multiline
                numberOfLines={5}
                style={{ minHeight: 110, textAlignVertical: 'top' }}
              />
              <TextField
                label="Language"
                placeholder="en"
                value={tplLanguage}
                onChangeText={setTplLanguage}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Button
                title={editingKey ? 'Update Template' : 'Save Template'}
                loading={saveTemplate.isPending}
                style={{ marginTop: 6 }}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tplHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tplName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  tplKey: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
  },
  tplBody: {
    fontSize: 12.5,
    marginTop: 6,
    lineHeight: 17,
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
});
