import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// 環境変数からAPI URLを取得（デフォルトは開発環境用）
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://127.0.0.1:8003/api/v1";

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

// リクエストインターセプター: トークンを自動的に付与
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("access_token");
    console.log('[API Client] Request:', config.method?.toUpperCase(), config.url);
    console.log('[API Client] Token exists:', !!token);
    if (token) {
      console.log('[API Client] Token (first 20 chars):', token.substring(0, 20));
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('[API Client] No access token found in AsyncStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター: 401エラー時に自動的にトークンをリフレッシュ
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 401エラーかつリトライしていない場合
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // すでにリフレッシュ中の場合は、キューに追加して待機
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refresh_token");

        if (!refreshToken) {
          // リフレッシュトークンがない場合はログアウト
          await AsyncStorage.removeItem("access_token");
          await AsyncStorage.removeItem("refresh_token");
          processQueue(new Error("No refresh token available"));
          return Promise.reject(error);
        }

        // リフレッシュトークンを使って新しいアクセストークンを取得
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const { access_token, refresh_token: new_refresh_token } =
          response.data;

        // 新しいトークンを保存
        await AsyncStorage.setItem("access_token", access_token);
        await AsyncStorage.setItem("refresh_token", new_refresh_token);

        // 元のリクエストのヘッダーを更新
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null);
        isRefreshing = false;

        // 元のリクエストを再実行
        return apiClient(originalRequest);
      } catch (refreshError) {
        // リフレッシュに失敗した場合はログアウト
        await AsyncStorage.removeItem("access_token");
        await AsyncStorage.removeItem("refresh_token");
        processQueue(refreshError);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
