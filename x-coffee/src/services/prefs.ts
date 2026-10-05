import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Small non-secret preferences (language, country). localStorage on web, SecureStore on device. */
export async function getPref(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {}
}
