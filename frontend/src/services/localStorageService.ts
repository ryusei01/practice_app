import AsyncStorage from "@react-native-async-storage/async-storage";

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
