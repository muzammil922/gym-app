import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassIconButton } from './GlassIconButton';
import { useTheme } from '@/src/theme/ThemeProvider';

export type PageHeaderPanel = 'none' | 'search' | 'filter';

type Props = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  filterContent?: React.ReactNode;
  showFilter?: boolean;
  showSearch?: boolean;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  /** Controlled panel mode ('none' | 'search' | 'filter') */
  panel?: PageHeaderPanel;
  onPanelChange?: (panel: PageHeaderPanel) => void;
};

const OPEN_MS = 300;
const CLOSE_MS = 280;
const SLIDE = 72;
const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);

export function PageHeader({
  title,
  showBack = true,
  onBack,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterContent,
  showFilter = true,
  showSearch = true,
  rightSlot,
  style,
  panel: propPanel,
  onPanelChange,
}: Props) {
  const { colors, isDark } = useTheme();
  const [internalPanel, setInternalPanel] = useState<PageHeaderPanel>('none');
  const isControlled = propPanel !== undefined;
  const panel = isControlled ? propPanel : internalPanel;
  const setPanel = useCallback(
    (p: PageHeaderPanel | ((prev: PageHeaderPanel) => PageHeaderPanel)) => {
      const next = typeof p === 'function' ? p(panel) : p;
      if (isControlled) {
        onPanelChange?.(next);
      } else {
        setInternalPanel(next);
      }
    },
    [isControlled, onPanelChange, panel],
  );

  const [searchMounted, setSearchMounted] = useState(false);
  const [filterMounted, setFilterMounted] = useState(false);

  const searchProgress = useSharedValue(0);
  const filterProgress = useSharedValue(0);

  const afterSearchClosed = useCallback(() => {
    setSearchMounted(false);
    setPanel((p) => (p === 'search' ? 'none' : p));
  }, [setPanel]);

  const afterFilterClosed = useCallback(() => {
    setFilterMounted(false);
    setPanel((p) => (p === 'filter' ? 'none' : p));
  }, [setPanel]);

  const closeSearchAnimated = useCallback(() => {
    searchProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
      if (finished) runOnJS(afterSearchClosed)();
    });
  }, [afterSearchClosed, searchProgress]);

  const closeFilterAnimated = useCallback(() => {
    filterProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
      if (finished) runOnJS(afterFilterClosed)();
    });
  }, [afterFilterClosed, filterProgress]);

  const openSearch = useCallback(() => {
    if (filterMounted) {
      filterProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
        if (finished) runOnJS(setFilterMounted)(false);
      });
    }
    setSearchMounted(true);
    setPanel('search');
    searchProgress.value = 0;
    requestAnimationFrame(() => {
      searchProgress.value = withTiming(1, { duration: OPEN_MS, easing: easeOut });
    });
  }, [filterMounted, filterProgress, searchProgress, setPanel]);

  const openFilter = useCallback(() => {
    if (searchMounted) {
      searchProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
        if (finished) runOnJS(setSearchMounted)(false);
      });
    }
    setFilterMounted(true);
    setPanel('filter');
    filterProgress.value = 0;
    requestAnimationFrame(() => {
      filterProgress.value = withTiming(1, { duration: OPEN_MS, easing: easeOut });
    });
  }, [searchMounted, searchProgress, filterProgress, setPanel]);

  // Synchronize animated mount state when controlled propPanel changes
  useEffect(() => {
    if (propPanel === undefined) return;
    if (propPanel === 'search') {
      if (filterMounted) {
        filterProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
          if (finished) runOnJS(setFilterMounted)(false);
        });
      }
      setSearchMounted(true);
      searchProgress.value = 0;
      requestAnimationFrame(() => {
        searchProgress.value = withTiming(1, { duration: OPEN_MS, easing: easeOut });
      });
    } else if (propPanel === 'filter') {
      if (searchMounted) {
        searchProgress.value = withTiming(0, { duration: CLOSE_MS, easing: easeIn }, (finished) => {
          if (finished) runOnJS(setSearchMounted)(false);
        });
      }
      setFilterMounted(true);
      filterProgress.value = 0;
      requestAnimationFrame(() => {
        filterProgress.value = withTiming(1, { duration: OPEN_MS, easing: easeOut });
      });
    } else {
      if (searchMounted) closeSearchAnimated();
      if (filterMounted) closeFilterAnimated();
    }
  }, [propPanel]);

  const closeSearch = () => {
    if (isControlled) onPanelChange?.('none');
    else closeSearchAnimated();
  };

  const closeFilter = () => {
    if (isControlled) onPanelChange?.('none');
    else closeFilterAnimated();
  };

  const toggleSearch = () => {
    if (panel === 'search') {
      if (isControlled) onPanelChange?.('none');
      else closeSearch();
    } else {
      if (isControlled) onPanelChange?.('search');
      else openSearch();
    }
  };

  const toggleFilter = () => {
    if (panel === 'filter') {
      if (isControlled) onPanelChange?.('none');
      else closeFilter();
    } else {
      if (isControlled) onPanelChange?.('filter');
      else openFilter();
    }
  };

  const searchStyle = useAnimatedStyle(() => ({
    opacity: searchProgress.value,
    transform: [{ translateX: (1 - searchProgress.value) * SLIDE }],
  }));

  const filterStyle = useAnimatedStyle(() => ({
    opacity: filterProgress.value,
    transform: [{ translateX: (1 - filterProgress.value) * SLIDE }],
  }));

  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,26,25,0.08)';

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {showBack ? (
            <GlassIconButton
              name="chevron-back"
              variant="glass"
              accessibilityLabel="Go back"
              onPress={onBack ?? (() => router.back())}
            />
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>

        <View style={[styles.side, styles.sideRight]}>
          {rightSlot ? <View style={styles.slotGap}>{rightSlot}</View> : null}
          {showFilter ? (
            <GlassIconButton
              name={panel === 'filter' ? 'close' : 'options-outline'}
              accessibilityLabel={panel === 'filter' ? 'Close filters' : 'Filters'}
              onPress={toggleFilter}
              style={styles.iconGap}
            />
          ) : null}
          {showSearch ? (
            <GlassIconButton
              name={panel === 'search' ? 'close' : 'search'}
              accessibilityLabel={panel === 'search' ? 'Close search' : 'Search'}
              onPress={toggleSearch}
            />
          ) : !showFilter && !rightSlot ? (
            <View style={styles.spacer} />
          ) : null}
        </View>
      </View>

      {searchMounted ? (
        <Animated.View
          style={[styles.panel, searchStyle]}
          pointerEvents={panel === 'search' ? 'auto' : 'none'}
        >
          <View
            style={[
              styles.searchField,
              { backgroundColor: inputBg, borderColor: inputBorder },
            ]}
          >
            <GlassIconButton name="search" size={34} accessibilityLabel="Search" />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text }]}
              autoFocus={panel === 'search'}
              returnKeyType="search"
            />
            <GlassIconButton
              name="close"
              size={34}
              accessibilityLabel="Close search"
              onPress={closeSearch}
            />
          </View>
        </Animated.View>
      ) : null}

      {filterMounted ? (
        <Animated.View
          style={[styles.panel, filterStyle]}
          pointerEvents={panel === 'filter' ? 'auto' : 'none'}
        >
          <View style={styles.filterRow}>
            {filterContent ?? (
              <Text style={[styles.emptyFilter, { color: colors.textTertiary }]}>
                No filters
              </Text>
            )}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  side: {
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    minWidth: 48,
  },
  spacer: {
    width: 40,
    height: 40,
  },
  slotGap: {
    marginRight: 4,
  },
  iconGap: {
    marginRight: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingHorizontal: 6,
  },
  panel: {
    marginTop: 10,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  filterRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  emptyFilter: {
    fontSize: 13,
    fontWeight: '600',
  },
});
