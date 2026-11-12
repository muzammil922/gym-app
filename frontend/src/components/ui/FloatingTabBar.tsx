import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/auth-store';
import { can } from '@/src/utils/permissions';
import { useKeyboardVisible } from '@/src/hooks/use-keyboard-visible';

export const TAB_SIDE_INSET = 16;
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_GAP = 8;

type TabIcon = keyof typeof Ionicons.glyphMap;
export type TabName = 'index' | 'members' | 'attendance' | 'fees' | 'more';

const TAB_ICONS: Record<TabName, { active: TabIcon; idle: TabIcon }> = {
  index: { active: 'grid', idle: 'grid-outline' },
  members: { active: 'people', idle: 'people-outline' },
  attendance: { active: 'finger-print', idle: 'finger-print-outline' },
  fees: { active: 'wallet', idle: 'wallet-outline' },
  more: {
    active: 'ellipsis-horizontal-circle',
    idle: 'ellipsis-horizontal-circle-outline',
  },
};

const SPRING = { damping: 18, stiffness: 280, mass: 0.7 };

function routeHref(name: TabName) {
  if (name === 'index') return '/(app)/(tabs)';
  return `/(app)/(tabs)/${name}`;
}

function tabLabel(name: TabName) {
  if (name === 'index') return 'Home';
  if (name === 'members') return 'Members';
  if (name === 'attendance') return 'Attendance';
  if (name === 'fees') return 'Fees';
  return 'More';
}

export function useTabBarBottomOffset() {
  const insets = useSafeAreaInsets();
  const safeBottom =
    insets.bottom > 0
      ? insets.bottom
      : Platform.OS === 'android'
        ? 20
        : 0;
  return safeBottom + TAB_BAR_GAP;
}

export function useFloatingTabBarPad() {
  const bottom = useTabBarBottomOffset();
  return TAB_BAR_HEIGHT + bottom + 32;
}

type PillItem = {
  key: string;
  name: TabName;
  focused: boolean;
  onPress: () => void;
};

type PillBarProps = {
  items: PillItem[];
};

function GlassIconChip({
  focused,
  isDark,
  children,
}: {
  focused: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  const chipStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, 1.06]),
      },
    ],
  }));

  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.72, 1]),
      },
    ],
  }));

  const idleGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 0]),
  }));

  return (
    <Animated.View style={[styles.iconWell, chipStyle]}>
      {/* Idle: light glass rim only — no heavy blur */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.iconWellFill,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.35)',
            borderWidth: 1,
            borderColor: isDark
              ? 'rgba(255,255,255,0.14)'
              : 'rgba(255,255,255,0.55)',
          },
          idleGlassStyle,
        ]}
      />

      {/* Active: liquid glass chip */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.iconWellFill, glassStyle]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 36 : 42}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <BlurView
            intensity={isDark ? 48 : 55}
            tint={isDark ? 'dark' : 'light'}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              // Solid-er teal glass fill so active reads as a filled circle
              backgroundColor: isDark
                ? 'rgba(94, 234, 212, 0.48)'
                : 'rgba(13, 148, 136, 0.32)',
            },
          ]}
        />
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255,255,255,0.28)',
                  'rgba(255,255,255,0.06)',
                  'transparent',
                ]
              : [
                  'rgba(255,255,255,0.62)',
                  'rgba(255,255,255,0.18)',
                  'transparent',
                ]
          }
          locations={[0, 0.42, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.glassRim,
            {
              borderColor: isDark
                ? 'rgba(94, 234, 212, 0.55)'
                : 'rgba(13, 148, 136, 0.4)',
            },
          ]}
          pointerEvents="none"
        />
      </Animated.View>

      {children}
    </Animated.View>
  );
}

function TabBarItem({ item }: { item: PillItem }) {
  const { isDark } = useTheme();
  const icons = TAB_ICONS[item.name] || TAB_ICONS.more;
  const activeColor = isDark ? '#5EEAD4' : '#0D9488';
  const idleColor = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(15,26,25,0.42)';

  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tabLabel(item.name)}
      accessibilityState={item.focused ? { selected: true } : {}}
      onPress={item.onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, SPRING);
      }}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, pressStyle]}>
        <GlassIconChip focused={item.focused} isDark={isDark}>
          <Ionicons
            name={item.focused ? icons.active : icons.idle}
            size={22}
            color={item.focused ? activeColor : idleColor}
          />
        </GlassIconChip>
      </Animated.View>
    </Pressable>
  );
}

/** Simple translucent floating capsule — liquid glass lives on icons only. */
export function FloatingPillBar({ items }: PillBarProps) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          borderColor: isDark
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(15,26,25,0.08)',
          shadowOpacity: isDark ? 0.45 : 0.14,
          backgroundColor: isDark
            ? 'rgba(18, 28, 27, 0.92)'
            : 'rgba(255, 255, 255, 0.94)',
        },
      ]}
    >
      {items.map((item) => (
        <TabBarItem key={item.key} item={item} />
      ))}
    </View>
  );
}

type Props = {
  activeTab?: TabName;
};

export function FloatingTabBar({ activeTab = 'members' }: Props) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const keyboardVisible = useKeyboardVisible();
  const bottom = useTabBarBottomOffset();

  const tabs: TabName[] = (
    ['index', 'members', 'attendance', 'fees', 'more'] as TabName[]
  ).filter((name) => {
    if (name === 'members') return can(role, 'members');
    if (name === 'attendance') return can(role, 'attendance');
    if (name === 'fees') return can(role, 'fees');
    return true;
  });

  if (keyboardVisible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom, left: TAB_SIDE_INSET, right: TAB_SIDE_INSET }]}
    >
      <FloatingPillBar
        items={tabs.map((name) => ({
          key: name,
          name,
          focused: activeTab === name,
          onPress: () => router.navigate(routeHref(name) as any),
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 100,
    elevation: 100,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingVertical: 0,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    ...Platform.select({
      android: { elevation: 14 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
    overflow: 'visible',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconWellFill: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassRim: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
});
