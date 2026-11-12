import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/auth-store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { can } from '@/src/utils/permissions';
import { useKeyboardVisible } from '@/src/hooks/use-keyboard-visible';
import {
  FloatingPillBar,
  TAB_BAR_HEIGHT,
  TAB_SIDE_INSET,
  useTabBarBottomOffset,
  type TabName,
} from '@/src/components/ui/FloatingTabBar';

const TAB_ORDER: TabName[] = ['index', 'members', 'attendance', 'fees', 'more'];

function activeTabFromPath(pathname: string): TabName {
  if (pathname.includes('members')) return 'members';
  if (pathname.includes('attendance')) return 'attendance';
  if (pathname.includes('fees') || pathname.includes('reports') || pathname.includes('offers')) {
    return 'fees';
  }
  if (
    pathname.includes('more') ||
    pathname.includes('settings') ||
    pathname.includes('staff') ||
    pathname.includes('whatsapp') ||
    pathname.includes('notifications') ||
    pathname.includes('diet') ||
    pathname.includes('workout')
  ) {
    return 'more';
  }
  return 'index';
}

function routeHref(name: TabName) {
  if (name === 'index') return '/(app)/(tabs)';
  return `/(app)/(tabs)/${name}`;
}

/**
 * Global Foodpanda floating tab bar — mounts once in (app)/_layout
 * so every page (tabs + stack) gets the same safe-area + dark/light behavior.
 */
export function AppFloatingTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark } = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const keyboardVisible = useKeyboardVisible();
  const bottom = useTabBarBottomOffset();
  const active = activeTabFromPath(pathname);

  const items = useMemo(() => {
    return TAB_ORDER.filter((name) => {
      if (name === 'members') return can(role, 'members');
      if (name === 'attendance') return can(role, 'attendance');
      if (name === 'fees') return can(role, 'fees');
      return true;
    }).map((name) => ({
      key: name,
      name,
      focused: active === name,
      onPress: () => {
        if (active === name && !pathname.includes('/(tabs)') && name === 'index') {
          router.navigate(routeHref(name) as any);
          return;
        }
        if (active === name) return;
        router.navigate(routeHref(name) as any);
      },
    }));
  }, [active, pathname, role, router]);

  if (keyboardVisible) return null;

  const pageBg = isDark ? '#0A1211' : '#F4F7F6';
  const fadeColors = isDark
    ? (['rgba(10, 18, 17, 0)', 'rgba(10, 18, 17, 0.65)', pageBg] as const)
    : (['rgba(244, 247, 246, 0)', 'rgba(244, 247, 246, 0.65)', pageBg] as const);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        pointerEvents="none"
        style={[styles.fade, { height: TAB_BAR_HEIGHT + bottom + 28 }]}
      >
        <LinearGradient
          colors={[...fadeColors]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.pillHost,
          {
            left: TAB_SIDE_INSET,
            right: TAB_SIDE_INSET,
            bottom,
          },
        ]}
      >
        <FloatingPillBar items={items} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pillHost: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 20 },
      default: {},
    }),
  },
});
