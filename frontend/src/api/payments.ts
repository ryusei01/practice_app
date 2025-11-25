import apiClient from './client';

export interface CreatePaymentIntentRequest {
  question_set_id: string;
  return_url?: string;
}

export interface CreatePaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  seller_amount: number;
  platform_fee: number;
}

export interface Purchase {
  id: string;
  question_set_id: string;
  amount: number;
  purchased_at: string;
}

export interface SellerDashboard {
  is_connected: boolean;
  stripe_account_id: string | null;
  total_sales: number;
  total_earnings: number;
  total_orders: number;
  question_sets_count: number;
}

export const paymentsApi = {
  createPaymentIntent: async (data: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> => {
    const response = await apiClient.post('/payments/create-payment-intent', data);
    return response.data;
  },

  confirmPurchase: async (paymentIntentId: string): Promise<any> => {
    const response = await apiClient.post('/payments/confirm-purchase', null, {
      params: { payment_intent_id: paymentIntentId },
    });
    return response.data;
  },

  createConnectAccountLink: async (returnUrl: string, refreshUrl: string): Promise<{ url: string; account_id: string }> => {
    const response = await apiClient.post('/payments/create-connect-account-link', {
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return response.data;
  },

  getMyPurchases: async (): Promise<Purchase[]> => {
    const response = await apiClient.get('/payments/my-purchases');
    return response.data;
  },

  getSellerDashboard: async (): Promise<SellerDashboard> => {
    const response = await apiClient.get('/payments/seller-dashboard');
    return response.data;
  },
};
