import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'gym_auth_tokens';
const SESSION_KEY = 'gym_auth_user';

export async function saveTokens(json: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, json);
}

export async function loadTokens(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveSessionUser(json: string) {
  await AsyncStorage.setItem(SESSION_KEY, json);
}

export async function loadSessionUser(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function clearSessionUser() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function cacheSet(key: string, value: string) {
  await AsyncStorage.setItem(`cache:${key}`, value);
}

export async function cacheGet(key: string) {
  return AsyncStorage.getItem(`cache:${key}`);
}

export async function cacheRemove(key: string) {
  await AsyncStorage.removeItem(`cache:${key}`);
}
