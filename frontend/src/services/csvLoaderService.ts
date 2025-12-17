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
    title: "ビジネス英単語",
    description: "ビジネス英単語",
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
    title: "Japanese Vocabulary Book (N5-N1)",
    description: "japanese wordbook",
    csvContent: JapaneseWordbook_CSV,
  },
];

/**
 * 全てのCSVファイルを読み込んで問題セットを作成
 */
export async function loadAllCSVFiles(): Promise<void> {
  try {
    console.log("[CSVLoaderService] Loading CSV files...");

    const questionSets = CSV_FILES.map((csvFile) => {
      console.log(`[CSVLoaderService] Parsing ${csvFile.fileName}...`);
      const questionSet = localStorageService.parseCSVToQuestionSet(
        csvFile.csvContent,
        csvFile.title,
        csvFile.description
      );

      // 教科書は独立したリソースなので、CSVファイルからは設定しない
      // 教科書は問題セットとは別に管理され、手動で割り当てる必要がある

      return questionSet;
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
 * 注意: この関数は動的にCSVファイルを追加するためのものです
 * 実際の使用時は、loadAllCSVFiles()を呼び出して問題セットを初期化してください
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
  console.log(
    `[CSVLoaderService] Note: Call loadAllCSVFiles() to initialize question sets`
  );
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
