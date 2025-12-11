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
  subcategory1: string | null;
  subcategory2: string | null;
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
  subcategory1?: string;
  subcategory2?: string;
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
  subcategory1?: string;
  subcategory2?: string;
  order?: number;
}

export interface QuestionGroup {
  category: string | null;
  subcategory1: string | null;
  subcategory2: string | null;
  count: number;
  questions: Question[];
}

export const questionsApi = {
  getAll: async (params?: { question_set_id?: string; category?: string; subcategory1?: string; subcategory2?: string; skip?: number; limit?: number }): Promise<Question[]> => {
    console.log('[questionsApi.getAll] Request params:', params);
    const response = await apiClient.get('/questions/', { params });
    console.log('[questionsApi.getAll] Response:', response.data?.length || 0, 'questions');
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

  bulkUploadCSV: async (questionSetId: string, file: { uri: string; name: string; type: string }): Promise<{ message: string; total_created: number; total_errors: number; errors: string[] | null }> => {
    const formData = new FormData();

    // Web環境ではblob URIから実際のBlobを取得
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      // ネイティブ環境用（将来の拡張のため）
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    }

    const response = await apiClient.post(`/questions/bulk-upload/${questionSetId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  selectQuestionsByAI: async (questionSetId: string, count: number): Promise<Question[]> => {
    const response = await apiClient.get(`/questions/select/ai/${questionSetId}`, {
      params: { count },
    });
    return response.data;
  },

  selectQuestionsByRange: async (questionSetId: string, start: number, count: number): Promise<Question[]> => {
    const response = await apiClient.get(`/questions/select/range/${questionSetId}`, {
      params: { start, count },
    });
    return response.data;
  },

  getGroups: async (questionSetId: string, groupBy?: 'category' | 'subcategory1' | 'subcategory2'): Promise<QuestionGroup[]> => {
    const response = await apiClient.get(`/questions/groups/${questionSetId}`, {
      params: { group_by: groupBy || 'subcategory1' },
    });
    return response.data;
  },
};
