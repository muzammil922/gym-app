import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/src/store/auth-store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { AppStackHeader } from '@/src/components/ui/AppStackHeader';
import { AppFloatingTabBar } from '@/src/components/ui/AppFloatingTabBar';

type HeaderExtras = {
  onHeaderSave?: () => void;
  headerSaving?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  headerRight?: () => React.ReactNode;
  filterContent?: React.ReactNode;
  showFilter?: boolean;
  showSearch?: boolean;
};

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isDark } = useTheme();
  const pageBg = isDark ? '#0A1211' : '#F4F7F6';
  // Must match the top stop of the `Screen` background gradient, otherwise the
  // native header reads as a separate dark band above the page content.
  const headerBg = isDark ? '#162624' : '#F4F7F6';

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackVisible: false,
          headerStyle: { backgroundColor: headerBg },
          headerTransparent: false,
          animation: 'slide_from_right',
          animationDuration: 320,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          header: ({ options }) => {
            const extras = options as typeof options & HeaderExtras;
            return (
              <AppStackHeader
                title={typeof options.title === 'string' ? options.title : ''}
                onSave={extras.onHeaderSave}
                saving={extras.headerSaving}
                searchValue={extras.searchValue}
                onSearchChange={extras.onSearchChange}
                searchPlaceholder={extras.searchPlaceholder}
                headerRight={typeof extras.headerRight === 'function' ? extras.headerRight : undefined}
                filterContent={extras.filterContent}
                showFilter={extras.showFilter}
                showSearch={extras.showSearch}
              />
            );
          },
          contentStyle: {
            backgroundColor: pageBg,
          },
          navigationBarColor: 'transparent',
          navigationBarHidden: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="members/add"
          options={{
            title: 'Add Member',
            presentation: 'card',
            contentStyle: { backgroundColor: pageBg },
          }}
        />
        <Stack.Screen
          name="members/edit"
          options={{
            title: 'Edit Profile',
            presentation: 'card',
            contentStyle: { backgroundColor: pageBg },
          }}
        />
        <Stack.Screen name="members/[id]" options={{ title: 'Profile', headerShown: false }} />
        <Stack.Screen name="attendance/manual" options={{ title: 'Manual Check-in', headerShown: false }} />
        <Stack.Screen name="attendance/history" options={{ title: 'Attendance History', headerShown: false }} />
        <Stack.Screen name="attendance/devices" options={{ title: 'Biometric Devices' }} />
        <Stack.Screen name="fees/collect" options={{ title: 'Collect Payment' }} />
        <Stack.Screen name="fees/plans" options={{ title: 'Membership Plans', headerShown: false }} />
        <Stack.Screen name="fees/dues" options={{ title: 'Pending Dues', headerShown: false }} />
        <Stack.Screen name="offers/index" options={{ title: 'Offers', headerShown: false }} />
        <Stack.Screen name="diet/index" options={{ title: 'Diet & Nutrition', headerShown: false }} />
        <Stack.Screen name="workout/index" options={{ title: 'Workout Plans', headerShown: false }} />
        <Stack.Screen name="staff/index" options={{ title: 'Staff Management', headerShown: false }} />
        <Stack.Screen name="whatsapp/index" options={{ title: 'WhatsApp', headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings', headerShown: false }} />
        <Stack.Screen name="reports/index" options={{ title: 'Financial Reports', headerShown: false }} />
      </Stack>
      {/* Same floating bar on every app page (tabs + stack), light + dark. */}
      <AppFloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
