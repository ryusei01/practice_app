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
    content_languages?: string[];
    created_at: string | null;
  }[];
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role: string;
  is_seller: boolean;
  is_premium: boolean;
  created_at: string;
}

export interface CreateAdminRequest {
  email: string;
  password: string;
  username: string;
  role: 'admin';
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

  getUsers: async (skip = 0, limit = 100): Promise<AdminUser[]> => {
    const response = await apiClient.get('/admin/users', { params: { skip, limit } });
    return response.data;
  },

  updateUserRole: async (userId: string, role: string): Promise<AdminUser> => {
    const response = await apiClient.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  },

  deactivateUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/users/${userId}/deactivate`);
    return response.data;
  },

  activateUser: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/admin/users/${userId}/activate`);
    return response.data;
  },

  createAdmin: async (data: CreateAdminRequest): Promise<AdminUser> => {
    const response = await apiClient.post('/admin/create-admin', data);
    return response.data;
  },
};
