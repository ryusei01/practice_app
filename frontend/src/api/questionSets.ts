import apiClient from './client';
import { tokenStorage } from '../utils/secureStorage';

export type ContentLanguage = 'ja' | 'en';

/** 一覧の言語絞り込み（すべて / 日本語 / 英語） */
export type LanguageFilter = 'all' | ContentLanguage;

export type ContentLanguageMask = { ja: boolean; en: boolean };

export function normalizeContentLanguages(
  languages: ContentLanguage[] | undefined | null,
  legacy?: ContentLanguage | null
): ContentLanguage[] {
  const out: ContentLanguage[] = [];
  if (languages && languages.length) {
    for (const x of languages) {
      if ((x === 'ja' || x === 'en') && !out.includes(x)) {
        out.push(x);
      }
    }
  }
  if (out.length === 0 && legacy && (legacy === 'ja' || legacy === 'en')) {
    return [legacy];
  }
  if (out.length === 0) {
    return ['ja'];
  }
  return out;
}

export function languagesFromMask(mask: ContentLanguageMask): ContentLanguage[] {
  const out: ContentLanguage[] = [];
  if (mask.ja) out.push('ja');
  if (mask.en) out.push('en');
  return out.length ? out : ['ja'];
}

export function maskFromLanguages(
  langs: ContentLanguage[] | undefined | null,
  legacy?: ContentLanguage | null
): ContentLanguageMask {
  const n = normalizeContentLanguages(langs, legacy ?? null);
  return { ja: n.includes('ja'), en: n.includes('en') };
}

export function toggleMaskLang(
  mask: ContentLanguageMask,
  lang: ContentLanguage
): ContentLanguageMask {
  const key = lang === 'en' ? 'en' : 'ja';
  const next = { ...mask, [key]: !mask[key] };
  if (!next.ja && !next.en) {
    return mask;
  }
  return next;
}

/** @deprecated 単一言語前提。複数対応は normalizeContentLanguages を使う */
export function resolvedContentLanguage(
  v: ContentLanguage | undefined | null
): ContentLanguage {
  return v === 'en' ? 'en' : 'ja';
}

export function contentLanguagesDisplayLabel(
  languages: ContentLanguage[] | undefined | null,
  legacy: ContentLanguage | undefined | null,
  t: (en: string, ja: string) => string
): string {
  const n = normalizeContentLanguages(languages, legacy ?? null);
  if (n.length === 2) {
    return t('Japanese & English', '日本語・英語');
  }
  return n[0] === 'en' ? 'English' : t('Japanese', '日本語');
}

/** 単一フィールドしかない箇所向け */
export function contentLanguageDisplayLabel(
  lang: ContentLanguage | undefined | null,
  t: (en: string, ja: string) => string
): string {
  return contentLanguagesDisplayLabel(undefined, lang, t);
}

export function questionSetMatchesLanguageFilter(
  languages: ContentLanguage[] | undefined | null,
  legacy: ContentLanguage | undefined | null,
  filter: LanguageFilter
): boolean {
  if (filter === 'all') return true;
  return normalizeContentLanguages(languages, legacy ?? null).includes(filter);
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  price: number;
  is_published: boolean;
  creator_id: string;
  total_questions: number;
  average_difficulty: number;
  total_purchases: number;
  average_rating: number;
  textbook_path: string | null;
  textbook_type: string | null;
  textbook_content: string | null;
  content_languages?: ContentLanguage[];
  content_language?: ContentLanguage;
}

export interface QuestionSetCreate {
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
  textbook_path?: string;
  textbook_type?: string;
  textbook_content?: string;
  content_language?: ContentLanguage;
  content_languages?: ContentLanguage[];
}

export interface QuestionSetUpdate {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  price?: number;
  is_published?: boolean;
  textbook_path?: string;
  textbook_type?: string;
  textbook_content?: string;
  content_language?: ContentLanguage;
  content_languages?: ContentLanguage[];
}

export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: number;
  category?: string | null;
  subcategory1?: string | null;
  subcategory2?: string | null;
}

