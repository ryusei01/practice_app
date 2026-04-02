/**
 * セキュアなトークンストレージ
 *
 * - モバイル(iOS/Android): expo-secure-store を使用（ネイティブのKeychain/Keystore）
 * - Web: localStorage を直接使用
 *   expo-secure-store の Web 実装は getValueWithKeyAsync / deleteValueWithKeyAsync 等の
 *   ネイティブモジュール関数が未実装のためクラッシュする
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const tokenStorage = {
  getAccessToken: () => getItem(KEYS.ACCESS_TOKEN),
  setAccessToken: (token: string) => setItem(KEYS.ACCESS_TOKEN, token),
  removeAccessToken: () => removeItem(KEYS.ACCESS_TOKEN),

  getRefreshToken: () => getItem(KEYS.REFRESH_TOKEN),
  setRefreshToken: (token: string) => setItem(KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: () => removeItem(KEYS.REFRESH_TOKEN),

  clearAll: async () => {
    await Promise.all([
      removeItem(KEYS.ACCESS_TOKEN),
      removeItem(KEYS.REFRESH_TOKEN),
    ]);
  },
};
