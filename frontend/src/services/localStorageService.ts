import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LocalQuestionSet {
  id: string;
  title: string;
  description: string;
  questions: LocalQuestion[];
  createdAt: string;
  isTrial: boolean; // お試し版フラグ
  redSheetEnabled?: boolean; // 赤シート機能の有効/無効
}

export interface LocalQuestion {
  id: string;
  question: string;
  answer: string;
  difficulty?: "easy" | "medium" | "hard";
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
}

const TRIAL_QUESTION_SETS_KEY = "@trial_question_sets";
const TRIAL_RESULTS_KEY = "@trial_results";
const DEFAULT_INITIALIZED_KEY = "@default_initialized";

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
      const newSet: LocalQuestionSet = {
        ...questionSet,
        id: `trial_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isTrial: true,
      };
      sets.push(newSet);
      await AsyncStorage.setItem(TRIAL_QUESTION_SETS_KEY, JSON.stringify(sets));
      return newSet;
    } catch (error: any) {
      console.error("Error saving trial question set:", error);
      // 容量超過エラーの場合
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        throw new Error('Storage quota exceeded. Please delete some question sets or clear old data.');
      }
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
    } catch (error: any) {
      console.error("Error saving trial result:", error);
      // 容量超過エラーの場合
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        throw new Error('Storage quota exceeded. Please clear old quiz results.');
      }
      throw error;
    }
  },

  // 古い回答履歴を削除（最新のN件のみ保持）
  async cleanupOldAnswers(questionSetId: string, keepCount: number = 1000): Promise<void> {
    try {
      const storageKey = `@flashcard_answers_${questionSetId}`;
      const answersData = await AsyncStorage.getItem(storageKey);
      if (!answersData) return;

      const answers = JSON.parse(answersData);
      if (answers.length <= keepCount) return;

      // 最新のN件のみ保持（answered_atでソート）
      const sortedAnswers = answers.sort((a: any, b: any) => {
        const dateA = new Date(a.answered_at || 0).getTime();
        const dateB = new Date(b.answered_at || 0).getTime();
        return dateB - dateA; // 降順（新しい順）
      });

      const keptAnswers = sortedAnswers.slice(0, keepCount);
      await AsyncStorage.setItem(storageKey, JSON.stringify(keptAnswers));
      console.log(`[LocalStorage] Cleaned up answers for ${questionSetId}: kept ${keptAnswers.length} of ${answers.length}`);
    } catch (error) {
      console.error("Error cleaning up old answers:", error);
    }
  },

  // ストレージ使用量を確認（概算）
  async getStorageUsage(): Promise<{ approximate: number; unit: string }> {
    try {
      let totalSize = 0;
      const keys = await AsyncStorage.getAllKeys();
      
      for (const key of keys) {
        if (key.startsWith('@trial_') || key.startsWith('@flashcard_answers_')) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length * 2; // UTF-16文字列として概算（バイト数）
          }
        }
      }

      // MBに変換
      const mb = totalSize / (1024 * 1024);
      if (mb >= 1) {
        return { approximate: Math.round(mb * 10) / 10, unit: 'MB' };
      } else {
        const kb = totalSize / 1024;
        return { approximate: Math.round(kb * 10) / 10, unit: 'KB' };
      }
    } catch (error) {
      console.error("Error getting storage usage:", error);
      return { approximate: 0, unit: 'KB' };
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
    defaultSets: Omit<LocalQuestionSet, "createdAt" | "isTrial">[]
  ): Promise<void> {
    try {
      console.log('[LocalStorage] initializeDefaultQuestions called with', defaultSets.length, 'sets');
      const initialized = await AsyncStorage.getItem(DEFAULT_INITIALIZED_KEY);
      console.log('[LocalStorage] Already initialized?', initialized === "true");

      if (initialized === "true") {
        console.log("[LocalStorage] Default questions already initialized, skipping");
        return;
      }

      const existingSets = await this.getTrialQuestionSets();
      console.log('[LocalStorage] Existing sets:', existingSets.length);

      for (const defaultSet of defaultSets) {
        console.log('[LocalStorage] Adding default set:', defaultSet.title);
        const newSet: LocalQuestionSet = {
          ...defaultSet,
          id: `default_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          isTrial: true,
        };
        existingSets.push(newSet);
      }

      console.log('[LocalStorage] Total sets after adding defaults:', existingSets.length);
      await AsyncStorage.setItem(
        TRIAL_QUESTION_SETS_KEY,
        JSON.stringify(existingSets)
      );
      await AsyncStorage.setItem(DEFAULT_INITIALIZED_KEY, "true");
      console.log("[LocalStorage] Default questions initialized successfully");
    } catch (error) {
      console.error("Error initializing default questions:", error);
      throw error;
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

      // question_text, correct_answer, explanation, difficulty, category
      const question_text = values[0] || "";
      const correct_answer = values[3] || "";
      const explanation = values[4] || "";
      const difficulty = parseFloat(values[5]) || 0.5;
      const category = values[6] || "";

      if (question_text && correct_answer) {
        questions.push({
          id: `q_${i}`,
          question: question_text,
          answer: correct_answer + (explanation ? `\n\n${explanation}` : ""),
          difficulty:
            difficulty < 0.3 ? "easy" : difficulty > 0.6 ? "hard" : "medium",
          category: category,
        });
      }
    }

    return {
      title,
      description,
      questions,
    };
  },
};
