import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl || "http://localhost:8003/api/v1";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// リクエストインターセプター（認証トークンを自動付与）
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター（エラーハンドリング）
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // 認証エラー → トークンをクリアしてログイン画面へ
      console.log("Unauthorized, redirect to login");
      await AsyncStorage.removeItem("access_token");
      router.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
