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

export type PremiumPlanType = 'monthly' | 'yearly';

export interface PlanOptionDisplay {
  price_jpy: number;
  credit_jpy: number;
  validity_days: number;
  is_available: boolean;
  /** 取り消し線で表示する旧価格（円）。未設定時は省略 */
  strikethrough_price_jpy?: number | null;
  /** 取り消し線で表示する旧クレジット（円）。未設定時は省略 */
  strikethrough_credit_jpy?: number | null;
}

/** GET /subscriptions/plan-display（バックエンド settings 由来の表示用） */
export interface PlanDisplay {
  monthly: PlanOptionDisplay;
  yearly: PlanOptionDisplay;
}

export const subscriptionsApi = {
  /**
   * プレミアム画面向けの表示用価格・クレジット・有効日数を取得する。
   */
  getPlanDisplay: async (): Promise<PlanDisplay> => {
    const response = await apiClient.get('/subscriptions/plan-display');
    return response.data;
  },

  /**
   * プレミアムプランの Stripe Checkout URL を取得する。
   * Web: window.location.href でリダイレクト
   * モバイル: expo-web-browser で開く
   */
  createPremiumCheckout: async (
    planType: PremiumPlanType,
    successUrl: string,
    cancelUrl: string,
    promotionCode?: string,
  ): Promise<CheckoutSession> => {
    const params = new URLSearchParams({
      plan_type: planType,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    const trimmed = promotionCode?.trim();
    if (trimmed) {
      params.set('promotion_code', trimmed);
    }
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
