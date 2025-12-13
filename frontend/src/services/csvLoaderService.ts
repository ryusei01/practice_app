// CSVファイルを自動的に読み込むサービス
import { localStorageService } from "./localStorageService";

// CSVファイルのメタデータ
interface CSVFile {
  fileName: string;
  title: string;
  description: string;
  csvContent: string;
}

// 全CSVファイルのコンテンツをここにインポート（自動生成）
import { AiPractice_CSV } from "../data/ai_practiceCSV";
import { BusinessEnglish_CSV } from "../data/business_englishCSV";
import { DeepLearningEngineeringQuestions_CSV } from "../data/deep_learning_engineering_questionsCSV";
import { EQualificationQuestionSet_CSV } from "../data/e_qualification_question_setCSV";
import { JapaneseWordbook_CSV } from "../data/japanese_wordbookCSV";

// CSVファイルのリスト
const CSV_FILES: CSVFile[] = [
  {
    fileName: "ai_practice.csv",
    title: "ai practice",
    description: "ai practice",
    csvContent: AiPractice_CSV,
  },
  {
    fileName: "business_english.csv",
    title: "business english",
    description: "business english",
    csvContent: BusinessEnglish_CSV,
  },
  {
    fileName: "Deep_Learning_Engineering_Questions.csv",
    title: "Deep Learning Engineering Questions",
    description: "Deep Learning Engineering Questions",
    csvContent: DeepLearningEngineeringQuestions_CSV,
  },
  {
    fileName: "E資格_問題集.csv",
    title: "E資格 問題集",
    description: "E資格 問題集",
    csvContent: EQualificationQuestionSet_CSV,
  },
  {
    fileName: "japanese_wordbook.csv",
    title: "japanese wordbook",
    description: "japanese wordbook",
    csvContent: JapaneseWordbook_CSV,
  }
];

/**
 * 全てのCSVファイルを読み込んで問題セットを作成
 */
export async function loadAllCSVFiles(): Promise<void> {
  try {
    console.log("[CSVLoaderService] Loading CSV files...");

    const questionSets = CSV_FILES.map((csvFile) => {
      console.log(`[CSVLoaderService] Parsing ${csvFile.fileName}...`);
      return localStorageService.parseCSVToQuestionSet(
        csvFile.csvContent,
        csvFile.title,
        csvFile.description
      );
    });

    await localStorageService.initializeDefaultQuestions(questionSets);
    console.log(
      `[CSVLoaderService] Successfully loaded ${questionSets.length} CSV files`
    );
  } catch (error) {
    console.error("[CSVLoaderService] Error loading CSV files:", error);
    throw error;
  }
}

/**
 * 新しいCSVファイルを追加
 */
export function registerCSVFile(
  fileName: string,
  title: string,
  description: string,
  csvContent: string
): void {
  CSV_FILES.push({
    fileName,
    title,
    description,
    csvContent,
  });
  console.log(`[CSVLoaderService] Registered new CSV file: ${fileName}`);
}

/**
 * 登録されているCSVファイルの一覧を取得
 */
export function getRegisteredCSVFiles(): Array<{
  fileName: string;
  title: string;
  description: string;
}> {
  return CSV_FILES.map(({ fileName, title, description }) => ({
    fileName,
    title,
    description,
  }));
}
