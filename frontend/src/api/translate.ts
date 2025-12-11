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
  const texts = [request.question_text, request.correct_answer];
  if (request.explanation) {
    texts.push(request.explanation);
  }

  const result = await translateBatch({
    texts,
    target_lang: request.target_lang,
  });

  return {
    question_text: result.translations[0].translated,
    correct_answer: result.translations[1].translated,
    explanation: request.explanation ? result.translations[2].translated : undefined,
  };
};

export default {
  translateText,
  translateBatch,
  translateQuestion,
};
