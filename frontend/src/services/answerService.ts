import api from './api';

export interface SubmitAnswerRequest {
  user_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  session_id?: string;
}

export interface Answer {
  id: string;
  user_id: string;
  question_id: string;
  is_correct: boolean;
  answer_time_sec: number;
  try_count: number;
  answered_at: string;
}

export interface UserStats {
  total_attempts: number;
  correct_count: number;
  correct_rate: number;
  avg_time_sec: number;
}

class AnswerService {
  /**
   * 回答を提出
   */
  async submitAnswer(request: SubmitAnswerRequest): Promise<Answer> {
    const response = await api.post('/answers/submit', request);
    return response.data;
  }

  /**
   * 回答履歴を取得
   */
  async getAnswerHistory(
    userId: string,
    questionSetId?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const response = await api.get(`/answers/history/${userId}`, {
      params: {
        question_set_id: questionSetId,
        limit,
        offset,
      },
    });
    return response.data;
  }

  /**
   * ユーザー統計を取得
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const response = await api.get(`/answers/stats/${userId}`);
    return response.data;
  }

  /**
   * 統計を再計算
   */
  async recalculateStats(userId: string): Promise<void> {
    await api.post(`/answers/recalculate-stats/${userId}`);
  }
}

export default new AnswerService();
