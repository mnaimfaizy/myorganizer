import type { VaultStorage } from '@myorganizer/vault-core';
import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';

let storage: MMKV | null = null;

function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: 'vault-storage' });
  }
  return storage;
}

export class MobileVaultStorage implements VaultStorage {
  getItem(key: string): string | null {
    return getStorage().getString(key) ?? null;
  }

  setItem(key: string, value: string): void {
    getStorage().set(key, value);
  }

  removeItem(key: string): void {
    getStorage().remove(key);
  }
}

export const mobileVaultStorage = new MobileVaultStorage();
