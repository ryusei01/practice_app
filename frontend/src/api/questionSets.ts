import apiClient from './client';

export interface QuestionSet {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  price: number;
  is_published: boolean;
  creator_id: string;
  total_questions: number;
  average_difficulty: number;
  total_purchases: number;
  average_rating: number;
}

export interface QuestionSetCreate {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
}

export interface QuestionSetUpdate {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
}

export const questionSetsApi = {
  getAll: async (params?: { category?: string; is_published?: boolean; skip?: number; limit?: number }): Promise<QuestionSet[]> => {
    const response = await apiClient.get('/question-sets/', { params });
    return response.data;
  },

  getById: async (id: string): Promise<QuestionSet> => {
    const response = await apiClient.get(`/question-sets/${id}`);
    return response.data;
  },

  getMy: async (): Promise<QuestionSet[]> => {
    const response = await apiClient.get('/question-sets/my/question-sets');
    return response.data;
  },

  create: async (data: QuestionSetCreate): Promise<QuestionSet> => {
    const response = await apiClient.post('/question-sets/', data);
    return response.data;
  },

  update: async (id: string, data: QuestionSetUpdate): Promise<QuestionSet> => {
    const response = await apiClient.put(`/question-sets/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/question-sets/${id}`);
  },
};
