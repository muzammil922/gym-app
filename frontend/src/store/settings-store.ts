import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLanguage, ThemeMode } from '@/src/api/types';

const KEY = 'gym_settings_v1';

type SettingsState = {
  themeMode: ThemeMode;
  language: AppLanguage;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
};

async function persist(partial: Partial<Pick<SettingsState, 'themeMode' | 'language'>>) {
  const current = await AsyncStorage.getItem(KEY);
  const parsed = current ? JSON.parse(current) : {};
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...parsed, ...partial }));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'system',
  language: 'en',
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as { themeMode?: ThemeMode; language?: AppLanguage };
        set({
          themeMode: data.themeMode || 'system',
          language: data.language || 'en',
          hydrated: true,
        });
        return;
      }
    } catch {
      // ignore
    }
    set({ hydrated: true });
  },

  setThemeMode: async (themeMode) => {
    set({ themeMode });
    await persist({ themeMode });
  },

  setLanguage: async (language) => {
    set({ language });
    await persist({ language });
  },
}));
