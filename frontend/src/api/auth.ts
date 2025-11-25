import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
  };
}

export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data);
    if (response.data.access_token) {
      await AsyncStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);

    if (response.data.access_token) {
      await AsyncStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem('access_token');
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
