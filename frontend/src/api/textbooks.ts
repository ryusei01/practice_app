import apiClient from './client';

export type TextbookLanguage = 'ja' | 'en';

export interface Textbook {
  path: string;
  name: string;
  type: 'markdown' | 'pdf';
  language: TextbookLanguage;
}

export const textbooksApi = {
  /**
   * 利用可能な教科書のリストを取得
   */
  getAvailable: async (): Promise<Textbook[]> => {
    const response = await apiClient.get('/textbooks/');
    return response.data;
  },
};













