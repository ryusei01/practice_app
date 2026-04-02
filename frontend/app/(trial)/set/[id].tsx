import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
  LocalQuestion,
} from "../../../src/services/localStorageService";
import {
  getAvailableTextbooks,
  Textbook,
} from "../../../src/services/textbookService";
import Header from "../../../src/components/Header";
import Modal from "../../../src/components/Modal";
import { commonStyles } from "../../../src/styles/questionSetDetailStyles";
import aiService from "../../../src/services/aiService";

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
  const [questionStats, setQuestionStats] = useState<
    Map<string, QuestionStats>
  >(new Map());

  // 問題選択モーダル用のstate
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState<
    "all" | "ai" | "count" | "category"
  >("all");
  const [questionCount, setQuestionCount] = useState(10); // 初期値10問
  const [questionCountInput, setQuestionCountInput] = useState("10"); // 入力中の値を保持
  const [questionGroups, setQuestionGroups] = useState<
    Array<{ category: string | null; questions: LocalQuestion[] }>
  >([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  /** カテゴリがある場合のみ: カテゴリ別 / 問題番号（配列順） */
  const [listOrderMode, setListOrderMode] = useState<
    "category" | "questionNumber"
  >("category");
  const flatListRef = useRef<FlatList>(null);

  // エラーモーダル用のstate
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalConfig, setErrorModalConfig] = useState<{
    title: string;
    message: string;
  }>({
    title: "",
    message: "",
  });

  // 教科書選択モーダル用のstate
  const [textbookModalVisible, setTextbookModalVisible] = useState(false);
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);

  // 画面がフォーカスされるたびにデータをリロード
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  useEffect(() => {
    setListOrderMode("category");
  }, [id]);

  const showErrorModal = (title: string, message: string) => {
    setErrorModalConfig({ title, message });
    setErrorModalVisible(true);
  };

  const loadAvailableTextbooks = async () => {
    try {
      setLoadingTextbooks(true);
      const textbooks = await getAvailableTextbooks();
      setAvailableTextbooks(textbooks);
    } catch (error) {
      console.error("Failed to load textbooks:", error);
      showErrorModal(
        t("Error", "エラー"),
        t("Failed to load textbooks", "教科書の読み込みに失敗しました")
      );
    } finally {
      setLoadingTextbooks(false);
    }
  };

  const handleSelectTextbook = async (textbook: Textbook) => {
    try {
      await localStorageService.updateTrialQuestionSet(id, {
        textbook_path: textbook.path,
        textbook_type: textbook.type,
      });
      await loadData();
      setTextbookModalVisible(false);
    } catch (error) {
      console.error("Failed to update textbook:", error);
      showErrorModal(
        t("Error", "エラー"),
        t("Failed to assign textbook", "教科書の割り当てに失敗しました")
      );
    }
  };

  const handleRemoveTextbook = async () => {
    try {
      await localStorageService.updateTrialQuestionSet(id, {
        textbook_path: undefined,
        textbook_type: undefined,
      });
      await loadData();
    } catch (error) {
      console.error("Failed to remove textbook:", error);
      showErrorModal(
        t("Error", "エラー"),
        t("Failed to remove textbook", "教科書の削除に失敗しました")
      );
    }
  };

  const loadData = async () => {
    try {
      const set = await localStorageService.getTrialQuestionSet(id);
      setQuestionSet(set);

      // カテゴリごとにグループ化
      if (set) {
        const groupsMap = new Map<string | null, LocalQuestion[]>();
        set.questions.forEach((q) => {
          const category = q.category || null;
          if (!groupsMap.has(category)) {
            groupsMap.set(category, []);
          }
          groupsMap.get(category)!.push(q);
        });
        const groups = Array.from(groupsMap.entries()).map(
          ([category, questions]) => ({
            category,
            questions,
          })
        );
        setQuestionGroups(groups);
      }

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

  // ローカルストレージから回答履歴を読み取ってAI選出
  const selectQuestionsByAI = async (
    count: number
  ): Promise<LocalQuestion[]> => {
    if (!questionSet) return [];

    // trialモード用の一時的なuser_idを生成（問題セットIDをベースに）
    const trialUserId = `trial_${id}`;

    try {
      // バックエンドのAI推薦APIを呼び出す（コールドスタート対応あり）
      const recommendedQuestionIds = await aiService.getRecommendations({
        user_id: trialUserId,
        question_set_id: id,
        count: count,
      });

      // 推薦された問題IDに対応する問題を取得
      const recommendedQuestions = questionSet.questions.filter((q) =>
        recommendedQuestionIds.includes(q.id)
      );

      // 推薦された問題が十分な場合は返す
      if (recommendedQuestions.length >= count) {
        return recommendedQuestions.slice(0, count);
      }

      // 推薦された問題が不足している場合は、ローカルフォールバックを使用
      console.log(
        `AI recommendation returned ${recommendedQuestions.length} questions, using fallback`
      );
    } catch (error) {
      // エラーが発生した場合は、ローカルフォールバックを使用
      console.error("AI recommendation failed, using local fallback:", error);
    }

    // ローカルフォールバック: 既存のロジックを使用
    const storageKey = `@flashcard_answers_${id}`;
    const answersData = await AsyncStorage.getItem(storageKey);
    const answers = answersData ? JSON.parse(answersData) : [];

    // 各問題の統計を計算
    const questionStatsMap = new Map<
      string,
      {
        attemptCount: number;
        errorCount: number;
        avgTime: number;
        totalTime: number;
      }
    >();

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
        score =
          stats.errorCount * 100 +
          (10 - stats.attemptCount) * 10 +
          stats.avgTime;
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
      } else if (selectionMode === "category") {
        // カテゴリ別選択
        if (!selectedCategory) {
          showErrorModal(
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
        // countモード: 指定した問題数をランダムに選出
        const shuffled = [...questionSet.questions].sort(
          () => Math.random() - 0.5
        );
        selectedQuestions = shuffled.slice(0, questionCount);
      }

      if (selectedQuestions.length === 0) {
        showErrorModal(
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
      >
        <View
          style={styles.questionHeader}
          nativeID={`question-header-${index}`}
        >
          <Text
            style={styles.questionNumber}
            nativeID={`question-number-${index}`}
          >
            Q{index + 1}
          </Text>
          {item.difficulty && (
            <Text
              style={styles.difficulty}
              nativeID={`question-difficulty-${index}`}
            >
              {t("Level", "レベル")}: {item.difficulty}
            </Text>
          )}
        </View>
        <Text style={styles.questionText} nativeID={`question-text-${index}`}>
          {item.question}
        </Text>

        {/* 回答統計を表示 */}
        {stats && (
          <View style={styles.questionStatsContainer}>
            <View style={styles.questionStatItem}>
              <Text style={styles.questionStatLabel}>
                {t("Accuracy", "正解率")}:
              </Text>
              <Text
                style={[
                  styles.questionStatValue,
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
            <View style={styles.questionStatItem}>
              <Text style={styles.questionStatLabel}>
                {t("Attempts", "回答数")}:
              </Text>
              <Text style={styles.questionStatValue}>
                {stats.correctCount}/{stats.totalAttempts}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.clickHint} nativeID={`click-hint-${index}`}>
          <Text
            style={styles.clickHintText}
            nativeID={`click-hint-text-${index}`}
          >
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

      <View style={styles.header} nativeID="question-set-header">
        <View style={styles.titleContainer}>
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
          <View style={styles.trialBadge} nativeID="trial-badge">
            <Text style={styles.trialBadgeText} nativeID="trial-badge-text">
              {t("Trial Mode", "お試しモード")}
            </Text>
          </View>
        </View>

        <View style={styles.descriptionRow} nativeID="description-row">
          {/* カテゴリリンク（問題番号順表示中は非表示） */}
          {questionGroups.length > 0 && listOrderMode === "category" && (
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
                      {group.questions.length})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsContainer} nativeID="stats-container">
        <View style={styles.stat} nativeID="stat-questions">
          <Text style={styles.statValue} nativeID="stat-questions-value">
            {questionSet.questions.length}
          </Text>
          <Text style={styles.statLabel} nativeID="stat-questions-label">
            {t("Questions", "問題数")}
          </Text>
        </View>
      </View>

      {questionGroups.length > 0 && (
        <View
          style={styles.listOrderToggleRow}
          nativeID="list-order-toggle-row"
        >
          <TouchableOpacity
            style={styles.listOrderToggleButton}
            onPress={() =>
              setListOrderMode((m) =>
                m === "category" ? "questionNumber" : "category"
              )
            }
            nativeID="list-order-toggle-button"
          >
            <Text
              style={styles.listOrderToggleText}
              nativeID="list-order-toggle-text"
            >
              {listOrderMode === "category"
                ? t("View by question number", "問題番号順に表示")
                : t("View by category", "カテゴリ別に表示")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* カテゴリ別にグループ化して表示 / 問題番号順はフラット一覧 */}
      {questionGroups.length > 0 && listOrderMode === "category" ? (
        <FlatList
          ref={flatListRef}
          data={questionGroups}
          keyExtractor={(item, index) =>
            `category_${item.category || "uncategorized"}_${index}`
          }
          contentContainerStyle={styles.listContainer}
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
                  {group.questions.length} {t("questions", "問")}
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
                const globalIndex = questionSet.questions.findIndex(
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
              <Text style={styles.emptyText}>
                {t("No questions yet", "まだ問題がありません")}
              </Text>
            </View>
          }
        />
      ) : (
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
      )}

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
        {questionSet?.textbook_path ? (
          <View style={styles.textbookButtonRow}>
            <TouchableOpacity
              style={styles.textbookButton}
              onPress={() => router.push(`/(trial)/set/${id}/textbook`)}
            >
              <Text style={styles.textbookButtonText}>
                📚 {t("View Textbook", "教科書を見る")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeTextbookButton}
              onPress={handleRemoveTextbook}
            >
              <Text style={styles.removeTextbookButtonText}>
                {t("Remove", "削除")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.textbookButton}
            onPress={() => {
              loadAvailableTextbooks();
              setTextbookModalVisible(true);
            }}
          >
            <Text style={styles.textbookButtonText}>
              📚 {t("Assign Textbook", "教科書を割り当て")}
            </Text>
          </TouchableOpacity>
        )}
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

          <View
            style={[
              styles.selectionOption,
              selectionMode === "ai" && styles.selectionOptionActive,
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                if (selectionMode === "ai") {
                  // 既に選択されている場合はクイズを開始
                  handleStartQuizWithSelection();
                } else {
                  // 初回選択時はモードを設定
                  setSelectionMode("ai");
                }
              }}
              activeOpacity={0.7}
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
            </TouchableOpacity>
            {selectionMode === "ai" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Number of questions", "問題数")}:
                </Text>
                <TextInput
                  style={styles.input}
                  value={questionCountInput}
                  onChangeText={(text) => {
                    // 入力中は完全に自由に入力できるようにする（制限なし）
                    setQuestionCountInput(text);
                  }}
                  onBlur={() => {
                    // フォーカスが外れた時に検証・制限を適用
                    const num = parseInt(questionCountInput);
                    if (isNaN(num) || num < 1) {
                      setQuestionCount(1);
                      setQuestionCountInput("1");
                    } else if (num > questionSet.questions.length) {
                      setQuestionCount(questionSet.questions.length);
                      setQuestionCountInput(
                        questionSet.questions.length.toString()
                      );
                    } else {
                      setQuestionCount(num);
                      setQuestionCountInput(num.toString());
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#999"
                  editable={true}
                />
              </View>
            )}
          </View>

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
                        {group.questions.length} {t("questions", "問")})
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </TouchableOpacity>

          <View
            style={[
              styles.selectionOption,
              selectionMode === "count" && styles.selectionOptionActive,
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                if (selectionMode === "count") {
                  // 既に選択されている場合はクイズを開始
                  handleStartQuizWithSelection();
                } else {
                  // 初回選択時はモードを設定
                  setSelectionMode("count");
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.selectionOptionHeader}>
                <Text
                  style={[
                    styles.selectionOptionTitle,
                    selectionMode === "count" &&
                      styles.selectionOptionTitleActive,
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
            </TouchableOpacity>
            {selectionMode === "count" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Number of questions", "問題数")}:
                </Text>
                <TextInput
                  style={styles.input}
                  value={questionCountInput}
                  onChangeText={(text) => {
                    // 入力中は完全に自由に入力できるようにする（制限なし）
                    setQuestionCountInput(text);
                  }}
                  onBlur={() => {
                    // フォーカスが外れた時に検証・制限を適用
                    const num = parseInt(questionCountInput);
                    if (isNaN(num) || num < 1) {
                      setQuestionCount(1);
                      setQuestionCountInput("1");
                    } else if (num > questionSet.questions.length) {
                      setQuestionCount(questionSet.questions.length);
                      setQuestionCountInput(
                        questionSet.questions.length.toString()
                      );
                    } else {
                      setQuestionCount(num);
                      setQuestionCountInput(num.toString());
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#999"
                  editable={true}
                />
              </View>
            )}
          </View>

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

      {/* 教科書選択モーダル */}
      <Modal
        visible={textbookModalVisible}
        title={t("Select Textbook", "教科書を選択")}
        onClose={() => setTextbookModalVisible(false)}
      >
        <View style={styles.textbookModalContent}>
          {loadingTextbooks ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : availableTextbooks.length === 0 ? (
            <Text style={styles.emptyText}>
              {t("No textbooks available", "利用可能な教科書がありません")}
            </Text>
          ) : (
            <ScrollView>
              {availableTextbooks.map((textbook) => (
                <TouchableOpacity
                  key={textbook.path}
                  style={styles.textbookOption}
                  onPress={() => handleSelectTextbook(textbook)}
                >
                  <Text style={styles.textbookOptionName}>{textbook.name}</Text>
                  <Text style={styles.textbookOptionType}>
                    {textbook.type === "markdown" ? "📄 Markdown" : "📕 PDF"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* エラーモーダル */}
      <Modal
        visible={errorModalVisible}
        title={errorModalConfig.title}
        message={errorModalConfig.message}
        buttons={[
          { text: t("OK", "OK"), onPress: () => setErrorModalVisible(false) },
        ]}
        onClose={() => setErrorModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ...commonStyles,
  titleContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
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
  listContainer: {
    ...commonStyles.listContainer,
    paddingBottom: 180,
  },
  listOrderToggleRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  listOrderToggleButton: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F4FF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  listOrderToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  questionStatsContainer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  questionStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  questionStatLabel: {
    fontSize: 13,
    color: "#666",
  },
  questionStatValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
  },
  buttonContainer: {
    ...commonStyles.buttonContainer,
    zIndex: 1000,
    elevation: 10,
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
    ...commonStyles.selectionModalContent,
    gap: 16,
  },
  selectionLabel: {
    ...commonStyles.selectionLabel,
    marginBottom: 8,
  },
  selectionOption: {
    ...commonStyles.selectionOption,
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
  },
  selectionOptionHeader: {
    ...commonStyles.selectionOptionHeader,
    marginBottom: 8,
  },
  selectionOptionTitle: {
    ...commonStyles.selectionOptionTitle,
    fontSize: 18,
  },
  selectionOptionDesc: {
    ...commonStyles.selectionOptionDesc,
    lineHeight: 20,
  },
  inputLabel: {
    ...commonStyles.inputLabel,
    fontWeight: "600",
  },
  input: {
    ...commonStyles.input,
    backgroundColor: "#fff",
    padding: 12,
  },
  startButton: {
    ...commonStyles.startButton,
    borderRadius: 12,
  },
  startButtonText: {
    ...commonStyles.startButtonText,
    fontSize: 18,
  },
  categoryHeader: {
    ...commonStyles.categoryHeader,
    borderBottomColor: "#34C759",
  },
  categoryOptionActive: {
    ...commonStyles.categoryOptionActive,
    borderColor: "#34C759",
    backgroundColor: "#E8F5E9",
  },
  categoryOptionTextActive: {
    ...commonStyles.categoryOptionTextActive,
    color: "#34C759",
  },
  textbookButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  textbookButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    flex: 1,
  },
  textbookButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  removeTextbookButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    flex: 1,
  },
  removeTextbookButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  textbookModalContent: {
    maxHeight: 400,
    padding: 16,
  },
  textbookOption: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  textbookOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  textbookOptionType: {
    fontSize: 14,
    color: "#666",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    padding: 20,
  },
});
