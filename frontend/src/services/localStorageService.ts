import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContentLanguage } from "../api/questionSets";
import { normalizeContentLanguages } from "../api/questionSets";
import { normalizeMultipleChoiceAnswer } from "../utils/multipleChoice";

export interface LocalQuestionSet {
  id: string;
  title: string;
  description: string;
  questions: LocalQuestion[];
  createdAt: string;
  isTrial: boolean; // お試し版フラグ
  redSheetEnabled?: boolean; // 赤シート機能の有効/無効
  textbook_path?: string; // 教科書ファイルのパス
  textbook_type?: string; // "markdown" または "pdf"
  /** 未設定はフィルタ時に ja とみなす */
  content_language?: ContentLanguage;
  /** 複数言語（未設定時は content_language から補完） */
  content_languages?: ContentLanguage[];
}

export interface LocalMediaItem {
  type: "image" | "audio";
  /** Full local URI (file:// or data:) for the media file */
  url: string;
  position: "question" | "answer";
  caption?: string;
}

export interface LocalQuestion {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  question_type?: "multiple_choice" | "true_false" | "text_input";
  options?: string[];
  media_urls?: LocalMediaItem[];
}

export interface RedSheetProgress {
  questionSetId: string;
  lastIndex: number;
  totalQuestions: number;
  viewedIndices: number[];
  filterState?: {
    category?: string;
    difficulty?: string;
    questionIds?: string[];
  };
  updatedAt: string;
}

const TRIAL_QUESTION_SETS_KEY = "@trial_question_sets";
const TRIAL_RESULTS_KEY = "@trial_results";
const DEFAULT_INITIALIZED_KEY = "@default_initialized";
const REDSHEET_PROGRESS_PREFIX = "@redsheet_progress_";
const REDSHEET_MODE_PREFIX = "@redsheet_mode_";

