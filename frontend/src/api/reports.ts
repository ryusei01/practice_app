import apiClient from './client';

export type ReportReason = 'copyright' | 'spam' | 'inappropriate' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export interface ContentReport {
  id: string;
  reporter_id: string;
  question_set_id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportCreate {
  question_set_id: string;
  reason: ReportReason;
  description?: string;
}

export interface ReportUpdate {
  status: ReportStatus;
  admin_note?: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CopyrightCheckResult {
  question_set_id: string;
  risk_level: RiskLevel;
  reasons: string[];
  recommendation: string;
  checked_at: string;
}

export const reportsApi = {
  create: async (data: ReportCreate): Promise<ContentReport> => {
    const response = await apiClient.post('/reports/', data);
    return response.data;
  },

  list: async (params?: {
    status?: ReportStatus;
    reason?: ReportReason;
    skip?: number;
    limit?: number;
  }): Promise<ContentReport[]> => {
    const response = await apiClient.get('/reports/', { params });
    return response.data;
  },

  update: async (reportId: string, data: ReportUpdate): Promise<ContentReport> => {
    const response = await apiClient.put(`/reports/${reportId}`, data);
    return response.data;
  },
};

export const copyrightApi = {
  runCheck: async (questionSetId: string): Promise<CopyrightCheckResult> => {
    const response = await apiClient.post(
      `/question-sets/${questionSetId}/copyright-check`
    );
    return response.data;
  },

  /** 作成者向け。未チェック時は null */
  getLatest: async (
    questionSetId: string
  ): Promise<CopyrightCheckResult | null> => {
    const response = await apiClient.get(
      `/question-sets/${questionSetId}/copyright-check/latest`
    );
    return response.data;
  },
};
