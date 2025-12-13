import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../../../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../../../../src/services/localStorageService";
import Header from "../../../../../src/components/Header";

export default function QuestionDetailScreen() {
  const { id, questionIndex } = useLocalSearchParams<{
    id: string;
    questionIndex: string;
  }>();
  const { t } = useLanguage();
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<LocalQuestionSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);

  const currentIndex = parseInt(questionIndex || "0");

  useEffect(() => {
    loadQuestionSet();
  }, [id]);

  const loadQuestionSet = async () => {
    if (!id || typeof id !== "string") return;

    try {
      const set = await localStorageService.getTrialQuestionSet(id);
      if (set) {
        setQuestionSet(set);
      } else {
        Alert.alert(
          t("Error", "エラー"),
          t("Question set not found", "問題セットが見つかりません"),
          [{ text: t("OK", "OK"), onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error("Error loading question set:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to load question set", "問題セットの読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setShowAnswer(false);
      router.push(`/(trial)/set/${id}/question/${currentIndex - 1}`);
    }
  };

  const handleNext = () => {
    if (questionSet && currentIndex < questionSet.questions.length - 1) {
      setShowAnswer(false);
      router.push(`/(trial)/set/${id}/question/${currentIndex + 1}`);
    }
  };

  const handleStartFlashcard = () => {
    router.push(`/(app)/flashcard/${id}?startIndex=${currentIndex}`);
  };

  const handleStartQuiz = () => {
    router.push(`/(trial)/quiz/${id}?startIndex=${currentIndex}`);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer} nativeID="question-detail-loading">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!questionSet || !questionSet.questions[currentIndex]) {
    return (
      <View style={styles.centerContainer} nativeID="question-detail-error">
        <Text style={styles.errorText} nativeID="error-text">
          {t("Question not found", "問題が見つかりません")}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          nativeID="error-back-btn"
        >
          <Text style={styles.backButtonText} nativeID="error-back-text">
            {t("Go Back", "戻る")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentQuestion = questionSet.questions[currentIndex];

  return (
    <View style={styles.container} nativeID="question-detail-container">
      <Header title={`${t("Question", "問題")} ${currentIndex + 1}/${questionSet.questions.length}`} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        nativeID="question-detail-scroll"
      >
        <View style={styles.trialBadge} nativeID="trial-badge">
          <Text style={styles.trialBadgeText} nativeID="trial-badge-text">
            {t("Trial Mode", "お試しモード")}
          </Text>
        </View>

        <View style={styles.questionCard} nativeID="question-card">
          <View style={styles.questionHeader} nativeID="question-header">
            <Text style={styles.questionNumber} nativeID="question-number">
              Q{currentIndex + 1}
            </Text>
            {currentQuestion.difficulty && (
              <Text style={styles.difficulty} nativeID="question-difficulty">
                {t("Level", "レベル")}: {currentQuestion.difficulty}
              </Text>
            )}
          </View>

          <Text style={styles.questionText} nativeID="question-text">
            {currentQuestion.question}
          </Text>

          <TouchableOpacity
            style={styles.showAnswerButton}
            onPress={() => setShowAnswer(!showAnswer)}
            nativeID="show-answer-btn"
          >
            <Text style={styles.showAnswerButtonText} nativeID="show-answer-text">
              {showAnswer
                ? t("Hide Answer", "答えを隠す")
                : t("Show Answer", "答えを表示")}
            </Text>
          </TouchableOpacity>

          {showAnswer && (
            <View style={styles.answerContainer} nativeID="answer-container">
              <Text style={styles.answerLabel} nativeID="answer-label">
                {t("Answer", "答え")}:
              </Text>
              <Text style={styles.answerText} nativeID="answer-text">
                {currentQuestion.answer}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.navigationContainer} nativeID="nav-container">
          <TouchableOpacity
            style={[
              styles.navButton,
              currentIndex === 0 && styles.navButtonDisabled,
            ]}
            onPress={handlePrevious}
            disabled={currentIndex === 0}
            nativeID="nav-prev-btn"
          >
            <Text
              style={[
                styles.navButtonText,
                currentIndex === 0 && styles.navButtonTextDisabled,
              ]}
              nativeID="nav-prev-text"
            >
              ← {t("Previous", "前へ")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              currentIndex === questionSet.questions.length - 1 &&
                styles.navButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={currentIndex === questionSet.questions.length - 1}
            nativeID="nav-next-btn"
          >
            <Text
              style={[
                styles.navButtonText,
                currentIndex === questionSet.questions.length - 1 &&
                  styles.navButtonTextDisabled,
              ]}
              nativeID="nav-next-text"
            >
              {t("Next", "次へ")} →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionContainer} nativeID="action-container">
          <TouchableOpacity
            style={styles.flashcardButton}
            onPress={handleStartFlashcard}
            nativeID="flashcard-btn"
          >
            <Text style={styles.flashcardButtonText} nativeID="flashcard-text">
              📇 {t("Flashcard Mode", "赤シート機能")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quizButton}
            onPress={handleStartQuiz}
            nativeID="quiz-btn"
          >
            <Text style={styles.quizButtonText} nativeID="quiz-text">
              {t("Start Quiz", "クイズを開始")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  trialBadge: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  trialBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  questionText: {
    fontSize: 18,
    color: "#333",
    marginBottom: 20,
    lineHeight: 26,
  },
  showAnswerButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  showAnswerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  answerContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 8,
  },
  answerText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  navButtonDisabled: {
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
  },
  navButtonText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  actionContainer: {
    gap: 12,
  },
  flashcardButton: {
    backgroundColor: "#FF1D69",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  flashcardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  quizButton: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  quizButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
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
});
