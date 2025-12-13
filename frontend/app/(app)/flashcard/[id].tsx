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
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { questionSetsApi, QuestionSet } from "../../../src/api/questionSets";
import { questionsApi, Question } from "../../../src/api/questions";
import { answersApi } from "../../../src/api/answers";
import { useAuth } from "../../../src/contexts/AuthContext";
import { localStorageService, LocalQuestionSet } from "../../../src/services/localStorageService";

// expo-speechはモバイルのみ対応なので条件付きインポート
let Speech: any = null;
if (Platform.OS !== "web") {
  Speech = require("expo-speech");
}

const { width } = Dimensions.get("window");

// お試し版と通常版の問題データの共通型
interface UnifiedQuestion {
  id: string;
  question_text: string;
  correct_answer: string;
  options?: string[];
  explanation?: string;
  difficulty?: number | string;
}

export default function FlashcardScreen() {
  const { id, startIndex } = useLocalSearchParams<{ id: string; startIndex?: string }>();
  const { t } = useLanguage();
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<QuestionSet | LocalQuestionSet | null>(null);
  const [questions, setQuestions] = useState<UnifiedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(parseInt(startIndex || "0"));
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pan] = useState(new Animated.ValueXY());
  const [autoPlay, setAutoPlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [redSheetEnabled, setRedSheetEnabled] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [answers, setAnswers] = useState<Array<{
    question_id: string;
    is_correct: boolean;
    answer_time_sec: number;
  }>>([]);
  const { user } = useAuth();
  const [isTrial, setIsTrial] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

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
      console.log('[Flashcard] Loading data for question_set_id:', id);

      // お試し版かどうかを判定（IDがtrial_またはdefault_で始まる）
      const isTrialMode = id.startsWith('trial_') || id.startsWith('default_');
      setIsTrial(isTrialMode);

      if (isTrialMode) {
        // お試し版：ローカルストレージから読み込み
        console.log('[Flashcard] Loading from local storage (trial mode)');
        const localSet = await localStorageService.getTrialQuestionSet(id);

        if (!localSet) {
          console.warn('[Flashcard] Trial question set not found');
          setIsLoading(false);
          return;
        }

        console.log('[Flashcard] Loaded trial question set:', localSet.title);
        console.log('[Flashcard] Loaded questions:', localSet.questions.length, 'questions');

        setQuestionSet(localSet);

        // ローカル問題を共通型に変換
        const unifiedQuestions: UnifiedQuestion[] = localSet.questions.map(q => ({
          id: q.id,
          question_text: q.question,
          correct_answer: q.answer,
          difficulty: q.difficulty,
        }));

        setQuestions(unifiedQuestions);

        if (unifiedQuestions.length > 0) {
          setStartTime(new Date());
        }
      } else {
        // 通常版：APIから読み込み
        console.log('[Flashcard] Loading from API (normal mode)');
        const [setData, questionsData] = await Promise.all([
          questionSetsApi.getById(id),
          questionsApi.getAll({ question_set_id: id }),
        ]);

        console.log('[Flashcard] Loaded question set:', setData);
        console.log('[Flashcard] Loaded questions:', questionsData?.length || 0, 'questions');

        if (!questionsData || questionsData.length === 0) {
          console.warn('[Flashcard] No questions returned from API');
        }

        setQuestionSet(setData);
        setQuestions(questionsData || []);

        if (questionsData && questionsData.length > 0) {
          setStartTime(new Date());
        }
      }
    } catch (error) {
      console.error("Failed to load flashcard data:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setStartTime(new Date());
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setStartTime(new Date());
    }
  };

  const handleToggleAnswer = () => {
    if (!showAnswer && !startTime) {
      setStartTime(new Date());
    }
    setShowAnswer(!showAnswer);
  };

  const submitAllAnswers = async (finalAnswers: typeof answers) => {
    try {
      // ローカルストレージに保存（既存データに追記）
      const storageKey = `@flashcard_answers_${id}`;

      // 既存データを読み込み
      const existingData = await AsyncStorage.getItem(storageKey);
      const existingAnswers = existingData ? JSON.parse(existingData) : [];

      // 新しい回答データを作成
      const newAnswerDataArray = finalAnswers.map((ans) => ({
        question_id: ans.question_id,
        question_set_id: id,
        is_correct: ans.is_correct,
        answer_time_sec: ans.answer_time_sec,
        answered_at: new Date().toISOString(),
      }));

      // 既存データと新しいデータを結合
      const combinedAnswers = [...existingAnswers, ...newAnswerDataArray];
      await AsyncStorage.setItem(storageKey, JSON.stringify(combinedAnswers));

      // 古い回答履歴をクリーンアップ（最新1000件のみ保持）
      await localStorageService.cleanupOldAnswers(id, 1000);

      // 通常版でユーザーがログインしている場合はAPIにも送信
      if (!isTrial && user) {
        for (const ans of finalAnswers) {
          const question = questions.find(q => q.id === ans.question_id);
          if (question) {
            await answersApi.submitAnswer({
              user_id: user.id,
              question_id: ans.question_id,
              user_answer: question.correct_answer,
              is_correct: ans.is_correct,
              answer_time_sec: ans.answer_time_sec,
            });
          }
        }
      }

      console.log(`All answers submitted: ${finalAnswers.length} answers (trial: ${isTrial})`);
    } catch (error) {
      console.error("Failed to submit answers:", error);
    }
  };

  const handleRecordAnswer = (isCorrect: boolean) => {
    if (!startTime) return;

    const answerTimeSec = (new Date().getTime() - startTime.getTime()) / 1000;
    const currentQuestion = questions[currentIndex];

    // answersに追加（最後にまとめて送信）
    setAnswers([
      ...answers,
      {
        question_id: currentQuestion.id,
        is_correct: isCorrect,
        answer_time_sec: answerTimeSec,
      },
    ]);

    console.log(`Answer recorded: ${isCorrect ? 'Correct' : 'Incorrect'}, Time: ${answerTimeSec}s`);

    // 次の問題へ
    if (currentIndex < questions.length - 1) {
      handleNext();
    } else {
      // 最後の問題なら結果を送信
      submitAllAnswers([
        ...answers,
        {
          question_id: currentQuestion.id,
          is_correct: isCorrect,
          answer_time_sec: answerTimeSec,
        },
      ]);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const handleSubmitEarly = () => {
    if (answers.length === 0) {
      return;
    }
    setShowSubmitModal(true);
  };

  const confirmSubmitEarly = async () => {
    setShowSubmitModal(false);
    await submitAllAnswers(answers);
    setShowResultModal(true);
  };

  const calculateStats = () => {
    const correctCount = answers.filter(a => a.is_correct).length;
    const totalAnswered = answers.length;
    const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;
    return { correctCount, totalAnswered, accuracy };
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
        <Text style={styles.debugText}>
          {t("Question Set ID", "問題セットID")}: {id}
        </Text>
        <Text style={styles.debugText}>
          {t("Question Set", "問題セット")}: {questionSet ? t("Loaded", "読み込み済み") : t("Not loaded", "未読み込み")}
        </Text>
        <Text style={styles.debugText}>
          {t("Questions", "問題")}: {questions.length} {t("items", "件")}
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
              {autoPlay ? ` ${t("ON", "ON")}` : ` ${t("OFF", "OFF")}`}
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
              {redSheetEnabled && !revealedCards.has(currentIndex) ? (
                <TouchableOpacity
                  style={styles.redSheetCover}
                  onPress={() => {
                    const newRevealed = new Set(revealedCards);
                    newRevealed.add(currentIndex);
                    setRevealedCards(newRevealed);
                  }}
                >
                  <Text style={styles.redSheetText}>
                    {t("Tap to reveal", "タップして表示")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.answerText}>
                  {currentQuestion.correct_answer}
                </Text>
              )}

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

              {/* Correct/Incorrect buttons - always show when answer is revealed */}
              {(!redSheetEnabled || revealedCards.has(currentIndex)) && (
                <View style={styles.resultButtons}>
                  <TouchableOpacity
                    style={[styles.resultButton, styles.correctButton]}
                    onPress={() => handleRecordAnswer(true)}
                  >
                    <Text style={styles.resultButtonText}>
                      ✓ {t("Correct", "正解")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.resultButton, styles.incorrectButton]}
                    onPress={() => handleRecordAnswer(false)}
                  >
                    <Text style={styles.resultButtonText}>
                      ✗ {t("Incorrect", "不正解")}
                    </Text>
                  </TouchableOpacity>
                </View>
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
        {answers.length > 0 && (
          <TouchableOpacity
            style={styles.submitEarlyButton}
            onPress={handleSubmitEarly}
          >
            <Text style={styles.submitEarlyButtonText}>
              📤 {t("Submit Now", "今すぐ送信")} ({answers.length}/{questions.length})
            </Text>
          </TouchableOpacity>
        )}

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

      {/* Submit Confirmation Modal */}
      <Modal
        transparent={true}
        visible={showSubmitModal}
        animationType="fade"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("Submit Early?", "途中で送信しますか？")}
            </Text>
            <Text style={styles.modalMessage}>
              {t(
                `Submit ${answers.length} answers now? You have ${questions.length - answers.length} questions remaining.`,
                `${answers.length}件の回答を送信しますか？残り${questions.length - answers.length}問あります。`
              )}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>
                  {t("Cancel", "キャンセル")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmSubmitEarly}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {t("Submit", "送信")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal
        transparent={true}
        visible={showResultModal}
        animationType="fade"
        onRequestClose={() => {
          setShowResultModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("Flashcard Results", "フラッシュカード結果")}
            </Text>
            <View style={styles.resultStats}>
              <Text style={styles.resultScore}>
                {t("Correct", "正解")}: {calculateStats().correctCount}/{calculateStats().totalAnswered}
              </Text>
              <Text style={styles.resultAccuracy}>
                {t("Accuracy", "正解率")}: {calculateStats().accuracy.toFixed(1)}%
              </Text>
              <Text style={styles.resultAnswered}>
                {t("Answered", "回答数")}: {calculateStats().totalAnswered}/{questions.length}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => {
                setShowResultModal(false);
                router.back();
              }}
            >
              <Text style={styles.modalButtonTextConfirm}>
                {t("OK", "OK")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 120,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
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
  debugText: {
    fontSize: 14,
    color: "#999",
    marginBottom: 8,
    fontFamily: "monospace",
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
  redSheetCover: {
    backgroundColor: "#FF4444",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    marginVertical: 12,
  },
  redSheetText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  resultButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  correctButton: {
    backgroundColor: "#4CAF50",
  },
  incorrectButton: {
    backgroundColor: "#F44336",
  },
  resultButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  submitEarlyButton: {
    backgroundColor: "#FF9800",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#F57C00",
  },
  submitEarlyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonTextCancel: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextConfirm: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultStats: {
    marginBottom: 24,
    gap: 12,
  },
  resultScore: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
    textAlign: "center",
  },
  resultAccuracy: {
    fontSize: 18,
    fontWeight: "600",
    color: "#34C759",
    textAlign: "center",
  },
  resultAnswered: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});
