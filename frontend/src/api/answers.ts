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

export interface LocalAnswerData {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  session_id?: string;
  answered_at: string;
}

export interface LocalQuestionData {
  question_text: string;
  question_type: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: number;
}

export interface LocalQuestionSetData {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price: number;
  is_published: boolean;
  questions: LocalQuestionData[];
}

export interface MigrateLocalDataRequest {
  answers: LocalAnswerData[];
  question_sets: LocalQuestionSetData[];
}

export interface MigrationResult {
  message: string;
  migrated_counts: {
    answers: number;
    question_sets: number;
    questions: number;
  };
}

export interface EvaluateTextAnswerRequest {
  question_id: string;
  user_answer: string;
}

export interface EvaluationResult {
  is_correct: boolean;
  confidence: number;
  feedback: string;
  exact_match: boolean;
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

  migrateLocalData: async (data: MigrateLocalDataRequest): Promise<MigrationResult> => {
    const response = await apiClient.post('/answers/migrate-local-data', data);
    return response.data;
  },

  evaluateTextAnswer: async (data: EvaluateTextAnswerRequest): Promise<EvaluationResult> => {
    const response = await apiClient.post('/answers/evaluate-text', data);
    return response.data;
  },
};
