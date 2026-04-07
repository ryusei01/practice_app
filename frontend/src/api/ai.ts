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

export type AiContentLanguage = 'ja' | 'en';

function appendImageLangParams(
  params: URLSearchParams,
  langs?: AiContentLanguage[]
) {
  const n = (langs ?? []).filter((x): x is AiContentLanguage => x === 'ja' || x === 'en');
  for (const x of n) {
    params.append('content_languages', x);
  }
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

  generateFromImage: async (
    file: { uri: string; name: string; type: string },
    count: number = 5,
    contentLanguages?: AiContentLanguage[],
  ): Promise<GeneratedQuestionsResponse> => {
    const formData = new FormData();
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const params = new URLSearchParams({ count: String(count) });
    appendImageLangParams(params, contentLanguages);
    const response = await apiClient.post(`/ai/generate-from-image?${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  generateFromText: async (
    text: string,
    count?: number,
    contentLanguages?: AiContentLanguage[],
  ): Promise<GeneratedQuestionsResponse> => {
    const body: Record<string, unknown> = { text };
    if (count != null) body.count = count;
    const n = (contentLanguages ?? []).filter((x): x is AiContentLanguage => x === 'ja' || x === 'en');
    if (n.length === 1) {
      body.content_language = n[0];
    } else if (n.length >= 2) {
      body.content_languages = n;
    }
    const response = await apiClient.post('/ai/generate-from-text', body, { timeout: 120000 });
    return response.data;
  },
};
