import apiClient from './client';

export interface PremiumStatus {
  is_premium: boolean;
  premium_expires_at: string | null;
  account_credit_jpy: number;
}

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}

export const subscriptionsApi = {
  /**
   * 550円プランの Stripe Checkout URL を取得する。
   * Web: window.location.href でリダイレクト
   * モバイル: expo-web-browser で開く
   */
  createPremiumCheckout: async (
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSession> => {
    const params = new URLSearchParams({ success_url: successUrl, cancel_url: cancelUrl });
    const response = await apiClient.post(
      `/subscriptions/create-checkout?${params.toString()}`,
    );
    return response.data;
  },

  getPremiumStatus: async (): Promise<PremiumStatus> => {
    const response = await apiClient.get('/subscriptions/status');
    return response.data;
  },
};
