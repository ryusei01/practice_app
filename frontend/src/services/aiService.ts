import api from './api';

export interface RecommendationRequest {
  user_id: string;
  question_set_id: string;
  count?: number;
  target_difficulty?: number;
}

export interface ScorePredictionRequest {
  user_id: string;
  question_set_id?: string;
  max_score?: number;
}

export interface ScorePrediction {
  predicted_score: number;
  confidence: number;
  base_score: number;
  adjustments: {
    speed: number;
    trend: number;
    difficulty: number;
  };
  stats: {
    correct_rate: number;
    total_attempts: number;
    avg_time_sec: number;
  };
}

export interface ImprovementSuggestion {
  type: string;
  category?: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LearningPlanDay {
  day: number;
  tasks: string[];
}

export interface LearningPlanWeek {
  week: number;
  theme: string;
  milestone: string;
  days: LearningPlanDay[];
}

export interface LearningPlanResponse {
  goal: string;
  weeks: LearningPlanWeek[];
  raw_response?: string;
  fallback?: boolean;
}

export interface GenerateLearningPlanBody {
  goal: string;
  weeks: number;
  daily_hours: number;
  weak_categories?: string[];
}

class AIService {
  /**
   * AIによる問題推薦を取得
   */
  async getRecommendations(request: RecommendationRequest): Promise<string[]> {
    const response = await api.post('/ai/recommend', request);
    return response.data.question_ids;
  }

  /**
   * 予想スコアを取得
   */
  async predictScore(request: ScorePredictionRequest): Promise<ScorePrediction> {
    const response = await api.post('/ai/predict-score', request);
    return response.data;
  }

  /**
   * カテゴリ別の予想スコアを取得
   */
  async getCategoryPredictions(userId: string, maxScore: number = 100) {
    const response = await api.get(`/ai/category-predictions/${userId}`, {
      params: { max_score: maxScore },
    });
    return response.data;
  }

  /**
   * 改善提案を取得
   */
  async getImprovementSuggestions(userId: string): Promise<ImprovementSuggestion[]> {
    const response = await api.get(`/ai/improvement-suggestions/${userId}`);
    return response.data.suggestions;
  }

  /**
   * 適応型難易度を取得
   */
  async getAdaptiveDifficulty(userId: string, category: string): Promise<number> {
    const response = await api.get(`/ai/adaptive-difficulty/${userId}/${category}`);
    return response.data.recommended_difficulty;
  }

  /**
   * Ollama 経由で学習プランを生成（タイムアウト長め）
   */
  async generateLearningPlan(body: GenerateLearningPlanBody): Promise<LearningPlanResponse> {
    const response = await api.post<LearningPlanResponse>('/ai/generate-learning-plan', body, {
      timeout: 180000,
    });
    return response.data;
  }
}

export default new AIService();
