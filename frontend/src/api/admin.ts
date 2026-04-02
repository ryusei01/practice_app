import apiClient from './client';

export interface SellerApplication {
  id: string;
  email: string;
  username: string;
  seller_application_status: string;
  seller_application_submitted_at: string | null;
  seller_application_admin_note: string | null;
  is_seller: boolean;
  created_at: string;
  pending_question_sets: {
    id: string;
    title: string;
    category: string;
    total_questions: number;
    content_language?: string;
    created_at: string | null;
  }[];
}

export const adminApi = {
  getSellerApplications: async (statusFilter?: string): Promise<SellerApplication[]> => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status_filter = statusFilter;
    const response = await apiClient.get('/admin/seller-applications', { params });
    return response.data;
  },

  approveSellerApplication: async (userId: string, adminNote?: string): Promise<SellerApplication> => {
    const response = await apiClient.post(`/admin/seller-applications/${userId}/approve`, {
      admin_note: adminNote || null,
    });
    return response.data;
  },

  rejectSellerApplication: async (userId: string, adminNote: string): Promise<SellerApplication> => {
    const response = await apiClient.post(`/admin/seller-applications/${userId}/reject`, {
      admin_note: adminNote,
    });
    return response.data;
  },
};
