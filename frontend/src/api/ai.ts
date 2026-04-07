import apiClient from './client';

export interface RecommendationRequest {
  user_id: string;
  question_set_id: string;
  count?: number;
  target_difficulty?: number;
}

export interface RecommendationResponse {
  question_ids: string[];
  count: number;
}

export interface ScorePredictionRequest {
  user_id: string;
  question_set_id?: string;
  max_score?: number;
}

export interface ScorePrediction {
  predicted_score: number;
  confidence: number;
  max_score: number;
}

export interface CategoryPrediction {
  category: string;
  predicted_score: number;
  confidence: number;
  max_score: number;
}

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  priority: number;
}

export interface GeneratedQuestion {
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: number;
  category: string | null;
}

export interface GeneratedQuestionsResponse {
  questions: GeneratedQuestion[];
  total: number;
}

export const aiApi = {
  recommendQuestions: async (data: RecommendationRequest): Promise<RecommendationResponse> => {
    const response = await apiClient.post('/ai/recommend', data);
    return response.data;
  },

  predictScore: async (data: ScorePredictionRequest): Promise<ScorePrediction> => {
    const response = await apiClient.post('/ai/predict-score', data);
    return response.data;
  },

  getCategoryPredictions: async (userId: string, maxScore: number = 100): Promise<CategoryPrediction[]> => {
    const response = await apiClient.get(`/ai/category-predictions/${userId}`, {
      params: { max_score: maxScore },
    });
    return response.data;
  },

  getImprovementSuggestions: async (userId: string): Promise<ImprovementSuggestion[]> => {
    const response = await apiClient.get(`/ai/improvement-suggestions/${userId}`);
    return response.data.suggestions;
  },

  getAdaptiveDifficulty: async (userId: string, category: string): Promise<{ category: string; recommended_difficulty: number }> => {
    const response = await apiClient.get(`/ai/adaptive-difficulty/${userId}/${category}`);
    return response.data;
  },

  generateFromImage: async (file: { uri: string; name: string; type: string }, count: number = 5): Promise<GeneratedQuestionsResponse> => {
    const formData = new FormData();
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const response = await apiClient.post(`/ai/generate-from-image?count=${count}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  generateFromText: async (
    text: string,
    count?: number,
    contentLanguage?: string,
  ): Promise<GeneratedQuestionsResponse> => {
    const body: Record<string, unknown> = { text };
    if (count != null) body.count = count;
    if (contentLanguage) body.content_language = contentLanguage;
    const response = await apiClient.post('/ai/generate-from-text', body, { timeout: 120000 });
    return response.data;
  },
};
