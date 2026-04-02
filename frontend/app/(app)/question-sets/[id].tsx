import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { questionSetsApi, QuestionSet } from "../../../src/api/questionSets";
import {
  questionsApi,
  Question,
  QuestionGroup,
} from "../../../src/api/questions";
import Modal from "../../../src/components/Modal";
import { commonStyles } from "../../../src/styles/questionSetDetailStyles";
import { useAuth } from "../../../src/contexts/AuthContext";
import { copyrightApi, CopyrightCheckResult } from "../../../src/api/reports";
import { paymentsApi } from "../../../src/api/payments";
import ReportModal from "../../../src/components/ReportModal";
import { srsService, SRSMap } from "../../../src/services/srsService";

// 問題ごとの回答統計
interface QuestionStats {
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  lastAnsweredAt: string | null;
}

export default function QuestionSetDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [setupMode, setSetupMode] = useState(mode === "setup");
  const [setupStep, setSetupStep] = useState(1);
  const router = useRouter();

  // 著作権チェック関連
  const [copyrightCheckResult, setCopyrightCheckResult] =
    useState<CopyrightCheckResult | null>(null);
  const [isCopyrightChecking, setIsCopyrightChecking] = useState(false);

  // 購入関連
  const [isPurchased, setIsPurchased] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // 通報モーダル
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [questionStats, setQuestionStats] = useState<
    Map<string, QuestionStats>
  >(new Map());
  const [srsMap, setSrsMap] = useState<SRSMap>({});
  const [dueCount, setDueCount] = useState(0);

  // 問題選択モーダル用のstate
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState<
    "all" | "ai" | "range" | "category"
  >("all");
  const [questionCount, setQuestionCount] = useState(10); // 初期値10問
  const [questionCountInput, setQuestionCountInput] = useState("10");
  const [rangeStart, setRangeStart] = useState(0);
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // モーダル用のstate
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    title: "",
    message: "",
    buttons: [],
  });

  useEffect(() => {
    loadData();
  }, [id]);

  // モーダルを表示するヘルパー関数
  const showModal = (
    title: string,
    message: string,
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>
  ) => {
    setModalConfig({ title, message, buttons });
    setModalVisible(true);
  };

  const loadData = async () => {
    try {
      const [setData, questionsData] = await Promise.all([
        questionSetsApi.getById(id),
        questionsApi.getAll({ question_set_id: id }),
      ]);
      setQuestionSet(setData);
      setQuestions(questionsData);
      setQuestionCountInput(String(questionCount));

      // 購入済みかチェック（他ユーザーの問題集の場合）
      if (user && setData.creator_id !== user.id) {
        try {
          const purchased = await questionSetsApi.getPurchased();
          setIsPurchased(purchased.some((p) => p.id === id));
        } catch {
          // 未ログインやエラー時は無視
        }
      }

      // カテゴリグループを取得
      try {
        const groups = await questionsApi.getGroups(id, "category");
        setQuestionGroups(groups);
      } catch (error) {
        console.error("Failed to load question groups:", error);
      }

      // 回答データを読み込み
      await loadAnswerStats();

      // SRS状態を読み込み（既存履歴から初期化も行う）
      const qids = questionsData.map((q) => q.id).filter(Boolean);
      const map = await srsService.initializeFromHistory(id, qids);
      setSrsMap(map);
      setDueCount(await srsService.getDueCount(id));
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load question set");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadAnswerStats = async () => {
    try {
      const storageKey = `@flashcard_answers_${id}`;
      const answersData = await AsyncStorage.getItem(storageKey);

      if (!answersData) {
        return;
      }

      const answers = JSON.parse(answersData);
      const statsMap = new Map<string, QuestionStats>();

      // 各問題の統計を計算
      answers.forEach((answer: any) => {
        const questionId = answer.question_id;
        const existing = statsMap.get(questionId) || {
          totalAttempts: 0,
          correctCount: 0,
          accuracy: 0,
          lastAnsweredAt: null,
        };

        existing.totalAttempts += 1;
        if (answer.is_correct) {
          existing.correctCount += 1;
        }
        existing.accuracy =
          (existing.correctCount / existing.totalAttempts) * 100;

        // 最新の回答日時を更新
        if (
          !existing.lastAnsweredAt ||
          answer.answered_at > existing.lastAnsweredAt
        ) {
          existing.lastAnsweredAt = answer.answered_at;
        }

        statsMap.set(questionId, existing);
      });

      setQuestionStats(statsMap);
    } catch (error) {
      console.error("Failed to load answer stats:", error);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleAddQuestion = () => {
    router.push(`/(app)/question-sets/${id}/add-question`);
  };

  const handleCopyrightCheck = async () => {
    if (!id) return;
    setIsCopyrightChecking(true);
    try {
      const result = await copyrightApi.runCheck(id);
      setCopyrightCheckResult(result);
      if (result.risk_level === "high") {
        Alert.alert(
          "⚠️ 著作権チェック：高リスク",
          `このコンテンツは著作権侵害の可能性があるため公開できません。\n\n${result.recommendation}`,
          [{ text: "OK" }]
        );
      } else if (result.risk_level === "medium") {
        Alert.alert(
          "⚠️ 著作権チェック：注意",
          `一部注意が必要な箇所があります。内容をご確認ください。\n\n${result.recommendation}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "✅ 著作権チェック：問題なし",
          "著作権上の問題は検出されませんでした。問題集を公開できます。",
          [{ text: "OK" }]
        );
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        "著作権チェックに失敗しました。Ollamaサーバーが起動しているか確認してください。";
      Alert.alert("エラー", msg);
    } finally {
      setIsCopyrightChecking(false);
    }
  };

  const handleEditQuestionSet = () => {
    router.push(`/(app)/question-sets/edit?id=${id}`);
    if (setupMode && setupStep === 2) {
      setSetupStep(3);
    }
  };

  const handleStartQuiz = () => {
    if (questions.length === 0) {
      Alert.alert(
        "No Questions",
        "Please add questions before starting the quiz"
      );
      return;
    }
    setSelectionModalVisible(true);
  };

  const handleStartQuizWithSelection = async () => {
    try {
      setSelectionModalVisible(false);
      setIsLoading(true);

      let selectedQuestions: Question[];

      if (selectionMode === "all") {
        selectedQuestions = questions;
      } else if (selectionMode === "ai") {
        selectedQuestions = await questionsApi.selectQuestionsByAI(
          id,
          questionCount
        );
      } else if (selectionMode === "category") {
        // カテゴリ別選択
        if (!selectedCategory) {
          Alert.alert(
            t("Error", "エラー"),
            t("Please select a category", "カテゴリを選択してください")
          );
          setIsLoading(false);
          return;
        }
        const group = questionGroups.find(
          (g) =>
            g.category === selectedCategory ||
            (g.category === null && selectedCategory === "未分類")
        );
        selectedQuestions = group?.questions || [];
      } else {
        selectedQuestions = await questionsApi.selectQuestionsByRange(
          id,
          rangeStart,
          questionCount
        );
      }

      if (selectedQuestions.length === 0) {
        Alert.alert(
          t("Error", "エラー"),
          t(
            "No questions match your selection",
            "選択条件に一致する問題がありません"
          )
        );
        setIsLoading(false);
        return;
      }

      // 選択した問題IDをクエリパラメータで渡す
      const questionIds = selectedQuestions.map((q) => q.id).join(",");
      router.push(`/(app)/quiz/${id}?questionIds=${questionIds}`);
    } catch (error) {
      console.error("Failed to select questions:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to select questions", "問題の選択に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFlashcard = () => {
    if (questions.length === 0) {
      Alert.alert(
        t("No Questions", "問題がありません"),
        t(
          "Please add questions before starting flashcard mode",
          "フラッシュカードモードを開始する前に問題を追加してください"
        )
      );
      return;
    }
    router.push(`/(app)/flashcard/${id}`);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert(
      "Delete Question",
      "Are you sure you want to delete this question?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await questionsApi.delete(questionId);
              setQuestions(questions.filter((q) => q.id !== questionId));
              Alert.alert("Success", "Question deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete question");
            }
          },
        },
      ]
    );
  };

  const handleDeleteSet = async () => {
    Alert.alert(
      "Delete Question Set",
      "Are you sure? This will delete all questions in this set.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await questionSetsApi.delete(id);
              Alert.alert("Success", "Question set deleted", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert("Error", "Failed to delete question set");
            }
          },
        },
      ]
    );
  };

  const handleShowCSVHelp = () => {
    const helpMessage = `${t("CSV Format Help", "CSV形式のヘルプ")}:

${t("Required fields", "必須フィールド")}:
• ${t("question_text (question body)", "question_text（問題文）")}
• ${t("correct_answer", "correct_answer（正解）")}

${t("Optional fields", "任意フィールド")}:
• ${t("question_type", "question_type")}
  ${t(
    "(multiple_choice, true_false, short_answer, etc.)",
    "（multiple_choice, true_false, short_answer など）"
  )}
• option_1〜option_4 (${t("options", "選択肢")})
• ${t("explanation", "解説")}
• ${t("difficulty (0-1)", "難易度（0〜1）")}
• ${t("category", "カテゴリ")}
• subcategory1 (${t("subcategory 1", "サブカテゴリ1")})
• subcategory2 (${t("subcategory 2", "サブカテゴリ2")})

${t("Example CSV", "CSV例")}:
question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
What is 2+2?,,2,3,4,5,4,Basic addition,0.2,math,arithmetic,addition
The sky is blue,,,,,,true,Common knowledge,0.1,general,nature,sky
Capital of France?,,,,,,Paris,Paris is the capital,0.3,geography,europe,capitals

${t("Important notes", "注意事項")}:
• ${t(
    "Save CSV files as UTF-8.",
    "CSVファイルはUTF-8で保存してください。"
  )}
• ${t(
    "The first row must be the header row.",
    "1行目は必ずヘッダー行にしてください。"
  )}
• ${t(
    "difficulty is a number from 0 to 1.",
    "difficultyは0〜1の数値です。"
  )}
• ${t(
    "For true/false questions, put true or false in correct_answer.",
    "正誤問題は correct_answer に true または false を入れてください。"
  )}`;

    showModal(
      t("CSV Format Help", "CSV形式のヘルプ"),
      helpMessage,
      [{ text: t("OK", "OK") }]
    );
  };

  const handleUploadCSV = async () => {
    try {
      console.log("Opening document picker...");
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true,
      });

      console.log("Document picker result:", result);

      if (result.canceled) {
        console.log("Document picker was canceled");
        return;
      }

      const file = result.assets[0];
      console.log("Selected file:", file);

      // カスタムモーダルで確認
      showModal(
        t("Upload CSV", "CSVをアップロード"),
        t(
          `Upload "${file.name}"?`,
          `「${file.name}」をアップロードしますか？`
        ),
        [
          { text: t("Cancel", "キャンセル"), style: "cancel" },
          {
            text: t("Upload", "アップロード"),
            onPress: async () => {
              try {
                setIsLoading(true);
                const response = await questionsApi.bulkUploadCSV(id, {
                  uri: file.uri,
                  name: file.name,
                  type: file.mimeType || "text/csv",
                });

                if (response.total_errors > 0) {
                  // エラーメッセージを安全に文字列化
                  const errorMessages = response.errors
                    ? response.errors
                        .slice(0, 3)
                        .map((err) =>
                          typeof err === "string" ? err : JSON.stringify(err)
                        )
                        .join("\n")
                    : "Unknown errors occurred";

                  showModal(
                    t(
                      "Upload completed with errors",
                      "アップロード完了（エラーあり）"
                    ),
                    `${t(
                      `Created ${response.total_created} questions`,
                      `${response.total_created}問を作成しました`
                    )}\n${t(
                      `${response.total_errors} errors`,
                      `エラー ${response.total_errors} 件`
                    )}\n\n${errorMessages}`,
                    [{ text: t("OK", "OK"), onPress: () => loadData() }]
                  );
                } else {
                  showModal(
                    t("Success", "成功"),
                    t(
                      `Successfully uploaded ${response.total_created} questions`,
                      `${response.total_created}問をアップロードしました`
                    ),
                    [
                      {
                        text: t("OK", "OK"),
                        onPress: () => {
                          loadData();
                          if (setupMode && setupStep === 1) {
                            setSetupStep(2);
                          }
                        },
                      },
                    ]
                  );
                }
              } catch (error: any) {
                console.error("Failed to upload CSV:", error);

                // エラーメッセージを安全に取得
                let errorMessage = t(
                  "CSV upload failed",
                  "CSVのアップロードに失敗しました"
                );
                if (error.response?.data?.detail) {
                  if (typeof error.response.data.detail === "string") {
                    errorMessage = error.response.data.detail;
                  } else if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail
                      .map((err: any) => err.msg || JSON.stringify(err))
                      .join("\n");
                  } else {
                    errorMessage = JSON.stringify(error.response.data.detail);
                  }
                }

                showModal(t("Error", "エラー"), errorMessage, [
                  { text: t("OK", "OK") },
                ]);
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Failed to pick document:", error);
      Alert.alert("Error", "Failed to select file");
    }
  };

  const renderQuestion = ({
    item,
    index,
  }: {
    item: Question;
    index: number;
  }) => {
    const stats = questionStats.get(item.id);
    const srs = srsMap[item.id];

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>Q{index + 1}</Text>
          <TouchableOpacity onPress={() => handleDeleteQuestion(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.questionText}>{item.question_text}</Text>
        <View style={styles.questionFooter}>
          <Text style={styles.questionType}>{item.question_type}</Text>
          <Text style={styles.difficulty}>
            Difficulty: {(item.difficulty * 100).toFixed(0)}%
          </Text>
        </View>

        {/* 回答統計を表示 */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("Accuracy", "正解率")}:</Text>
              <Text
                style={[
                  styles.statValue,
                  stats.accuracy >= 80
                    ? styles.statGood
                    : stats.accuracy >= 50
                    ? styles.statMedium
                    : styles.statPoor,
                ]}
              >
                {stats.accuracy.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("Attempts", "回答数")}:</Text>
              <Text style={styles.statValue}>
                {stats.correctCount}/{stats.totalAttempts}
              </Text>
            </View>
          </View>
        )}

        {/* 忘却曲線（保持率） + 次回復習 */}
        {srs && (() => {
          const retention = srsService.getRetention(srs);
          const retPct = Math.round(retention * 100);
          const barColor = retPct > 80 ? "#4CAF50" : retPct > 50 ? "#FF9500" : "#F44336";
          const reviewLabel = srsService.formatNextReview(srs.nextReviewDate, t);
          return (
            <View style={styles.retentionContainer}>
              <View style={styles.retentionRow}>
                <Text style={styles.retentionLabel}>
                  {t("Retention", "記憶保持率")}
                </Text>
                <Text style={[styles.retentionValue, { color: barColor }]}>
                  {retPct}%
                </Text>
              </View>
              <View style={styles.retentionBarBg}>
                <View
                  style={[
                    styles.retentionBarFill,
                    { width: `${retPct}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
              <Text style={styles.reviewDateText}>
                {t("Next review", "次回復習")}: {reviewLabel}
              </Text>
            </View>
          );
        })()}
      </View>
    );
  };

  const handleStartReviewQuiz = async () => {
    const dueIds = await srsService.getDueQuestions(id);
    if (dueIds.length === 0) {
      Alert.alert(
        t("No Review Needed", "復習不要"),
        t("All questions are up to date!", "全ての問題の復習は完了しています！")
      );
      return;
    }
    router.push(`/(app)/quiz/${id}?questionIds=${dueIds.join(",")}`);
  };

  const handleStartForgettingCurveReviewQuiz = async () => {
    const allIds = questions.map((q) => q.id).filter(Boolean);
    const reviewIds = await srsService.getLowestRetentionQuestions(
      id,
      questionCount,
      allIds
    );
    if (reviewIds.length === 0) {
      Alert.alert(
        t("No Review Needed", "復習不要"),
        t("No questions available for review", "復習できる問題がありません")
      );
      return;
    }
    router.push(`/(app)/quiz/${id}?questionIds=${reviewIds.join(",")}`);
  };

  const handleStartMostIncorrectReviewQuiz = async () => {
    const allIds = questions.map((q) => q.id).filter(Boolean);
    const reviewIds = await srsService.getMostIncorrectQuestions(
      id,
      questionCount,
      allIds
    );
    if (reviewIds.length === 0) {
      Alert.alert(
        t("No Review Needed", "復習不要"),
        t("No questions available for review", "復習できる問題がありません")
      );
      return;
    }
    router.push(`/(app)/quiz/${id}?questionIds=${reviewIds.join(",")}`);
  };

  const handlePurchase = async () => {
    if (!questionSet) return;

    setIsPurchasing(true);
    try {
      const result = await paymentsApi.createPaymentIntent({
        question_set_id: questionSet.id,
      });

      if (result.client_secret === "free") {
        setIsPurchased(true);
        showModal(
          t("Success", "成功"),
          t(
            "You have successfully obtained this question set!",
            "この問題集を入手しました！"
          ),
          [{ text: t("OK", "OK"), onPress: () => loadData() }]
        );
      } else {
        // 有料: confirmPurchase で購入確定
        // 実際のStripe決済はclient_secretを使って行われるが、
        // 現時点ではバックエンドのPaymentIntentが成功扱いになるまで待つ
        showModal(
          t("Payment", "決済"),
          t(
            `Payment of ¥${result.amount.toLocaleString()} is being processed. Platform fee: ¥${result.platform_fee.toLocaleString()}`,
            `¥${result.amount.toLocaleString()} の決済を処理中です。プラットフォーム手数料: ¥${result.platform_fee.toLocaleString()}`
          ),
          [
            {
              text: t("Confirm Purchase", "購入を確定"),
              onPress: async () => {
                try {
                  await paymentsApi.confirmPurchase(result.payment_intent_id);
                  setIsPurchased(true);
                  showModal(
                    t("Purchase Complete", "購入完了"),
                    t(
                      "You can now access this question set!",
                      "この問題集にアクセスできるようになりました！"
                    ),
                    [{ text: t("OK", "OK"), onPress: () => loadData() }]
                  );
                } catch (err: any) {
                  const msg =
                    err?.response?.data?.detail ||
                    t("Purchase failed", "購入に失敗しました");
                  showModal(t("Error", "エラー"), msg, [
                    { text: t("OK", "OK") },
                  ]);
                }
              },
            },
            { text: t("Cancel", "キャンセル"), style: "cancel" },
          ]
        );
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        t("Failed to process purchase", "購入処理に失敗しました");
      showModal(t("Error", "エラー"), msg, [{ text: t("OK", "OK") }]);
    } finally {
      setIsPurchasing(false);
    }
  };

  const isOwner = user?.id === questionSet?.creator_id;
  const canPurchase =
    user && !isOwner && questionSet?.is_published && !isPurchased;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!questionSet) {
    return (
      <View style={styles.centerContainer}>
        <Text>Question set not found</Text>
      </View>
    );
  }

  const downloadCSVSample = () => {
    console.log("downloadCSVSample called");

    const csvSample = `question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
What is 2 + 2?,,2,3,4,5,4,Basic addition,0.1,math,arithmetic,addition
Is the sky blue?,,,,,,true,The sky appears blue due to Rayleigh scattering,0.1,science,physics,light
What is the capital of Japan?,,,,,,Tokyo,Japan's capital is Tokyo,0.3,geography,asia,capitals
What is the largest planet in our solar system?,,,,,,Jupiter,Jupiter is the largest planet,0.4,science,astronomy,planets`;

    const title = t("CSV Sample Format", "CSVサンプル形式");
    const message = `CSV format:
question_text,correct_answer,category,difficulty`;
    if (Platform.OS === "web") {
      // Web はブラウザダウンロード
      const blob = new Blob([csvSample], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample.csv";
      a.click();
      URL.revokeObjectURL(url);
      return;
    } else {
      const path = FileSystem.documentDirectory + "words.csv";
      FileSystem.writeAsStringAsync(path + "csv_sample.csv", csvSample, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return path;
    }
  };

  return (
    <View style={styles.container}>
      {setupMode && (
        <View style={styles.setupGuide}>
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>
              {t("Setup Guide", "セットアップガイド")}
            </Text>
            <TouchableOpacity
              onPress={() => setSetupMode(false)}
              style={styles.closeSetupButton}
            >
              <Text style={styles.closeSetupText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.setupSteps}>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 1 && styles.setupStepActive,
                setupStep > 1 && styles.setupStepCompleted,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>
                  {setupStep > 1 ? "✓" : "1"}
                </Text>
              </View>
              <Text style={styles.setupStepText}>
                {t(
                  "Make questions or Upload questions via CSV",
                  "自分で問題を追加するか、CSVで問題をアップロード"
                )}
              </Text>
            </View>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 2 && styles.setupStepActive,
                setupStep > 2 && styles.setupStepCompleted,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>
                  {setupStep > 2 ? "✓" : "2"}
                </Text>
              </View>
              <Text style={styles.setupStepText}>
                {t("Edit title and category", "タイトルとカテゴリを編集")}
              </Text>
            </View>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 3 && styles.setupStepActive,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>3</Text>
              </View>
              <Text style={styles.setupStepText}>
                {t("Add description and details", "説明と詳細を追加")}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.header} nativeID="question-set-header">
        <Text style={styles.title} nativeID="question-set-title">
          {questionSet.title}
          {questionSet.description && (
            <Text
              style={styles.description}
              nativeID="question-set-description"
            >
              {questionSet.description}
            </Text>
          )}
        </Text>

        <View style={styles.descriptionRow} nativeID="description-row">
          {/* カテゴリリンク */}
          {questionGroups.length > 0 && (
            <View
              style={styles.categoryLinksContainer}
              nativeID="category-links-container"
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryLinksScroll}
                contentContainerStyle={styles.categoryLinksContent}
                nativeID="category-links-scroll"
              >
                {questionGroups.map((group, index) => (
                  <TouchableOpacity
                    key={`category_link_${index}`}
                    style={styles.categoryLink}
                    onPress={() => {
                      // 該当するカテゴリのインデックスまでスクロール
                      if (flatListRef.current) {
                        flatListRef.current.scrollToIndex({
                          index: index,
                          animated: true,
                          viewPosition: 0, // 画面の上部に配置
                        });
                      }
                    }}
                  >
                    <Text
                      style={styles.categoryLinkText}
                      nativeID={`category-link-text-${index}`}
                    >
                      {group.category || t("Uncategorized", "未分類")} (
                      {group.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        <View style={styles.metadata}>
          <Text style={styles.category}>{questionSet.category}</Text>
          {questionSet.is_published && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Published</Text>
            </View>
          )}
        </View>
        {questionSet.tags && questionSet.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {questionSet.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{questions.length}</Text>
          <Text style={styles.statLabel}>Questions</Text>
        </View>
        {dueCount > 0 && (
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#FF9500" }]}>{dueCount}</Text>
            <Text style={styles.statLabel}>{t("Due for Review", "要復習")}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statValue}>¥{questionSet.price}</Text>
          <Text style={styles.statLabel}>Price</Text>
        </View>
      </View>

      {/* 特定商取引法リンク（価格表示がある場合のみ） */}
      {questionSet.price > 0 && (
        <TouchableOpacity
          style={styles.tokushoLink}
          onPress={() => router.push("/(app)/legal/tokusho")}
        >
          <Text style={styles.tokushoLinkText}>
            特定商取引法に基づく表記
          </Text>
        </TouchableOpacity>
      )}

      {/* 購入セクション */}
      {canPurchase && (
        <View style={styles.purchaseSection}>
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              isPurchasing && styles.buttonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing}
            activeOpacity={0.7}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                {questionSet.price === 0
                  ? t("Get for Free", "無料で入手")
                  : t(
                      `Purchase ¥${questionSet.price.toLocaleString()}`,
                      `¥${questionSet.price.toLocaleString()} で購入する`
                    )}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {!isOwner && isPurchased && (
        <View style={styles.purchasedSection}>
          <Text style={styles.purchasedText}>
            {t("Purchased", "購入済み")}
          </Text>
        </View>
      )}

      {/* カテゴリ別にグループ化して表示 */}
      {questionGroups.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={questionGroups}
          keyExtractor={(item, index) =>
            `category_${item.category || "uncategorized"}_${index}`
          }
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          onScrollToIndexFailed={(info) => {
            // スクロール失敗時のフォールバック
            const wait = new Promise((resolve) => setTimeout(resolve, 500));
            wait.then(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: info.index,
                  animated: true,
                });
              }
            });
          }}
          renderItem={({ item: group }) => (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>
                  {group.category || t("Uncategorized", "未分類")}
                </Text>
                <Text style={styles.categoryCount}>
                  {group.count} {t("questions", "問")}
                </Text>
                <TouchableOpacity
                  style={styles.categoryQuizButton}
                  onPress={() => {
                    setSelectedCategory(group.category || "未分類");
                    setSelectionMode("category");
                    setSelectionModalVisible(true);
                    // すぐにクイズを開始
                    setTimeout(() => {
                      handleStartQuizWithSelection();
                    }, 100);
                  }}
                >
                  <Text style={styles.categoryQuizButtonText}>
                    {t("Start Quiz", "クイズ開始")}
                  </Text>
                </TouchableOpacity>
              </View>
              {group.questions.map((question, index) => {
                const globalIndex = questions.findIndex(
                  (q) => q.id === question.id
                );
                return (
                  <View key={question.id || `question_${index}`}>
                    {renderQuestion({ item: question, index: globalIndex })}
                  </View>
                );
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No questions yet</Text>
              <Text style={styles.emptySubtext}>Add your first question</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={questions}
          renderItem={renderQuestion}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No questions yet</Text>
              <Text style={styles.emptySubtext}>Add your first question</Text>
            </View>
          }
        />
      )}

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.startQuizButton,
              questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartQuiz}
            disabled={questions.length === 0}
            activeOpacity={0.7}
          >
            <Text
              style={styles.startQuizButtonText}
              nativeID="start-quiz-button-text"
            >
              {t("Start Quiz", "クイズ開始")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.flashcardButton,
              questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartFlashcard}
            disabled={questions.length === 0}
          >
            <Text style={styles.flashcardButtonText}>
              📇 {t("Flashcard", "赤シート機能")}
            </Text>
          </TouchableOpacity>
        </View>
        {dueCount > 0 && (
          <TouchableOpacity style={styles.reviewButton} onPress={handleStartReviewQuiz}>
            <Text style={styles.reviewButtonText}>
              {t(`Review ${dueCount} questions`, `${dueCount}問を復習する`)}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddQuestion}
          >
            <Text style={styles.addButtonText}>
              {t("Add Question", "問題を追加")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadCSVButton}
            onPress={handleUploadCSV}
          >
            <Text style={styles.uploadCSVButtonText}>
              {t("Upload CSV", "CSVをアップロード")}
            </Text>
          </TouchableOpacity>
        </View>
        {/* 教科書ボタン */}
        {(questionSet?.textbook_path || questionSet?.textbook_type === 'inline') && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.textbookButton}
              onPress={() => router.push(`/(app)/question-sets/${id}/textbook`)}
            >
              <Text style={styles.textbookButtonText}>
                📚 {t("View Textbook", "教科書を見る")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* 作成者向け：教科書編集ボタン */}
        {user?.id === questionSet?.creator_id && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.editTextbookButton}
              onPress={() => router.push(`/(app)/question-sets/${id}/edit-textbook`)}
            >
              <Text style={styles.editTextbookButtonText}>
                ✏️ {t("Edit Textbook", "教科書を編集")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={handleShowCSVHelp}
          >
            <Text style={styles.helpButtonText}>
              {t("CSV Help", "CSVヘルプ")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.csvSampleButton}
            onPress={() => {
              console.log("CSV Sample button pressed");
              downloadCSVSample();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.csvSampleButtonText}>
              📄 {t("CSV Sample", "CSVサンプル")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditQuestionSet}
          >
            <Text style={styles.editButtonText}>
              {t("Edit Details", "詳細を編集")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteSet}
          >
            <Text style={styles.deleteButtonText}>{t("Delete", "削除")}</Text>
          </TouchableOpacity>
        </View>

        {user?.id === questionSet?.creator_id && (
          <View style={styles.copyrightCheckSection}>
            <Text style={styles.copyrightCheckTitle}>
              📋 著作権チェック（公開前必須）
            </Text>
            {copyrightCheckResult && (
              <View
                style={[
                  styles.copyrightResultBox,
                  copyrightCheckResult.risk_level === "low"
                    ? styles.copyrightResultLow
                    : copyrightCheckResult.risk_level === "medium"
                    ? styles.copyrightResultMedium
                    : styles.copyrightResultHigh,
                ]}
              >
                <Text style={styles.copyrightResultLabel}>
                  {copyrightCheckResult.risk_level === "low"
                    ? "✅ 問題なし（公開可能）"
                    : copyrightCheckResult.risk_level === "medium"
                    ? "⚠️ 要注意"
                    : "❌ 高リスク（公開不可）"}
                </Text>
                {copyrightCheckResult.reasons.length > 0 && (
                  <Text style={styles.copyrightResultReasons}>
                    {copyrightCheckResult.reasons.join("\n")}
                  </Text>
                )}
                {copyrightCheckResult.recommendation ? (
                  <Text style={styles.copyrightResultRec}>
                    {copyrightCheckResult.recommendation}
                  </Text>
                ) : null}
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.copyrightCheckButton,
                isCopyrightChecking && styles.buttonDisabled,
              ]}
              onPress={handleCopyrightCheck}
              disabled={isCopyrightChecking}
            >
              {isCopyrightChecking ? (
                <View style={styles.copyrightCheckButtonInner}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.copyrightCheckButtonText}>
                    {"  "}チェック中...（数秒〜数十秒かかります）
                  </Text>
                </View>
              ) : (
                <Text style={styles.copyrightCheckButtonText}>
                  🔍 著作権チェックを実行
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 通報ボタン（他のユーザーのコンテンツのみ） */}
        {user && user.id !== questionSet?.creator_id && (
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setReportModalVisible(true)}
          >
            <Text style={styles.reportButtonText}>🚩 この問題集を通報</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={modalConfig.buttons}
        onClose={() => setModalVisible(false)}
      />

      {questionSet && (
        <ReportModal
          visible={reportModalVisible}
          questionSetId={questionSet.id}
          questionSetTitle={questionSet.title}
          onClose={() => setReportModalVisible(false)}
        />
      )}

      <Modal
        visible={selectionModalVisible}
        title={t("Select Questions", "問題選択")}
        onClose={() => setSelectionModalVisible(false)}
      >
        <View style={styles.selectionModalContent}>
          <Text style={styles.selectionLabel}>
            {t("Selection Mode", "選択モード")}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t("Number of questions", "問題数")}:</Text>
            <TextInput
              style={styles.input}
              value={questionCountInput}
              onChangeText={(text) => setQuestionCountInput(text)}
              onBlur={() => {
                const num = parseInt(questionCountInput);
                const max = questions.length;
                if (isNaN(num) || num < 1) {
                  setQuestionCount(1);
                  setQuestionCountInput("1");
                } else if (max > 0 && num > max) {
                  setQuestionCount(max);
                  setQuestionCountInput(String(max));
                } else {
                  setQuestionCount(num);
                  setQuestionCountInput(String(num));
                }
              }}
              keyboardType="numeric"
              placeholder="10"
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
            />
            <Text style={styles.selectionOptionDesc}>
              {t("Used for AI/Range/Review", "AI/範囲/復習で使われます")}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "all" && styles.selectionOptionActive,
            ]}
            onPress={() => {
              if (selectionMode === "all") {
                // 既に選択されている場合はクイズを開始
                handleStartQuizWithSelection();
              } else {
                // 初回選択時はモードを設定
                setSelectionMode("all");
              }
            }}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "all" && styles.selectionOptionTitleActive,
                ]}
              >
                📚 {t("All Questions", "全ての問題")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "Practice all questions in order",
                "全ての問題を順番通りに解く"
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "ai" && styles.selectionOptionActive,
            ]}
            onPress={() => {
              if (selectionMode === "ai") {
                // 既に選択されている場合はクイズを開始
                handleStartQuizWithSelection();
              } else {
                // 初回選択時はモードを設定
                setSelectionMode("ai");
              }
            }}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "ai" && styles.selectionOptionTitleActive,
                ]}
              >
                🤖 {t("AI Selection", "AI選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "AI selects questions based on wrong answers, attempt count, and answer time (default: 10 questions)",
                "AIが間違えた数、出題回数、回答時間から問題を選出（初期値：10問）"
              )}
            </Text>
            {selectionMode === "ai" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Number of questions", "問題数")}:
                </Text>
                <TextInput
                  style={styles.input}
                  value={questionCount.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 10;
                    setQuestionCount(
                      Math.min(Math.max(num, 1), questions.length)
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                  onStartShouldSetResponder={() => true}
                  onResponderTerminationRequest={() => false}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "category" && styles.selectionOptionActive,
            ]}
            onPress={() => {
              if (selectionMode === "category" && selectedCategory) {
                // 既に選択されていてカテゴリも選択されている場合はクイズを開始
                handleStartQuizWithSelection();
              } else {
                // 初回選択時はモードを設定
                setSelectionMode("category");
              }
            }}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "category" &&
                    styles.selectionOptionTitleActive,
                ]}
              >
                📁 {t("Category Selection", "カテゴリ別選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t("Select questions by category", "カテゴリごとに問題を選出")}
            </Text>
            {selectionMode === "category" && questionGroups.length > 0 && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Select Category", "カテゴリを選択")}:
                </Text>
                <FlatList
                  data={questionGroups}
                  keyExtractor={(item, index) =>
                    `cat_${item.category || "uncategorized"}_${index}`
                  }
                  renderItem={({ item: group }) => (
                    <TouchableOpacity
                      style={[
                        styles.categoryOption,
                        selectedCategory === (group.category || "未分類") &&
                          styles.categoryOptionActive,
                      ]}
                      onPress={() => {
                        const category = group.category || "未分類";
                        setSelectedCategory(category);
                        // カテゴリ選択後、少し待ってからクイズを開始
                        setTimeout(() => {
                          handleStartQuizWithSelection();
                        }, 300);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          selectedCategory === (group.category || "未分類") &&
                            styles.categoryOptionTextActive,
                        ]}
                      >
                        {group.category || t("Uncategorized", "未分類")} (
                        {group.count} {t("questions", "問")})
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "range" && styles.selectionOptionActive,
            ]}
            onPress={() => {
              if (selectionMode === "range") {
                // 既に選択されている場合はクイズを開始
                handleStartQuizWithSelection();
              } else {
                // 初回選択時はモードを設定
                setSelectionMode("range");
              }
            }}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "range" &&
                    styles.selectionOptionTitleActive,
                ]}
              >
                🎯 {t("Range Selection", "範囲選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "Select questions from a specific range",
                "指定した範囲の問題を選出"
              )}
            </Text>
            {selectionMode === "range" && (
              <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {t("Start from question", "開始問題番号")}:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={rangeStart.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setRangeStart(
                        Math.min(Math.max(num, 0), questions.length - 1)
                      );
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                  />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {t("Number of questions", "問題数")}:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={questionCount.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setQuestionCount(
                        Math.min(
                          Math.max(num, 1),
                          questions.length - rangeStart
                        )
                      );
                    }}
                    keyboardType="numeric"
                    placeholder="10"
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                  />
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, styles.reviewStartButton]}
            onPress={handleStartReviewQuiz}
          >
            <Text style={styles.reviewStartButtonText}>
              ⏰ {t(
                `Forgetting curve (recommended) (${questionCount})`,
                `忘却曲線（推奨）で復習開始（${questionCount}問）`
              )}
            </Text>
            <Text style={styles.reviewStartButtonDesc}>
              {t(
                "Due items only (recommended timing)",
                "期限が来た問題だけ（おすすめ）"
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, styles.reviewStartButton]}
            onPress={handleStartForgettingCurveReviewQuiz}
          >
            <Text style={styles.reviewStartButtonText}>
              📉 {t(
                `Forgetting curve (precise) (${questionCount})`,
                `忘却曲線（精密）で復習開始（${questionCount}問）`
              )}
            </Text>
            <Text style={styles.reviewStartButtonDesc}>
              {t("Lowest retention first", "記憶保持率が低い順に出題")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, styles.reviewStartButton]}
            onPress={handleStartMostIncorrectReviewQuiz}
          >
            <Text style={styles.reviewStartButtonText}>
              ❌ {t(
                `Review most incorrect (${questionCount})`,
                `間違いが多い順で復習開始（${questionCount}問）`
              )}
            </Text>
            <Text style={styles.reviewStartButtonDesc}>
              {t("Most wrong answers first", "間違い回数が多い問題から")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, styles.primaryStartButton]}
            onPress={handleStartQuizWithSelection}
          >
            <Text style={styles.startButtonText}>
              ▶ {t("Start Quiz", "クイズ開始")}
            </Text>
            <Text style={styles.primaryStartButtonDesc}>
              {t("Start with the selected mode above", "上の選択モードでクイズを開始")}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ...commonStyles,
  setupGuide: {
    backgroundColor: "#FFF8E1",
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#FFB300",
  },
  setupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F57C00",
  },
  closeSetupButton: {
    padding: 4,
  },
  closeSetupText: {
    fontSize: 20,
    color: "#F57C00",
    fontWeight: "bold",
  },
  setupSteps: {
    gap: 12,
  },
  setupStepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    opacity: 0.5,
  },
  setupStepActive: {
    opacity: 1,
  },
  setupStepCompleted: {
    opacity: 0.7,
  },
  setupStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE082",
    justifyContent: "center",
    alignItems: "center",
  },
  setupStepNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F57C00",
  },
  setupStepText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  category: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    color: "#666",
  },
  deleteText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  questionType: {
    fontSize: 14,
    color: "#666",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  addButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  uploadCSVButton: {
    flex: 2,
    backgroundColor: "#FF9500",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  uploadCSVButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  helpButton: {
    flex: 1,
    backgroundColor: "#5856D6",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  helpButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  csvSampleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  csvSampleButton: {
    backgroundColor: "#d4d229ff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editButton: {
    flex: 2,
    backgroundColor: "#5AC8FA",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  tokushoLink: {
    marginHorizontal: 16,
    marginBottom: 8,
    alignSelf: "flex-end",
  },
  tokushoLinkText: {
    fontSize: 12,
    color: "#007AFF",
    textDecorationLine: "underline",
  },
  copyrightCheckSection: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  copyrightCheckTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  copyrightResultBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  copyrightResultLow: {
    backgroundColor: "#f0fff4",
    borderColor: "#48bb78",
  },
  copyrightResultMedium: {
    backgroundColor: "#fffaf0",
    borderColor: "#ed8936",
  },
  copyrightResultHigh: {
    backgroundColor: "#fff5f5",
    borderColor: "#e53e3e",
  },
  copyrightResultLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    color: "#1a1a1a",
  },
  copyrightResultReasons: {
    fontSize: 12,
    color: "#555",
    marginBottom: 4,
    lineHeight: 18,
  },
  copyrightResultRec: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    lineHeight: 18,
  },
  copyrightCheckButton: {
    backgroundColor: "#553C9A",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  copyrightCheckButtonInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  copyrightCheckButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  reportButton: {
    marginTop: 12,
    padding: 10,
    alignItems: "center",
  },
  reportButtonText: {
    fontSize: 13,
    color: "#e53e3e",
    textDecorationLine: "underline",
  },
  editTextbookButton: {
    flex: 1,
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editTextbookButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  retentionContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  retentionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  retentionLabel: {
    fontSize: 12,
    color: "#666",
  },
  retentionValue: {
    fontSize: 13,
    fontWeight: "bold",
  },
  retentionBarBg: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  retentionBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  reviewDateText: {
    fontSize: 11,
    color: "#999",
  },
  reviewButton: {
    backgroundColor: "#FF9500",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  reviewButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryStartButton: {
    backgroundColor: "#007AFF",
  },
  reviewStartButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#007AFF",
    alignItems: "flex-start",
  },
  reviewStartButtonText: {
    ...commonStyles.startButtonText,
    color: "#007AFF",
    width: "100%",
    textAlign: "left",
  },
  reviewStartButtonDesc: {
    marginTop: 6,
    fontSize: 12,
    color: "#007AFF",
    opacity: 0.85,
    width: "100%",
    textAlign: "left",
  },
  primaryStartButtonDesc: {
    marginTop: 6,
    fontSize: 12,
    color: "#fff",
    opacity: 0.9,
  },
  selectionOption: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  selectionOptionActive: {
    backgroundColor: "#E8F4FF",
    borderColor: "#007AFF",
  },
  selectionOptionTitle: {
    ...commonStyles.selectionOptionTitle,
    fontSize: 18,
    color: "#007AFF",
  },
  selectionOptionTitleActive: {
    color: "#007AFF",
  },
  purchaseSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  purchaseButton: {
    backgroundColor: "#FF9500",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    shadowColor: "#FF9500",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  purchasedSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  purchasedText: {
    color: "#2E7D32",
    fontSize: 15,
    fontWeight: "700",
  },
});
