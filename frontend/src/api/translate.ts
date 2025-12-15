/**
 * 翻訳API
 */
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8003/api/v1";

export interface TranslateRequest {
  text: string;
  source_lang?: string;  // デフォルト: "auto"
  target_lang: string;
}

export interface TranslateResponse {
  original_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
}

export interface BatchTranslateRequest {
  texts: string[];
  source_lang?: string;
  target_lang: string;
}

export interface BatchTranslateResponse {
  translations: Array<{
    original: string;
    translated: string;
  }>;
  source_lang: string;
  target_lang: string;
}

/**
 * テキストを翻訳する
 */
export const translateText = async (request: TranslateRequest): Promise<TranslateResponse> => {
  const response = await axios.post(`${API_URL}/translate/translate`, {
    text: request.text,
    source_lang: request.source_lang || "auto",
    target_lang: request.target_lang,
  });
  return response.data;
};

/**
 * 複数のテキストを一括翻訳する
 */
export const translateBatch = async (request: BatchTranslateRequest): Promise<BatchTranslateResponse> => {
  const response = await axios.post(`${API_URL}/translate/translate/batch`, {
    texts: request.texts,
    source_lang: request.source_lang || "auto",
    target_lang: request.target_lang,
  });
  return response.data;
};

/**
 * 問題データを翻訳する便利関数
 */
export interface QuestionTranslateRequest {
  question_text: string;
  correct_answer: string;
  explanation?: string;
  target_lang: string;
}

export interface QuestionTranslateResponse {
  question_text: string;
  correct_answer: string;
  explanation?: string;
}

export const translateQuestion = async (
  request: QuestionTranslateRequest
): Promise<QuestionTranslateResponse> => {
  const response = await axios.post(`${API_URL}/translate/translate/question`, {
    question_text: request.question_text,
    correct_answer: request.correct_answer,
    explanation: request.explanation,
    target_lang: request.target_lang,
    source_lang: request.source_lang || "auto",
  });
  return response.data;
};

export interface TextbookTranslateRequest {
  markdown_text: string;
  target_lang: string;
  source_lang?: string;
}

export interface TextbookTranslateResponse {
  original_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
}

/**
 * 教科書（Markdown）を翻訳する
 */
export const translateTextbook = async (
  request: TextbookTranslateRequest
): Promise<TextbookTranslateResponse> => {
  const response = await axios.post(`${API_URL}/translate/translate/textbook`, {
    markdown_text: request.markdown_text,
    target_lang: request.target_lang,
    source_lang: request.source_lang || "auto",
  });
  return response.data;
};

/**
 * 翻訳サービスの状態を取得
 */
export interface TranslationStatus {
  use_local: boolean;
  available: boolean;
  model?: string;
  base_url?: string;
  service?: string;
}

export const getTranslationStatus = async (): Promise<TranslationStatus> => {
  const response = await axios.get(`${API_URL}/translate/translate/status`);
  return response.data;
};

export default {
  translateText,
  translateBatch,
  translateQuestion,
  translateTextbook,
  getTranslationStatus,
};
