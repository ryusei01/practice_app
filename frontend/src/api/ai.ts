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
};
