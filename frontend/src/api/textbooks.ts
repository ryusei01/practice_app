import apiClient from './client';

export interface Textbook {
  path: string;
  name: string;
  type: 'markdown' | 'pdf';
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



