import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
  LocalQuestion,
} from "../../../src/services/localStorageService";
import Header from "../../../src/components/Header";
import Modal from "../../../src/components/Modal";

// 問題ごとの回答統計
interface QuestionStats {
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  lastAnsweredAt: string | null;
}

export default function TrialSetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<LocalQuestionSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [questionStats, setQuestionStats] = useState<Map<string, QuestionStats>>(new Map());

  // 問題選択モーダル用のstate
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"all" | "ai" | "count">("all");
  const [questionCount, setQuestionCount] = useState(10); // 初期値10問

  // エラーモーダル用のstate
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalConfig, setErrorModalConfig] = useState<{
    title: string;
    message: string;
  }>({
    title: "",
    message: "",
  });

  // 画面がフォーカスされるたびにデータをリロード
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const showErrorModal = (title: string, message: string) => {
    setErrorModalConfig({ title, message });
    setErrorModalVisible(true);
  };

  const loadData = async () => {
    try {
      const set = await localStorageService.getTrialQuestionSet(id);
      setQuestionSet(set);

      // 回答データを読み込み
      await loadAnswerStats();
    } catch (error) {
      console.error("Failed to load question set:", error);
      showErrorModal(
        t("Error", "エラー"),
        t("Failed to load question set", "問題セットの読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
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
        existing.accuracy = (existing.correctCount / existing.totalAttempts) * 100;

        // 最新の回答日時を更新
        if (!existing.lastAnsweredAt || answer.answered_at > existing.lastAnsweredAt) {
          existing.lastAnsweredAt = answer.answered_at;
        }

        statsMap.set(questionId, existing);
      });

      setQuestionStats(statsMap);
    } catch (error) {
      console.error("Failed to load answer stats:", error);
    }
  };

  // ローカルストレージから回答履歴を読み取ってAI選出
  const selectQuestionsByAI = async (count: number): Promise<LocalQuestion[]> => {
    if (!questionSet) return [];

    const storageKey = `@flashcard_answers_${id}`;
    const answersData = await AsyncStorage.getItem(storageKey);
    const answers = answersData ? JSON.parse(answersData) : [];

    // 各問題の統計を計算
    const questionStatsMap = new Map<string, {
      attemptCount: number;
      errorCount: number;
      avgTime: number;
      totalTime: number;
    }>();

    answers.forEach((answer: any) => {
      const questionId = answer.question_id;
      const existing = questionStatsMap.get(questionId) || {
        attemptCount: 0,
        errorCount: 0,
        avgTime: 0,
        totalTime: 0,
      };

      existing.attemptCount += 1;
      if (!answer.is_correct) {
        existing.errorCount += 1;
      }
      existing.totalTime = existing.totalTime + (answer.answer_time_sec || 0);
      existing.avgTime = existing.totalTime / existing.attemptCount;

      questionStatsMap.set(questionId, existing);
    });

    // 問題をスコアリングしてソート
    const scoredQuestions = questionSet.questions.map((q) => {
      const stats = questionStatsMap.get(q.id) || {
        attemptCount: 0,
        errorCount: 0,
        avgTime: 0,
      };

      // スコア計算（高いほど優先）
      // 1. 回答履歴がない問題を優先（attemptCount === 0 なら高スコア）
      // 2. 間違えた回数が多い問題
      // 3. 解いた回数が少ない問題
      // 4. 平均回答時間が長い問題
      let score = 0;
      if (stats.attemptCount === 0) {
        score = 1000; // 未回答は最優先
      } else {
        score = stats.errorCount * 100 + (10 - stats.attemptCount) * 10 + stats.avgTime;
      }

      return { question: q, score, stats };
    });

    // スコアでソート（降順）
    scoredQuestions.sort((a, b) => b.score - a.score);

    // 上位count件を返す
    return scoredQuestions.slice(0, count).map((item) => item.question);
  };

  const handleStartQuiz = () => {
    if (!questionSet || questionSet.questions.length === 0) {
      showErrorModal(
        t("No Questions", "問題がありません"),
        t(
          "This question set has no questions",
          "この問題セットには問題がありません"
        )
      );
      return;
    }
    setSelectionModalVisible(true);
  };

  const handleStartQuizWithSelection = async () => {
    if (!questionSet) return;

    try {
      setSelectionModalVisible(false);
      setIsLoading(true);

      let selectedQuestions: LocalQuestion[];

      if (selectionMode === "all") {
        selectedQuestions = questionSet.questions;
      } else if (selectionMode === "ai") {
        selectedQuestions = await selectQuestionsByAI(questionCount);
      } else {
        // countモード: 指定した問題数をランダムに選出
        const shuffled = [...questionSet.questions].sort(() => Math.random() - 0.5);
        selectedQuestions = shuffled.slice(0, questionCount);
      }

      if (selectedQuestions.length === 0) {
        showErrorModal(
          t("Error", "エラー"),
          t("No questions match your selection", "選択条件に一致する問題がありません")
        );
        setIsLoading(false);
        return;
      }

      // 選択した問題IDをクエリパラメータで渡す
      const questionIds = selectedQuestions.map(q => q.id).join(',');
      router.push(`/(trial)/quiz/${id}?questionIds=${questionIds}`);
    } catch (error) {
      console.error("Failed to select questions:", error);
      showErrorModal(
        t("Error", "エラー"),
        t("Failed to select questions", "問題の選択に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFlashcard = () => {
    if (!questionSet || questionSet.questions.length === 0) {
      return;
    }
    router.push(`/(app)/flashcard/${id}`);
  };

  const renderQuestion = ({ item, index }: { item: any; index: number }) => {
    const stats = questionStats.get(item.id);

    return (
      <TouchableOpacity
        style={styles.questionCard}
        onPress={() => router.push(`/(trial)/set/${id}/question/${index}`)}
        nativeID={`question-card-${index}`}
      >
        <View style={styles.questionHeader} nativeID={`question-header-${index}`}>
          <Text style={styles.questionNumber} nativeID={`question-number-${index}`}>Q{index + 1}</Text>
          {item.difficulty && (
            <Text style={styles.difficulty} nativeID={`question-difficulty-${index}`}>
              {t("Level", "レベル")}: {item.difficulty}
            </Text>
          )}
        </View>
        <Text style={styles.questionText} nativeID={`question-text-${index}`}>{item.question}</Text>

        {/* 回答統計を表示 */}
        {stats && (
          <View style={styles.statsContainer} nativeID={`question-stats-${index}`}>
            <View style={styles.statItem} nativeID={`stat-accuracy-${index}`}>
              <Text style={styles.statLabel} nativeID={`stat-accuracy-label-${index}`}>{t("Accuracy", "正解率")}:</Text>
              <Text
                style={[
                  styles.statValue,
                  stats.accuracy >= 80
                    ? styles.statGood
                    : stats.accuracy >= 50
                    ? styles.statMedium
                    : styles.statPoor,
                ]}
                nativeID={`stat-accuracy-value-${index}`}
              >
                {stats.accuracy.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.statItem} nativeID={`stat-attempts-${index}`}>
              <Text style={styles.statLabel} nativeID={`stat-attempts-label-${index}`}>{t("Attempts", "回答数")}:</Text>
              <Text style={styles.statValue} nativeID={`stat-attempts-value-${index}`}>
                {stats.correctCount}/{stats.totalAttempts}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.clickHint} nativeID={`click-hint-${index}`}>
          <Text style={styles.clickHintText} nativeID={`click-hint-text-${index}`}>
            {t("Tap for details", "タップで詳細")} →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.errorText}>
          {t("Question set not found", "問題セットが見つかりません")}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>{t("Go Back", "戻る")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={questionSet.title} />

      <View style={styles.header}>
        <Text style={styles.title}>{questionSet.title}</Text>
        {questionSet.description && (
          <Text style={styles.description}>{questionSet.description}</Text>
        )}
        <View style={styles.trialBadge}>
          <Text style={styles.trialBadgeText}>
            {t("Trial Mode", "お試しモード")}
          </Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{questionSet.questions.length}</Text>
          <Text style={styles.statLabel}>{t("Questions", "問題数")}</Text>
        </View>
      </View>

      <FlatList
        data={questionSet.questions}
        renderItem={renderQuestion}
        keyExtractor={(item, index) => `question_${index}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t("No questions yet", "まだ問題がありません")}
            </Text>
          </View>
        }
      />

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.startQuizButton,
              questionSet.questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartQuiz}
            disabled={questionSet.questions.length === 0}
          >
            <Text style={styles.startQuizButtonText}>
              {t("Start Quiz", "クイズを開始")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.flashcardButton,
              questionSet.questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartFlashcard}
            disabled={questionSet.questions.length === 0}
          >
            <Text style={styles.flashcardButtonText}>
              📇 {t("Flashcard", "赤シート機能")}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backToListButtonText}>
            {t("Back to List", "一覧に戻る")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 問題選択モーダル */}
      <Modal
        visible={selectionModalVisible}
        title={t("Select Questions", "問題選択")}
        onClose={() => setSelectionModalVisible(false)}
      >
        <View style={styles.selectionModalContent}>
          <Text style={styles.selectionLabel}>
            {t("Selection Mode", "選択モード")}
          </Text>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "all" && styles.selectionOptionActive,
            ]}
            onPress={() => setSelectionMode("all")}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "all" && styles.selectionOptionTitleActive,
                ]}
              >
                {t("All Questions", "全ての問題")}
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
            onPress={() => setSelectionMode("ai")}
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
                    setQuestionCount(Math.min(Math.max(num, 1), questionSet.questions.length));
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "count" && styles.selectionOptionActive,
            ]}
            onPress={() => setSelectionMode("count")}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "count" && styles.selectionOptionTitleActive,
                ]}
              >
                📊 {t("Random Selection", "ランダム選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "Select a specified number of questions randomly",
                "指定した問題数をランダムに選出"
              )}
            </Text>
            {selectionMode === "count" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Number of questions", "問題数")}:
                </Text>
                <TextInput
                  style={styles.input}
                  value={questionCount.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 10;
                    setQuestionCount(Math.min(Math.max(num, 1), questionSet.questions.length));
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartQuizWithSelection}
          >
            <Text style={styles.startButtonText}>
              {t("Start Quiz", "クイズ開始")}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* エラーモーダル */}
      <Modal
        visible={errorModalVisible}
        title={errorModalConfig.title}
        message={errorModalConfig.message}
        buttons={[{ text: t("OK", "OK"), onPress: () => setErrorModalVisible(false) }]}
        onClose={() => setErrorModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  trialBadge: {
    backgroundColor: "#34C759",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  trialBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 180,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  questionText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    color: "#666",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  statGood: {
    color: "#4CAF50",
  },
  statMedium: {
    color: "#FF9800",
  },
  statPoor: {
    color: "#F44336",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  startQuizButton: {
    flex: 1,
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  startQuizButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  flashcardButton: {
    flex: 1,
    backgroundColor: "#FF1D69",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  flashcardButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  backToListButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  backToListButtonText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  clickHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end",
  },
  clickHintText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  selectionModalContent: {
    gap: 16,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  selectionOption: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  selectionOptionActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  selectionOptionHeader: {
    marginBottom: 8,
  },
  selectionOptionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  selectionOptionTitleActive: {
    color: "#007AFF",
  },
  selectionOptionDesc: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  inputContainer: {
    marginTop: 12,
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 16,
  },
  startButton: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
