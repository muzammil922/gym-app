import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import { SectionTitle } from '@/src/components/ui/SectionTitle';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassSwitch } from '@/src/components/ui/GlassSwitch';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { ErrorView, LoadingView } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { gymApi } from '@/src/api/endpoints';
import { useAuthStore } from '@/src/store/auth-store';
import { useSettingsStore } from '@/src/store/settings-store';
import { can } from '@/src/utils/permissions';

export default function SettingsScreen() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();
  const user = useAuthStore((s) => s.user);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const qc = useQueryClient();

  const gymQ = useQuery({ queryKey: ['gym'], queryFn: gymApi.get });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  React.useEffect(() => {
    if (gymQ.data) {
      setName(gymQ.data.name);
      setPhone(gymQ.data.phone);
      setAddress(gymQ.data.address);
    }
  }, [gymQ.data]);

  const save = useMutation({
    mutationFn: gymApi.update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gym'] });
      Alert.alert('Saved', 'Gym profile updated successfully.');
    },
  });

  if (gymQ.isLoading) return <LoadingView />;
  if (gymQ.isError)
    return (
      <ErrorView
        message={(gymQ.error as Error).message}
        onRetry={() => {
          void gymQ.refetch();
        }}
      />
    );

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Settings"
          showBack
          onBack={() => router.back()}
          showSearch={false}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: 6,
          paddingBottom: tabPad + 40,
        }}
      >
        <View>
          {/* Appearance Theme */}
          <SectionTitle title="Appearance" />
          <GlassCard caustic="violet" borderRadius={24} contentStyle={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.switchTitleRow}>
                  <Ionicons
                    name={isDark ? 'moon' : 'sunny'}
                    size={16}
                    color={isDark ? '#2DD4BF' : '#0F766E'}
                  />
                  <Text style={[styles.switchTitle, { color: colors.text }]}>
                    Dark Mode
                  </Text>
                </View>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {isDark
                    ? 'Dark glass theme is active'
                    : 'Light glass theme is active'}
                </Text>
              </View>
              <GlassSwitch
                value={isDark}
                onValueChange={(next) => setThemeMode(next ? 'dark' : 'light')}
              />
            </View>

            {themeMode === 'system' ? (
              <Text style={[styles.hint, { color: colors.textTertiary, marginTop: 8 }]}>
                Following device setting · toggle to pin light or dark
              </Text>
            ) : null}
          </GlassCard>

          {/* Gym Profile */}
          {can(user?.role, 'settings') && (user?.role === 'owner' || user?.role === 'manager') ? (
            <>
              <SectionTitle title="Gym Profile" />
              <GlassCard caustic="emerald" borderRadius={24} contentStyle={styles.card}>
                <TextField label="Gym Name" value={name} onChangeText={setName} pill />
                <TextField label="Official Phone" value={phone} onChangeText={setPhone} pill />
                <TextField label="Address / Branch" value={address} onChangeText={setAddress} pill />
                <Text
                  style={[
                    styles.hint,
                    { color: colors.textSecondary, marginTop: 4, marginBottom: 14 },
                  ]}
                >
                  Timezone: Asia/Karachi · Currency: PKR
                </Text>
                <Button
                  title="Save Gym Profile"
                  loading={save.isPending}
                  onPress={() => save.mutate({ name, phone, address })}
                  fullWidth
                />
              </GlassCard>
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
