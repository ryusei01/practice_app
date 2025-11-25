import apiClient from './client';

export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'text_input';
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: number;
  category: string | null;
  order: number;
  total_attempts: number;
  correct_count: number;
  average_time_sec: number;
}

export interface QuestionCreate {
  question_set_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'text_input';
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty?: number;
  category?: string;
  order?: number;
}

export interface QuestionUpdate {
  question_text?: string;
  question_type?: 'multiple_choice' | 'true_false' | 'text_input';
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  difficulty?: number;
  category?: string;
  order?: number;
}

export const questionsApi = {
  getAll: async (params?: { question_set_id?: string; category?: string; skip?: number; limit?: number }): Promise<Question[]> => {
    const response = await apiClient.get('/questions/', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Question> => {
    const response = await apiClient.get(`/questions/${id}`);
    return response.data;
  },

  create: async (data: QuestionCreate): Promise<Question> => {
    const response = await apiClient.post('/questions/', data);
    return response.data;
  },

  update: async (id: string, data: QuestionUpdate): Promise<Question> => {
    const response = await apiClient.put(`/questions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/questions/${id}`);
  },
};
