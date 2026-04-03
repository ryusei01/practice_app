import apiClient from './client';

export type ContentLanguage = 'ja' | 'en';

/** 一覧の言語絞り込み（すべて / 日本語 / 英語） */
export type LanguageFilter = 'all' | ContentLanguage;

export function resolvedContentLanguage(
  v: ContentLanguage | undefined | null
): ContentLanguage {
  return v === 'en' ? 'en' : 'ja';
}

/** 一覧・詳細での表示用（英語コンテンツは常に "English"） */
export function contentLanguageDisplayLabel(
  lang: ContentLanguage | undefined | null,
  t: (en: string, ja: string) => string
): string {
  return resolvedContentLanguage(lang) === 'en'
    ? 'English'
    : t('Japanese', '日本語');
}

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
  textbook_path: string | null;
  textbook_type: string | null;
  textbook_content: string | null;
  /** API 未更新時は未設定扱い（フィルタでは ja とみなす） */
  content_language?: ContentLanguage;
}

export interface QuestionSetCreate {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
  textbook_path?: string;
  textbook_type?: string;
  textbook_content?: string;
  content_language?: ContentLanguage;
}

export interface QuestionSetUpdate {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
  textbook_path?: string;
  textbook_type?: string;
  textbook_content?: string;
  content_language?: ContentLanguage;
}

export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: number;
  category?: string | null;
  subcategory1?: string | null;
  subcategory2?: string | null;
}

export interface QuestionSetWithQuestions {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  price: number;
  is_published: boolean;
  creator_id: string;
  content_language?: ContentLanguage;
  questions: Question[];
}

export const questionSetsApi = {
  getAll: async (params?: { category?: string; is_published?: boolean; content_language?: ContentLanguage; skip?: number; limit?: number }): Promise<QuestionSet[]> => {
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

  getPurchased: async (): Promise<QuestionSet[]> => {
    const response = await apiClient.get('/question-sets/purchased');
    return response.data;
  },

  download: async (id: string): Promise<QuestionSetWithQuestions> => {
    const response = await apiClient.get(`/question-sets/${id}/download`);
    return response.data;
  },

  exportCSV: async (id: string): Promise<string> => {
    const response = await apiClient.get(`/question-sets/${id}/export-csv`, {
      responseType: 'text',
    });
    return response.data;
  },

  importAnki: async (file: { uri: string; name: string; type: string }): Promise<{ message: string; question_set_id: string; title: string; total_questions: number }> => {
    const formData = new FormData();
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const response = await apiClient.post('/question-sets/import-anki', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
