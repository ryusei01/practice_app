import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { authApi, AuthResponse } from '../api/auth';
import { tokenStorage } from '../utils/secureStorage';
import { authEvents } from '../utils/authEvents';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_seller: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  account_credit_jpy: number;
  role: string;
  seller_application_status: string;
  seller_application_admin_note: string | null;
  created_at: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  /** サーバーの最新ユーザー情報を再取得（決済完了直後の is_premium 反映など） */
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionExpiredHandled = useRef(false);

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiredHandled.current) return;
    sessionExpiredHandled.current = true;

    setUser(null);

    const navigateToLogin = () => {
      try {
        router.replace('/(auth)/login');
      } catch {
        // navigation not ready
      }
    };

    if (Platform.OS === 'web') {
      window.alert('セッションの有効期限が切れました。再度ログインしてください。');
      navigateToLogin();
    } else {
      Alert.alert(
        'セッション期限切れ',
        'セッションの有効期限が切れました。再度ログインしてください。',
        [{ text: 'OK', onPress: navigateToLogin }],
      );
    }

    setTimeout(() => {
      sessionExpiredHandled.current = false;
    }, 3000);
  }, []);

  useEffect(() => {
    return authEvents.onSessionExpired(handleSessionExpired);
  }, [handleSessionExpired]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      await tokenStorage.clearAll();
      setUser(null);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const currentPath = window.location.pathname;
          const isPublicPath =
            currentPath === '/' ||
            currentPath.includes('login') ||
            currentPath === '/question-sets' ||
            currentPath === '/trial-question-sets' ||
            currentPath.startsWith('/set/') ||
            currentPath.startsWith('/textbook/');

          if (!isPublicPath) {
            router.replace('/(auth)/login');
          }
        } catch (navError) {
          console.error('Navigation failed:', navError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (accessToken: string) => {
    const response: AuthResponse = await authApi.googleLogin(accessToken);
    setUser(response.user);
    router.replace('/(app)/dashboard');
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        setUser(null);
        return null;
      }
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('refreshUser failed:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
