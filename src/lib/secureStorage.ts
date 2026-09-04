import { Capacitor } from './capacitor-shim';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

class CapacitorSecureStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const result = await SecureStorage.get(key);
    return result ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await SecureStorage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await SecureStorage.remove(key);
  }
}

export function getAuthStorage(): StorageAdapter {
  if (Capacitor.isNativePlatform()) {
    return new CapacitorSecureStorageAdapter();
  }
  return localStorage;
}
