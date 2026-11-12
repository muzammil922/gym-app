import React from 'react';
import { Tabs } from 'expo-router';
import { useAuthStore } from '@/src/store/auth-store';
import { can, isStaff } from '@/src/utils/permissions';

/**
 * Tab routes only — floating bar lives in (app)/_layout so it shows on every page.
 */
export default function TabsLayout() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none', height: 0 },
        animation: 'fade',
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isStaff(role) ? 'Dashboard' : 'Home',
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          href: can(role, 'members') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          href: can(role, 'attendance') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: 'Fees',
          href: can(role, 'fees') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
        }}
      />
    </Tabs>
  );
}