export interface QuestionSetWithQuestions {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  price: number;
  is_published: boolean;
  creator_id: string;
  content_languages?: ContentLanguage[];
  content_language?: ContentLanguage;
  questions: Question[];
}

export const questionSetsApi = {
  getAll: async (params?: { category?: string; is_published?: boolean; content_language?: ContentLanguage; skip?: number; limit?: number }): Promise<QuestionSet[]> => {
    const response = await apiClient.get('/question-sets/', { params });
    return response.data;
  },

  getById: async (
    id: string,
    extra?: { skipGlobalErrorModal?: boolean }
  ): Promise<QuestionSet> => {
    const response = await apiClient.get(`/question-sets/${id}`, extra);
    return response.data;
  },

  getMy: async (): Promise<QuestionSet[]> => {
    const response = await apiClient.get('/question-sets/my/question-sets');
    return response.data;
  },

  create: async (data: QuestionSetCreate): Promise<QuestionSet> => {
    const response = await apiClient.post('/question-sets/', data);
    return response.data;
  },

  update: async (id: string, data: QuestionSetUpdate): Promise<QuestionSet> => {
    const response = await apiClient.put(`/question-sets/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/question-sets/${id}`);
  },

  getPurchased: async (extra?: {
    skipGlobalErrorModal?: boolean;
  }): Promise<QuestionSet[]> => {
    const response = await apiClient.get("/question-sets/purchased", extra);
    return response.data;
  },

  download: async (id: string): Promise<QuestionSetWithQuestions> => {
    const response = await apiClient.get(`/question-sets/${id}/download`);
    return response.data;
  },

  exportCSV: async (id: string): Promise<string> => {
    const response = await apiClient.get(`/question-sets/${id}/export-csv`, {
      responseType: 'text',
    });
    return response.data;
  },

  getExportPdfRequest: async (
    id: string,
    opts?: { includeAnswers?: boolean; questionNumbers?: string }
  ): Promise<{ url: string; headers: Record<string, string> }> => {
    const token = await tokenStorage.getAccessToken();
    const baseURL = (apiClient.defaults.baseURL || '').replace(/\/+$/, '');
    const params = new URLSearchParams();
    if (opts?.includeAnswers !== undefined) {
      params.set("include_answers", opts.includeAnswers ? "true" : "false");
    }
    if (opts?.questionNumbers && opts.questionNumbers.trim()) {
      params.set("question_numbers", opts.questionNumbers.trim());
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    const url = `${baseURL}/question-sets/${id}/export-pdf${qs}`;
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return { url, headers };
  },

  renderPdfFromPayload: async (
    payload: {
      title: string;
      description?: string | null;
      questions: Array<{
        question_text: string;
        question_type: string;
        options?: string[] | null;
        correct_answer?: string | null;
        explanation?: string | null;
      }>;
    },
    opts?: { includeAnswers?: boolean; skipGlobalErrorModal?: boolean }
  ): Promise<ArrayBuffer> => {
    const include = opts?.includeAnswers;
    const qs =
      include === undefined
        ? ""
        : `?include_answers=${include ? "true" : "false"}`;
    const res = await apiClient.post(`/question-sets/render-pdf${qs}`, payload, {
      ...(opts?.skipGlobalErrorModal ? { skipGlobalErrorModal: true } : {}),
      responseType: "arraybuffer",
      headers: { "Content-Type": "application/json" },
    });
    return res.data as ArrayBuffer;
  },

  importAnki: async (file: { uri: string; name: string; type: string }): Promise<{ message: string; question_set_id: string; title: string; total_questions: number }> => {
    const formData = new FormData();
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const response = await apiClient.post('/question-sets/import-anki', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  parseAnki: async (file: { uri: string; name: string; type: string }): Promise<{
    title: string;
    questions: Array<{
      question_text: string;
      correct_answer: string;
      question_type: string;
      options: string[] | null;
      media_urls: Array<{ type: string; url: string; position: string }> | null;
      tags: string[];
    }>;
    total: number;
  }> => {
    const formData = new FormData();
    if (file.uri.startsWith('blob:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append('file', blob, file.name);
    } else {
      formData.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    }
    const response = await apiClient.post('/question-sets/parse-anki', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
