/**
 * 2段階認証（2FA）関連のAPI
 */
import apiClient from "./client";

export interface TwoFactorStatus {
  two_factor_enabled: boolean;
  email: string;
}

export interface Enable2FAResponse {
  message: string;
  backup_codes: string[];
}

/**
 * 2FA有効状態を取得
 */
export const getTwoFactorStatus = async (): Promise<TwoFactorStatus> => {
  const response = await apiClient.get<TwoFactorStatus>("/2fa/status");
  return response.data;
};

/**
 * 2FAを有効化
 */
export const enableTwoFactor = async (): Promise<Enable2FAResponse> => {
  const response = await apiClient.post<Enable2FAResponse>("/2fa/enable");
  return response.data;
};

/**
 * 2FAを無効化
 */
export const disableTwoFactor = async (password: string): Promise<{ message: string }> => {
  const response = await apiClient.post("/2fa/disable", { password });
  return response.data;
};

/**
 * OTPコードを送信
 */
export const sendOTPCode = async (): Promise<{ message: string }> => {
  const response = await apiClient.post("/2fa/send-otp");
  return response.data;
};

/**
 * OTPコードを検証
 */
export const verifyOTPCode = async (code: string): Promise<{ message: string }> => {
  const response = await apiClient.post("/2fa/verify-otp", { code });
  return response.data;
};

/**
 * バックアップコードを検証
 */
export const verifyBackupCode = async (code: string): Promise<{ message: string }> => {
  const response = await apiClient.post("/2fa/verify-backup-code", { code });
  return response.data;
};
