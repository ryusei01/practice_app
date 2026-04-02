import apiClient from './client';
import { tokenStorage } from '../utils/secureStorage';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    is_premium: boolean;
    premium_expires_at: string | null;
  };
}

export const authApi = {
  googleLogin: async (accessToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/google', { access_token: accessToken });
    if (response.data.access_token) {
      await tokenStorage.setAccessToken(response.data.access_token);
    }
    if (response.data.refresh_token) {
      await tokenStorage.setRefreshToken(response.data.refresh_token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    await tokenStorage.clearAll();
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
