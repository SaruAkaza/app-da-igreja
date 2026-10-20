import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const sensitive = (key: string) => key === 'church_auth_token' || key === 'church_saved_accounts';
// Na web, a sessão termina ao fechar a aba. No aparelho, usa o cofre do sistema.
export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!sensitive(key)) return AsyncStorage.getItem(key);
    if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
    if (key === 'church_saved_accounts') {
      const ids: string[] = JSON.parse(await SecureStore.getItemAsync(key) || '[]');
      const entries = await Promise.all(ids.map(id => SecureStore.getItemAsync('church_account_' + id)));
      return JSON.stringify(entries.filter(Boolean).map(entry => JSON.parse(entry!)));
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!sensitive(key)) return AsyncStorage.setItem(key, value);
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); return; }
    if (key === 'church_saved_accounts') {
      const entries: { id: string }[] = JSON.parse(value);
      const previous: string[] = JSON.parse(await SecureStore.getItemAsync(key) || '[]');
      for (const entry of entries) await SecureStore.setItemAsync('church_account_' + entry.id, JSON.stringify(entry));
      for (const id of previous.filter(id => !entries.some(entry => entry.id === id))) await SecureStore.deleteItemAsync('church_account_' + id);
      await SecureStore.setItemAsync(key, JSON.stringify(entries.map(entry => entry.id)));
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (!sensitive(key)) return AsyncStorage.removeItem(key);
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); return; }
    if (key === 'church_saved_accounts') {
      const ids: string[] = JSON.parse(await SecureStore.getItemAsync(key) || '[]');
      for (const id of ids) await SecureStore.deleteItemAsync('church_account_' + id);
    }
    await SecureStore.deleteItemAsync(key);
  },
};
