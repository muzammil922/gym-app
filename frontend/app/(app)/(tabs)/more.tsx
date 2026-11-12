import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { ListItem } from '@/src/components/ui/ListItem';
import { SectionTitle } from '@/src/components/ui/SectionTitle';
import { Avatar } from '@/src/components/ui/Avatar';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/auth-store';
import { useToastStore } from '@/src/store/toast-store';
import { can } from '@/src/utils/permissions';

type MenuRow = {
  key: string;
  section: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  href: string;
  visible: boolean;
};

export default function MoreTab() {
  const { colors, spacing } = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useToastStore((s) => s.show);
  const [q, setQ] = useState('');

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          // Toast lives at the root layout (outside the navigator), so it
          // survives the redirect to the login screen.
          showToast({
            title: 'Signed out',
            message: 'You have been logged out successfully.',
            tone: 'success',
          });
          void logout().finally(() => {
            router.replace('/(auth)/login');
          });
        },
      },
    ]);
  };

  const rows: MenuRow[] = useMemo(
    () => [
      {
        key: 'workout',
        section: 'Fitness & Routines',
        title: 'Workout',
        subtitle: 'Exercise library and workout plans',
        icon: 'barbell-outline',
        iconColor: '#8B5CF6',
        href: '/(app)/workout',
        visible: can(role, 'workout'),
      },
      {
        key: 'diet',
        section: 'Fitness & Routines',
        title: 'Diet',
        subtitle: 'Nutrition templates, meal check-offs',
        icon: 'nutrition-outline',
        iconColor: '#10B981',
        href: '/(app)/diet',
        visible: can(role, 'diet'),
      },
      {
        key: 'staff',
        section: 'Club Operations',
        title: 'Staff Management',
        subtitle: 'Team roster, attendance, and salary',
        icon: 'id-card-outline',
        iconColor: '#3B82F6',
        href: '/(app)/staff',
        visible: can(role, 'staff'),
      },
      {
        key: 'offers',
        section: 'Club Operations',
        title: 'Offers & Discounts',
        subtitle: 'Promotions and plan suggestions',
        icon: 'pricetag-outline',
        iconColor: '#F59E0B',
        href: '/(app)/offers',
        visible: can(role, 'offers'),
      },
      {
        key: 'whatsapp',
        section: 'Club Operations',
        title: 'WhatsApp Automation',
        subtitle: 'Payment receipts, reminder logs',
        icon: 'logo-whatsapp',
        iconColor: '#22C55E',
        href: '/(app)/whatsapp',
        visible: can(role, 'whatsapp'),
      },
      {
        key: 'reports',
        section: 'Club Operations',
        title: 'Financial Reports',
        subtitle: 'Collections and overdue breakdowns',
        icon: 'stats-chart-outline',
        iconColor: '#6366F1',
        href: '/(app)/reports',
        visible: can(role, 'reports'),
      },
      {
        key: 'notifications',
        section: 'Preferences',
        title: 'Notifications',
        subtitle: 'Alerts and notifications center',
        icon: 'notifications-outline',
        iconColor: '#EC4899',
        href: '/(app)/notifications',
        visible: true,
      },
    ],
    [role],
  );

  const visible = rows.filter((r) => r.visible);
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? visible.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.subtitle.toLowerCase().includes(needle) ||
          r.section.toLowerCase().includes(needle),
      )
    : visible;

  const sections = Array.from(new Set(filtered.map((r) => r.section)));

  return (
    <Screen
      scroll
      withTabBar
      padded={false}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <PageHeader
        title="More"
        onBack={() => router.navigate('/(app)/(tabs)')}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search menu..."
      />

      <GlassCard caustic="violet" borderRadius={26} style={{ marginBottom: 12, marginTop: 4 }}>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          style={({ pressed }) => [styles.profileCard, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Avatar name={user?.name || 'User'} uri={user?.avatarUrl} size={58} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
              <Badge label={user?.role || 'Staff'} variant="neutral" size="sm" />
            </View>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>
              {user?.phone || 'IronForge Member'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textTertiary} />
        </Pressable>
      </GlassCard>

      {sections.map((section) => (
        <View key={section}>
          <SectionTitle title={section} />
          {filtered
            .filter((r) => r.section === section)
            .map((r) => (
              <ListItem
                key={r.key}
                title={r.title}
                subtitle={r.subtitle}
                icon={r.icon}
                iconColor={r.iconColor}
                onPress={() => router.push(r.href as any)}
              />
            ))}
        </View>
      ))}

      <Button
        title="Sign Out"
        variant="danger"
        onPress={handleLogout}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 88,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  userRole: {
    fontSize: 13,
    marginTop: 3,
  },
});