export const localStorageService = {
  // 問題セット一覧を取得
  async getTrialQuestionSets(): Promise<LocalQuestionSet[]> {
    try {
      console.log('[LocalStorage] Getting trial question sets from key:', TRIAL_QUESTION_SETS_KEY);
      const data = await AsyncStorage.getItem(TRIAL_QUESTION_SETS_KEY);
      const sets = data ? JSON.parse(data) : [];
      console.log('[LocalStorage] Found', sets.length, 'question sets');
      return sets;
    } catch (error) {
      console.error("Error getting trial question sets:", error);
      return [];
    }
  },

  // 問題セットを保存
  async saveTrialQuestionSet(
    questionSet: Omit<LocalQuestionSet, "id" | "createdAt" | "isTrial">
  ): Promise<LocalQuestionSet> {
    try {
      const sets = await this.getTrialQuestionSets();
      const langs = normalizeContentLanguages(
        questionSet.content_languages,
        questionSet.content_language ?? null
      );
      const newSet: LocalQuestionSet = {
        ...questionSet,
        id: `trial_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isTrial: true,
        content_languages: langs,
        content_language: langs[0],
        // 教科書は自動割り当てしない（明示的に設定されていない場合は未設定）
        textbook_path: questionSet.textbook_path,
        textbook_type: questionSet.textbook_type,
      };
      sets.push(newSet);
      await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
      return newSet;
    } catch (error) {
      console.error("Error saving trial question set:", error);
      throw error;
    }
  },

  // 特定の問題セットを取得
  async getTrialQuestionSet(id: string): Promise<LocalQuestionSet | null> {
    try {
      const sets = await this.getTrialQuestionSets();
      return sets.find((set) => set.id === id) || null;
    } catch (error) {
      console.error("Error getting trial question set:", error);
      return null;
    }
  },

  // 問題セットを削除
  async deleteTrialQuestionSet(id: string): Promise<void> {
    try {
      const sets = await this.getTrialQuestionSets();
      const filtered = sets.filter((set) => set.id !== id);
      await AsyncStorage.setItem(
        TRIAL_QUESTION_SETS_KEY,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error("Error deleting trial question set:", error);
      throw error;
    }
  },

  // 問題セットを更新
  async updateTrialQuestionSet(
    id: string,
    updates: Partial<Omit<LocalQuestionSet, "id" | "createdAt" | "isTrial">>
  ): Promise<LocalQuestionSet | null> {
    try {
      const sets = await this.getTrialQuestionSets();
      const index = sets.findIndex((set) => set.id === id);
      if (index === -1) return null;

      sets[index] = { ...sets[index], ...updates };
      await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
      return sets[index];
    } catch (error) {
      console.error("Error updating trial question set:", error);
      throw error;
    }
  },

  async addQuestionToTrialSet(
    setId: string,
    question: Omit<LocalQuestion, "id">
  ): Promise<LocalQuestion> {
    const sets = await this.getTrialQuestionSets();
    const index = sets.findIndex((s) => s.id === setId);
    if (index === -1) throw new Error("Question set not found");

    const newQuestion: LocalQuestion = {
      ...question,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    sets[index].questions.push(newQuestion);
    await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
    return newQuestion;
  },

  // クイズ結果を保存
  async saveTrialResult(
    questionSetId: string,
    result: {
      score: number;
      totalQuestions: number;
      completedAt: string;
    }
  ): Promise<void> {
    try {
      const resultsData = await AsyncStorage.getItem(TRIAL_RESULTS_KEY);
      const results = resultsData ? JSON.parse(resultsData) : {};

      if (!results[questionSetId]) {
        results[questionSetId] = [];
      }

      results[questionSetId].push(result);
      await AsyncStorage.setItem(TRIAL_RESULTS_KEY, JSON.stringify(results));
    } catch (error) {
      console.error("Error saving trial result:", error);
      throw error;
    }
  },

  // すべてのお試しデータをクリア
  async clearAllTrialData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        TRIAL_QUESTION_SETS_KEY,
        TRIAL_RESULTS_KEY,
      ]);
    } catch (error) {
      console.error("Error clearing trial data:", error);
      throw error;
    }
  },

  // デフォルト問題セットを初期化
  async initializeDefaultQuestions(
    defaultSets: Omit<LocalQuestionSet, "id" | "createdAt" | "isTrial">[]
  ): Promise<void> {
    try {
      console.log('[LocalStorage] initializeDefaultQuestions called with', defaultSets.length, 'sets');
      
      const existingSets = await this.getTrialQuestionSets();
      console.log('[LocalStorage] Existing sets:', existingSets.length);

      // 既存のdefault_セットを取得
      const existingDefaultSets = existingSets.filter(set => set.id.startsWith('default_'));
      const existingDefaultTitles = new Set(existingDefaultSets.map(set => set.title));

      // 新しいセットを追加または更新
      for (const defaultSet of defaultSets) {
        const existingSet = existingDefaultSets.find(set => set.title === defaultSet.title);
        
        if (existingSet) {
          // 既存セットを更新
          console.log('[LocalStorage] Updating existing set:', defaultSet.title);
          
          // 既存のプロパティを保持しつつ、新しいプロパティを追加
          existingSet.title = defaultSet.title;
          existingSet.description = defaultSet.description;
          existingSet.questions = defaultSet.questions;
          existingSet.isTrial = true;
          {
            const langs = normalizeContentLanguages(
              defaultSet.content_languages,
              (defaultSet.content_language ??
                existingSet.content_language ??
                "ja") as ContentLanguage
            );
            existingSet.content_languages = langs;
            existingSet.content_language = langs[0];
          }
          // 教科書は自動割り当てしない - 既存の教科書情報は保持するが、新規作成時は設定しない
          // 誤って設定された英語名のパスを削除
          if (existingSet.textbook_path === "Decision Trees and Random Forests Textbook.md" || 
              existingSet.textbook_path === "Machine Learning and Deep Learning Textbook.md") {
            console.log('[LocalStorage] Removing auto-assigned textbook path:', existingSet.textbook_path);
            existingSet.textbook_path = undefined;
            existingSet.textbook_type = undefined;
          }
        } else {
          // 新しいセットを追加（教科書は自動割り当てしない）
          console.log('[LocalStorage] Adding new default set:', defaultSet.title);
          const defLangs = normalizeContentLanguages(
            defaultSet.content_languages,
            defaultSet.content_language ?? "ja"
          );
          const newSet: LocalQuestionSet = {
            ...defaultSet,
            id: `default_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            isTrial: true,
            // 教科書は自動割り当てしない（明示的に設定されていない場合は未設定）
            textbook_path: undefined,
            textbook_type: undefined,
            content_languages: defLangs,
            content_language: defLangs[0],
          };
          existingSets.push(newSet);
        }
      }

      // 存在しないdefault_セットを削除
      const currentDefaultTitles = new Set(defaultSets.map(set => set.title));
      const setsToKeep = existingSets.filter(set => {
        if (set.id.startsWith('default_')) {
          return currentDefaultTitles.has(set.title);
        }
        return true; // ユーザー作成のセットは保持
      });

      console.log('[LocalStorage] Total sets after update:', setsToKeep.length);
      await AsyncStorage.setItem(
        TRIAL_QUESTION_SETS_KEY,
        JSON.stringify(setsToKeep)
      );
      await AsyncStorage.setItem(DEFAULT_INITIALIZED_KEY, "true");
      console.log("[LocalStorage] Default questions initialized successfully");
    } catch (error) {
      console.error("Error initializing default questions:", error);
      throw error;
    }
  },

  // --- 赤シート進捗管理 ---

  async getRedSheetProgress(questionSetId: string): Promise<RedSheetProgress | null> {
    try {
      const data = await AsyncStorage.getItem(`${REDSHEET_PROGRESS_PREFIX}${questionSetId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error getting red sheet progress:", error);
      return null;
    }
  },

  async saveRedSheetProgress(progress: RedSheetProgress): Promise<void> {
    try {
      progress.updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(
        `${REDSHEET_PROGRESS_PREFIX}${progress.questionSetId}`,
        JSON.stringify(progress)
      );
    } catch (error) {
      console.error("Error saving red sheet progress:", error);
    }
  },

  async deleteRedSheetProgress(questionSetId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${REDSHEET_PROGRESS_PREFIX}${questionSetId}`);
    } catch (error) {
      console.error("Error deleting red sheet progress:", error);
    }
  },

  async getRedSheetMode(questionSetId: string): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(`${REDSHEET_MODE_PREFIX}${questionSetId}`);
      return data === null ? true : data === "true";
    } catch (error) {
      return true;
    }
  },

  async saveRedSheetMode(questionSetId: string, enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(`${REDSHEET_MODE_PREFIX}${questionSetId}`, String(enabled));
    } catch (error) {
      console.error("Error saving red sheet mode:", error);
    }
  },

  // CSVデータをパースして問題セットを作成
  parseCSVToQuestionSet(
    csvText: string,
    title: string,
    description: string = ""
  ): Omit<LocalQuestionSet, "id" | "createdAt" | "isTrial"> {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    const questions: LocalQuestion[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // CSV行をパース（カンマ区切りだが、引用符で囲まれた部分を考慮）
      const values: string[] = [];
      let currentValue = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      // ヘッダー名ベースで列を取得（新旧フォーマット両対応）
      const col = (name: string) => {
        const idx = headers.indexOf(name);
        return idx >= 0 ? values[idx] || "" : "";
      };

      const question_text = col("question_text");
      const correct_answer = col("correct_answer");
      const explanation = col("explanation");
      const difficulty = parseFloat(col("difficulty")) || 0.5;
      const category = col("category");

      // option_1~option_4 or legacy options column
      let options: string[] | undefined;
      if (headers.includes("option_1")) {
        const opts = [col("option_1"), col("option_2"), col("option_3"), col("option_4")].filter(Boolean);
        options = opts.length > 0 ? opts : undefined;
      } else {
        const optionsStr = col("options");
        options = optionsStr ? optionsStr.split(",").map(o => o.trim()).filter(Boolean) : undefined;
      }

      // question_type: explicit or auto-detect
      const questionTypeRaw = col("question_type").trim() as LocalQuestion["question_type"] | "";
      let question_type: LocalQuestion["question_type"];
      if (questionTypeRaw && ["multiple_choice", "true_false", "text_input"].includes(questionTypeRaw)) {
        question_type = questionTypeRaw as LocalQuestion["question_type"];
      } else if (options && options.length > 0) {
        question_type = "multiple_choice";
      } else if (correct_answer.trim().toLowerCase() === "true" || correct_answer.trim().toLowerCase() === "false") {
        question_type = "true_false";
      } else {
        question_type = "text_input";
      }

      const normalizedMultipleChoiceAnswer =
        question_type === "multiple_choice"
          ? normalizeMultipleChoiceAnswer(correct_answer, options)
          : null;
      const normalizedCorrectAnswer =
        question_type === "multiple_choice"
          ? normalizedMultipleChoiceAnswer || ""
          : correct_answer.trim();

      if (question_text && normalizedCorrectAnswer) {
        questions.push({
          id: `q_${i}`,
          question: question_text,
          answer: normalizedCorrectAnswer,
          explanation: explanation || undefined,
          difficulty:
            difficulty < 0.3 ? "easy" : difficulty > 0.6 ? "hard" : "medium",
          category: category,
          question_type,
          options,
        });
      }
    }

    return {
      title,
      description,
      questions,
    };
  },

  async addMediaToQuestion(
    setId: string,
    questionId: string,
    media: LocalMediaItem
  ): Promise<LocalMediaItem[]> {
    const sets = await this.getTrialQuestionSets();
    const setIdx = sets.findIndex((s) => s.id === setId);
    if (setIdx === -1) throw new Error("Set not found");
    const qIdx = sets[setIdx].questions.findIndex((q) => q.id === questionId);
    if (qIdx === -1) throw new Error("Question not found");

    const q = sets[setIdx].questions[qIdx];
    const mediaList = q.media_urls ? [...q.media_urls] : [];
    mediaList.push(media);
    sets[setIdx].questions[qIdx] = { ...q, media_urls: mediaList };
    await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
    return mediaList;
  },

  async removeMediaFromQuestion(
    setId: string,
    questionId: string,
    mediaIndex: number
  ): Promise<LocalMediaItem[]> {
    const sets = await this.getTrialQuestionSets();
    const setIdx = sets.findIndex((s) => s.id === setId);
    if (setIdx === -1) throw new Error("Set not found");
    const qIdx = sets[setIdx].questions.findIndex((q) => q.id === questionId);
    if (qIdx === -1) throw new Error("Question not found");

    const q = sets[setIdx].questions[qIdx];
    const mediaList = q.media_urls ? [...q.media_urls] : [];
    mediaList.splice(mediaIndex, 1);
    sets[setIdx].questions[qIdx] = { ...q, media_urls: mediaList.length > 0 ? mediaList : undefined };
    await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
    return mediaList;
  },
};
