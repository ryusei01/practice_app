import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { authApi, AuthResponse } from '../api/auth';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
}

interface RegisterPendingResponse {
  user_id: string;
  email: string;
  message: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string) => Promise<RegisterPendingResponse>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // トークンがない場合は認証チェックをスキップ
      const token = await AsyncStorage.getItem('access_token');
      console.log('[AuthContext] Checking auth, token exists:', !!token);
      if (!token) {
        console.log('[AuthContext] No token found, user not authenticated');
        setUser(null);
        setIsLoading(false);
        return;
      }

      // OTP検証ページではAPIを呼ばない
      const currentPath = window.location.pathname;
      if (currentPath.includes('verify-otp')) {
        console.log('[AuthContext] On OTP verification page, skipping auth check');
        setIsLoading(false);
        return;
      }

      console.log('[AuthContext] Fetching current user data...');
      const userData = await authApi.getCurrentUser();
      console.log('[AuthContext] User authenticated:', userData.email);
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      setUser(null);

      // indexページ以外でエラーが発生した場合のみリダイレクト
      try {
        const currentPath = window.location.pathname;
        // indexページ、ログインページ、新規登録ページ、OTP検証ページはリダイレクトしない
        if (currentPath === '/' || currentPath.includes('login') || currentPath.includes('register') || currentPath.includes('verify-otp')) {
          // 何もしない
        } else if (currentPath.includes('(trial)')) {
          // お試しページにいる場合はお試しページに戻す
          router.replace('/(trial)/question-sets');
        } else {
          // それ以外はログイン画面へ
          router.replace('/(auth)/login');
        }
      } catch (navError) {
        console.error('Navigation failed:', navError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response: AuthResponse = await authApi.login({ email, password });
      setUser(response.user);
    } catch (error) {
      // エラーを再スローして、呼び出し元でキャッチできるようにする
      throw error;
    }
  };

  const register = async (email: string, password: string, full_name: string) => {
    const response = await authApi.register({ email, password, full_name });
    return response;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
