// CSVファイルを自動的に読み込むサービス
import type { ContentLanguage } from "../api/questionSets";
import { localStorageService } from "./localStorageService";

// CSVファイルのメタデータ
interface CSVFile {
  fileName: string;
  title: string;
  description: string;
  csvContent: string;
  content_language: ContentLanguage;
}

/**
 * 全てのCSVファイルを読み込んで問題セットを作成
 * CSVデータは動的インポートで遅延ロードし、メインバンドルに含めない
 */
export async function loadAllCSVFiles(): Promise<void> {
  try {
    console.log("[CSVLoaderService] Loading CSV files...");

    // --- auto-generated: csv bundle (scripts/convert_csv_to_ts.py) ---
    const [
      { AiPractice_CSV },
      { AWSCertifiedMachineLearningQuestionSet_CSV },
      { AwsMlSpecialtyQuizEn_CSV },
      { BusinessEnglish_CSV },
      { DeepLearningEngineeringQuestions_CSV },
      { EQualificationQuestionSet_CSV },
      { JapaneseWordbook_CSV },
      { PromptEngineeringQuiz_CSV },
      { TensorflowPytorchQuiz_CSV },
    ] = await Promise.all([
      import("../data/ai_practiceCSV"),
      import("../data/aws_certified_machine_learning_question_setCSV"),
      import("../data/aws_ml_specialty_quiz_enCSV"),
      import("../data/business_englishCSV"),
      import("../data/deep_learning_engineering_questionsCSV"),
      import("../data/e_qualification_question_setCSV"),
      import("../data/japanese_wordbookCSV"),
      import("../data/prompt_engineering_quizCSV"),
      import("../data/tensorflow_pytorch_quizCSV"),
    ]);

    const CSV_FILES: CSVFile[] = [
      {
        fileName: "ai_practice.csv",
        title: "ai practice",
        description: "ai practice",
        csvContent: AiPractice_CSV,
        content_language: "en",
      },
      {
        fileName: "AWS Certified Machine Learning問題集.csv",
        title: "AWS Certified Machine Learning 問題集",
        description: "AWS Certified Machine Learning 問題集",
        csvContent: AWSCertifiedMachineLearningQuestionSet_CSV,
        content_language: "ja",
      },
      {
        fileName: "aws_ml_specialty_quiz_en.csv",
        title: "AWS ML Specialty Quiz (EN)",
        description: "AWS ML Specialty Quiz (EN)",
        csvContent: AwsMlSpecialtyQuizEn_CSV,
        content_language: "en",
      },
      {
        fileName: "business_english.csv",
        title: "business english",
        description: "business english",
        csvContent: BusinessEnglish_CSV,
        content_language: "en",
      },
      {
        fileName: "Deep_Learning_Engineering_Questions.csv",
        title: "Deep Learning Engineering Questions",
        description: "Deep Learning Engineering Questions",
        csvContent: DeepLearningEngineeringQuestions_CSV,
        content_language: "en",
      },
      {
        fileName: "E資格_問題集.csv",
        title: "E資格 問題集",
        description: "E資格 問題集",
        csvContent: EQualificationQuestionSet_CSV,
        content_language: "ja",
      },
      {
        fileName: "japanese_wordbook.csv",
        title: "japanese wordbook",
        description: "japanese wordbook",
        csvContent: JapaneseWordbook_CSV,
        content_language: "ja",
      },
      {
        fileName: "prompt_engineering_quiz.csv",
        title: "Prompt Engineering Quiz (EN)",
        description: "Prompt Engineering Quiz (EN)",
        csvContent: PromptEngineeringQuiz_CSV,
        content_language: "en",
      },
      {
        fileName: "tensorflow_pytorch_quiz.csv",
        title: "TensorFlow / PyTorch クイズ",
        description: "TensorFlow / PyTorch クイズ",
        csvContent: TensorflowPytorchQuiz_CSV,
        content_language: "ja",
      },
    ];
    // --- end auto-generated ---
    const questionSets = CSV_FILES.map((csvFile) => {
      console.log(`[CSVLoaderService] Parsing ${csvFile.fileName}...`);
      const base = localStorageService.parseCSVToQuestionSet(
        csvFile.csvContent,
        csvFile.title,
        csvFile.description
      );
      return { ...base, content_language: csvFile.content_language };
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
