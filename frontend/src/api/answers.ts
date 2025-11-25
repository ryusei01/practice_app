import apiClient from './client';

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
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  try_count: number;
  session_id: string;
  answered_at: string;
}

export interface UserStats {
  user_id: string;
  total_answers: number;
  correct_answers: number;
  accuracy_rate: number;
  average_answer_time: number;
  total_study_time: number;
  categories_studied: number;
  last_activity: string | null;
}

export const answersApi = {
  submitAnswer: async (data: SubmitAnswerRequest): Promise<Answer> => {
    const response = await apiClient.post('/answers/submit', data);
    return response.data;
  },

  getAnswerHistory: async (userId: string, questionSetId?: string): Promise<Answer[]> => {
    const response = await apiClient.get(`/answers/history/${userId}`, {
      params: questionSetId ? { question_set_id: questionSetId } : undefined,
    });
    return response.data;
  },

  getUserStats: async (userId: string): Promise<UserStats> => {
    const response = await apiClient.get(`/answers/stats/${userId}`);
    return response.data;
  },
};
