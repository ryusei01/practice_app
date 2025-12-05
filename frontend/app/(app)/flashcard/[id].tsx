import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { questionSetsApi, QuestionSet } from "../../../src/api/questionSets";
import { questionsApi, Question } from "../../../src/api/questions";

// expo-speechはモバイルのみ対応なので条件付きインポート
let Speech: any = null;
if (Platform.OS !== "web") {
  Speech = require("expo-speech");
}

const { width } = Dimensions.get("window");

export default function FlashcardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pan] = useState(new Animated.ValueXY());
  const [autoPlay, setAutoPlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    // 問題が変わったら音声を停止
    if (Speech) {
      Speech.stop();
      setIsSpeaking(false);
    }

    // 自動再生がONで、問題が読み込まれていたら読み上げ
    if (autoPlay && questions.length > 0 && !showAnswer) {
      speakQuestion();
    }
  }, [currentIndex, questions]);

  // 言語を自動検出する関数
  const detectLanguage = (text: string): string => {
    // 日本語の文字（ひらがな、カタカナ、漢字）が含まれているか確認
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text) ? "ja-JP" : "en-US";
  };

  // 問題文を読み上げる関数
  const speakQuestion = () => {
    if (!Speech || questions.length === 0) return;

    const currentQuestion = questions[currentIndex];
    const language = detectLanguage(currentQuestion.question_text);

    Speech.speak(currentQuestion.question_text, {
      language,
      pitch: 1.0,
      rate: 0.9,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  };

  // 答えを読み上げる関数
  const speakAnswer = () => {
    if (!Speech || questions.length === 0) return;

    const currentQuestion = questions[currentIndex];
    const language = detectLanguage(currentQuestion.correct_answer);

    Speech.speak(currentQuestion.correct_answer, {
      language,
      pitch: 1.0,
      rate: 0.9,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  };

  // 音声を停止する関数
  const stopSpeaking = () => {
    if (!Speech) return;
    Speech.stop();
    setIsSpeaking(false);
  };

  // スワイプジェスチャーの設定
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 5;
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gestureState) => {
      const swipeThreshold = width * 0.25;

      if (gestureState.dx > swipeThreshold) {
        // 右スワイプ: 前へ
        Animated.spring(pan, {
          toValue: { x: width, y: 0 },
          useNativeDriver: false,
        }).start(() => {
          handlePrevious();
          pan.setValue({ x: 0, y: 0 });
        });
      } else if (gestureState.dx < -swipeThreshold) {
        // 左スワイプ: 次へ
        Animated.spring(pan, {
          toValue: { x: -width, y: 0 },
          useNativeDriver: false,
        }).start(() => {
          handleNext();
          pan.setValue({ x: 0, y: 0 });
        });
      } else {
        // スワイプ距離が足りない場合は元に戻す
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const loadData = async () => {
    try {
      const [setData, questionsData] = await Promise.all([
        questionSetsApi.getById(id),
        questionsApi.getByQuestionSet(id),
      ]);
      setQuestionSet(setData);
      setQuestions(questionsData);
    } catch (error) {
      console.error("Failed to load flashcard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  const handleToggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!questionSet || questions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          {t("No questions available", "問題がありません")}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            {t("Go Back", "戻る")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{questionSet.title}</Text>
        <TouchableOpacity onPress={isSpeaking ? stopSpeaking : speakQuestion}>
          <Text style={styles.speakerButton}>
            {isSpeaking ? "🔇" : "🔊"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressFooter}>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {questions.length}
          </Text>
          <TouchableOpacity
            style={styles.autoPlayToggle}
            onPress={() => setAutoPlay(!autoPlay)}
          >
            <Text style={styles.autoPlayText}>
              {autoPlay ? "🔊 " : "🔇 "}
              {t("Auto-play", "自動再生")}
              {autoPlay ? " ON" : " OFF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ translateX: pan.x }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <ScrollView
          style={styles.cardScrollView}
          contentContainerStyle={styles.cardScrollContent}
          scrollEnabled={!showAnswer}
        >
          <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>
              {t("Question", "問題")} {currentIndex + 1}
            </Text>
            {currentQuestion.difficulty && (
              <View
                style={[
                  styles.difficultyBadge,
                  {
                    backgroundColor:
                      currentQuestion.difficulty <= 3
                        ? "#4CAF50"
                        : currentQuestion.difficulty <= 7
                        ? "#FF9800"
                        : "#F44336",
                  },
                ]}
              >
                <Text style={styles.difficultyText}>
                  {t("Level", "レベル")} {currentQuestion.difficulty}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.questionText}>
            {currentQuestion.question_text}
          </Text>

          {currentQuestion.options && currentQuestion.options.length > 0 && (
            <View style={styles.optionsContainer}>
              <Text style={styles.optionsLabel}>
                {t("Options:", "選択肢:")}
              </Text>
              {currentQuestion.options.map((option, index) => (
                <Text key={index} style={styles.optionText}>
                  {String.fromCharCode(65 + index)}. {option}
                </Text>
              ))}
            </View>
          )}

          {/* Answer Section */}
          {showAnswer ? (
            <View style={styles.answerContainer}>
              <View style={styles.answerHeader}>
                <Text style={styles.answerLabel}>
                  {t("Answer:", "答え:")}
                </Text>
                <TouchableOpacity
                  style={styles.speakAnswerButton}
                  onPress={speakAnswer}
                >
                  <Text style={styles.speakAnswerButtonText}>
                    🔊 {t("Read Answer", "答えを読む")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.answerText}>
                {currentQuestion.correct_answer}
              </Text>

              {currentQuestion.explanation && (
                <>
                  <Text style={styles.explanationLabel}>
                    {t("Explanation:", "解説:")}
                  </Text>
                  <Text style={styles.explanationText}>
                    {currentQuestion.explanation}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.hiddenAnswerContainer}>
              <Text style={styles.hiddenAnswerText}>
                {t("Tap button below to reveal answer", "下のボタンをタップして答えを表示")}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.showAnswerButton}
          onPress={handleToggleAnswer}
        >
          <Text style={styles.showAnswerButtonText}>
            {showAnswer
              ? t("Hide Answer", "答えを隠す")
              : t("Show Answer", "答えを表示")}
          </Text>
        </TouchableOpacity>

        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[
              styles.navButton,
              currentIndex === 0 && styles.navButtonDisabled,
            ]}
            onPress={handlePrevious}
            disabled={currentIndex === 0}
          >
            <Text
              style={[
                styles.navButtonText,
                currentIndex === 0 && styles.navButtonTextDisabled,
              ]}
            >
              ← {t("Previous", "前へ")}
            </Text>
          </TouchableOpacity>

          {currentIndex === questions.length - 1 ? (
            <TouchableOpacity
              style={styles.restartButton}
              onPress={handleRestart}
            >
              <Text style={styles.restartButtonText}>
                {t("Restart", "最初から")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.navButton} onPress={handleNext}>
              <Text style={styles.navButtonText}>
                {t("Next", "次へ")} →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    fontSize: 24,
    color: "#007AFF",
    fontWeight: "bold",
    width: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 30,
  },
  speakerButton: {
    fontSize: 24,
    width: 30,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 14,
    color: "#666",
  },
  autoPlayToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
  },
  autoPlayText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  cardContainer: {
    flex: 1,
  },
  cardScrollView: {
    flex: 1,
  },
  cardScrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    minHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  questionText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 20,
    lineHeight: 28,
  },
  optionsContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  optionsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    lineHeight: 24,
  },
  answerContainer: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1976D2",
  },
  speakAnswerButton: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  speakAnswerButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  answerText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    lineHeight: 26,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
  },
  hiddenAnswerContainer: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFB300",
    borderStyle: "dashed",
  },
  hiddenAnswerText: {
    fontSize: 16,
    color: "#F57C00",
    textAlign: "center",
    fontWeight: "600",
  },
  controls: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  showAnswerButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  showAnswerButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#f5f5f5",
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  navButtonTextDisabled: {
    color: "#ccc",
  },
  restartButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
