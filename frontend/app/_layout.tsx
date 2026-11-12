import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { NavigationBar } from 'expo-navigation-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/auth-store';
import { useSettingsStore } from '@/src/store/settings-store';
import { LoadingView } from '@/src/components/feedback/StateViews';
import { ErrorBoundary } from '@/src/components/feedback/ErrorBoundary';
import { AppToastHost } from '@/src/components/ui/AppToastHost';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function RootNavigator() {
  const { isDark, colors } = useTheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  // Drawn under transparent system nav when edge-to-edge is active.
  const systemBg = isDark ? '#0A1211' : '#F4F7F6';

  useEffect(() => {
    hydrateAuth();
    hydrateSettings();
  }, [hydrateAuth, hydrateSettings]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(systemBg);
    if (Platform.OS === 'android') {
      try {
        // 'dark' = dark buttons on light bg; 'light' = light buttons on dark bg
        NavigationBar.setStyle(isDark ? 'light' : 'dark');
      } catch {
        // ignore
      }
    }
  }, [systemBg, isDark]);

  if (!hydrated || !settingsHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: systemBg }}>
        <LoadingView label="Starting IronForge…" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: systemBg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {Platform.OS === 'android' ? (
        <NavigationBar style={isDark ? 'light' : 'dark'} />
      ) : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isDark ? '#162624' : '#F4F7F6' },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: systemBg },
          headerShadowVisible: false,
          animation: 'fade',
          animationDuration: 280,
          navigationBarColor: 'transparent',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const systemBg = isDark ? '#0A1211' : '#F4F7F6';
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: systemBg }}>
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedRoot>
            <ErrorBoundary>
              <RootNavigator />
              <AppToastHost />
            </ErrorBoundary>
          </ThemedRoot>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
