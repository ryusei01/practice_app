import { router } from 'expo-router';

/**
 * グローバルなナビゲーション参照
 * APIクライアントなどコンポーネント外からナビゲーションを実行するために使用
 */

export function navigateToLogin() {
  try {
    router.replace('/(auth)/login');
  } catch (error) {
    console.error('[Navigation] Failed to navigate to login:', error);
  }
}

export function reset(routeName: string) {
  try {
    router.replace(routeName as any);
  } catch (error) {
    console.error('[Navigation] Failed to reset to', routeName, error);
  }
}
