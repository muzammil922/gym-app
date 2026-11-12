// Safe wrapper around expo-notifications
// In Expo Go (SDK 52+), native modules like ExpoApplication are not included,
// causing a fatal crash if expo-notifications is statically imported.
// This utility provides safe dynamic loading with graceful fallback.

let NotificationsModule: any = null;
let isSupported = false;

try {
  // Dynamic require ensures catch block handles missing native module
  NotificationsModule = require('expo-notifications');
  if (NotificationsModule && typeof NotificationsModule.setNotificationHandler === 'function') {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    isSupported = true;
  }
} catch {
  // Running in Expo Go or environment without native notification support
  isSupported = false;
  NotificationsModule = null;
}

export async function scheduleNotificationSafely(title: string, body: string): Promise<void> {
  if (!isSupported || !NotificationsModule) return;
  try {
    await NotificationsModule.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // Local notification permissions not granted or failed; ignore in dev/mock
  }
}

export const isNotificationsSupported = isSupported;

