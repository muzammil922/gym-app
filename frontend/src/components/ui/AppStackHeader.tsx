import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from './PageHeader';
import { GlassIconButton } from './GlassIconButton';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = {
  title: string;
  /** When set, search/filter are hidden and a tick save button shows top-right. */
  onSave?: () => void;
  saving?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  headerRight?: () => React.ReactNode;
  filterContent?: React.ReactNode;
  showFilter?: boolean;
  showSearch?: boolean;
};

export function AppStackHeader({
  title,
  onSave,
  saving,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  headerRight,
  filterContent,
  showFilter,
  showSearch,
}: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [localQ, setLocalQ] = useState('');
  const saveMode = typeof onSave === 'function';

  const q = searchValue !== undefined ? searchValue : localQ;
  const handleSearchChange = onSearchChange || setLocalQ;

  const shouldShowSearch = showSearch !== undefined ? showSearch : !saveMode;
  const shouldShowFilter = showFilter !== undefined ? showFilter : !saveMode;

  // Match the Screen background gradient's top stop so the header does not
  // read as a separate darker band above the page.
  const headerBg = isDark ? '#162624' : '#F4F7F6';

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8), backgroundColor: headerBg }]}>
      <PageHeader
        title={title}
        showBack
        showSearch={shouldShowSearch}
        showFilter={shouldShowFilter}
        searchValue={q}
        onSearchChange={handleSearchChange}
        searchPlaceholder={searchPlaceholder}
        filterContent={filterContent}
        style={styles.header}
        rightSlot={
          headerRight ? (
            headerRight()
          ) : saveMode ? (
            saving ? (
              <View style={styles.saving}>
                <ActivityIndicator size="small" color={colors.text} />
              </View>
            ) : (
              <GlassIconButton
                name="checkmark"
                variant="glass"
                accessibilityLabel="Save"
                onPress={onSave}
              />
            )
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  header: {
    marginBottom: 4,
  },
  saving: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
