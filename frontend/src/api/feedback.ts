import apiClient from './client';

export type FeedbackCategory =
  | 'app_review'
  | 'feature_request'
  | 'question_set_feedback'
  | 'bug_report'
  | 'complaint';

export interface FeedbackRequest {
  category: FeedbackCategory;
  rating?: number;
  message: string;
  question_set_title?: string;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
}

export const feedbackApi = {
  submit: async (data: FeedbackRequest): Promise<FeedbackResponse> => {
    const response = await apiClient.post('/feedback/', data, {
      skipGlobalErrorModal: true,
    });
    return response.data;
  },
};
