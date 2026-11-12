import React, { useCallback, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useSegments } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/ThemeProvider';
import { OfflineBanner, SkeletonList } from '@/src/components/feedback/StateViews';
import { useOnlineStatus } from '@/src/hooks/use-online-status';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  padded?: boolean;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  /** Force tab-bar clearance. Default: auto when inside (app). */
  withTabBar?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  animate?: boolean;
  skeletonRows?: number;
};

const SKELETON_MS = 340;

export function Screen({
  children,
  scroll,
  style,
  contentContainerStyle,
  padded = true,
  edges = ['top'],
  withTabBar,
  refreshing = false,
  onRefresh,
  animate = true,
  skeletonRows = 5,
}: Props) {
  const { spacing, isDark } = useTheme();
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const tabPad = useFloatingTabBarPad();
  const segments = useSegments();
  const inApp = segments[0] === '(app)';
  // Every app page has the global floating bar — pad content accordingly.
  const needsTabPad = withTabBar ?? inApp;
  const [switching, setSwitching] = useState(animate);
  const [enterKey, setEnterKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!animate) {
        setSwitching(false);
        return;
      }

      setSwitching(true);
      const t = setTimeout(() => {
        setEnterKey((k) => k + 1);
        setSwitching(false);
      }, SKELETON_MS);

      return () => clearTimeout(t);
    }, [animate]),
  );

  const bg = isDark ? '#0A1211' : '#F4F7F6';
  const topInset = edges.includes('top') ? Math.max(insets.top, 0) : 0;
  const systemBottom =
    Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 0) + 8;

  const bottomInset = needsTabPad
    ? tabPad
    : edges.includes('bottom') || scroll
      ? systemBottom + (padded ? 8 : 0)
      : systemBottom;

  const extraTop =
    contentContainerStyle &&
    !Array.isArray(contentContainerStyle) &&
    typeof contentContainerStyle.paddingTop === 'number'
      ? contentContainerStyle.paddingTop
      : 0;
  const extraBottom =
    contentContainerStyle &&
    !Array.isArray(contentContainerStyle) &&
    typeof contentContainerStyle.paddingBottom === 'number'
      ? contentContainerStyle.paddingBottom
      : 0;

  const pageBody = (
    <View style={[{ flex: 1, padding: padded ? spacing.lg : 0 }, style]}>
      {children}
    </View>
  );

  const content = switching ? (
    <SkeletonList rows={skeletonRows} />
  ) : animate ? (
    <Animated.View
      key={enterKey}
      entering={FadeInDown.duration(320).springify().damping(20).stiffness(160)}
      style={{ flex: 1 }}
    >
      {pageBody}
    </Animated.View>
  ) : (
    pageBody
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <LinearGradient
        colors={
          isDark
            ? ['#162624', '#0F1A19', '#0A1211']
            : ['#F4F7F6', '#EAF1EF', '#DFE8E6']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <OfflineBanner visible={!online} />

      {scroll && !switching ? (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
          contentContainerStyle={[
            { flexGrow: 1 },
            contentContainerStyle,
            {
              paddingTop: topInset + extraTop,
              paddingBottom: bottomInset + extraBottom,
            },
          ]}
        >
          {content}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            paddingTop: topInset,
            // FlatList screens manage their own bottom pad via useFloatingTabBarPad.
            paddingBottom: needsTabPad ? 0 : bottomInset,
          }}
        >
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
