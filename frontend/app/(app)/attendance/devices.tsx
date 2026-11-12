import React from 'react';
import { Alert, FlatList, RefreshControl, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/src/components/ui/Screen';
import { ListItem } from '@/src/components/ui/ListItem';
import { EmptyView, ErrorView, SkeletonList } from '@/src/components/feedback/StateViews';
import { useTheme } from '@/src/theme/ThemeProvider';
import { attendanceApi } from '@/src/api/endpoints';
import { formatDateTime } from '@/src/utils/date';

export default function DevicesScreen() {
  const { colors, spacing } = useTheme();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['devices'], queryFn: attendanceApi.devices });
  const ping = useMutation({
    mutationFn: attendanceApi.pingDevice,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      Alert.alert('Device', `${d.name} marked online.`);
    },
  });

  if (query.isLoading) return <SkeletonList />;
  if (query.isError)
    return <ErrorView message={(query.error as Error).message} onRetry={() => { void query.refetch(); }} />;

  return (
    <Screen padded={false}>
      <FlatList
        data={query.data || []}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 16, flexGrow: 1 }}
        ListHeaderComponent={
          <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
            Devices are configured and monitored via API only. No attendance SDK is embedded in this
            Expo Go app.
          </Text>
        }
        ListEmptyComponent={<EmptyView title="No devices" />}
        renderItem={({ item }) => (
          <ListItem
            title={`${item.name} · ${item.isOnline ? 'Online' : 'Offline'}`}
            subtitle={`${item.location} · ${item.serialNumber} · enrolled ${item.enrolledCount} · seen ${formatDateTime(item.lastSeenAt)}`}
            onPress={() => ping.mutate(item.id)}
          />
        )}
      />
    </Screen>
  );
}
