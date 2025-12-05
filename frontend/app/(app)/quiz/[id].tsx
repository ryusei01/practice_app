import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import { questionsApi, Question } from "../../../src/api/questions";
import { answersApi } from "../../../src/api/answers";
import { evaluateTextAnswer } from "../../../src/utils/aiEvaluator";

// Platform-specific import for expo-speech (not available on web)
let Speech: any = null;
if (Platform.OS !== "web") {
  Speech = require("expo-speech");
}

type QuestionType = "multiple_choice" | "true_false" | "text_input";

export default function QuizScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionId] = useState<string>(
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>("");
  const [evaluationConfidence, setEvaluationConfidence] = useState<number>(0);
  const [canOverride, setCanOverride] = useState(false); // 手動上書き可能か
  const [autoPlay, setAutoPlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // 全ての回答を保持する配列
  const [answers, setAnswers] = useState<
    Array<{
      question_id: string;
      user_answer: string;
      is_correct: boolean;
      answer_time_sec: number;
    }>
  >([]);

  // 言語を自動検出する関数
  const detectLanguage = (text: string): string => {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text) ? "ja-JP" : "en-US";
  };

  // 問題文を読み上げる関数
  const speakQuestion = () => {
    if (!Speech || questions.length === 0) return;
    const currentQuestion = questions[currentQuestionIndex];
    const questionLanguage = detectLanguage(currentQuestion.question_text);

    Speech.speak(currentQuestion.question_text, {
      language: questionLanguage,
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

  // useRefで最新のanswers配列を常に保持
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (id && user) {
      loadQuestions();
    }
  }, [id, user]);

  // 問題が変わったら音声を停止し、自動再生がONなら読み上げ
  useEffect(() => {
    if (Speech) {
      Speech.stop();
      setIsSpeaking(false);
    }

    if (autoPlay && questions.length > 0 && !showResult) {
      // 少し遅延させて読み上げ
      const timer = setTimeout(() => {
        speakQuestion();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIndex, questions, showResult]);

  const loadQuestions = async () => {
    try {
      const data = await questionsApi.getAll({ question_set_id: id as string });
      console.log("[loadQuestions] Loaded questions:", data);
      console.log("[loadQuestions] First question details:", data[0]);
      if (data.length === 0) {
        Alert.alert("No Questions", "This question set has no questions yet.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }
      setQuestions(data);
      setStartTime(Date.now());
    } catch (error) {
      console.error("Failed to load questions:", error);
      Alert.alert("Error", "Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAnswer = (answer: string): boolean => {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswer = currentQuestion.correct_answer.trim().toLowerCase();
    const userAnswerLower = answer.trim().toLowerCase();

    if (currentQuestion.question_type === "multiple_choice") {
      return userAnswerLower === correctAnswer;
    } else if (currentQuestion.question_type === "true_false") {
      return userAnswerLower === correctAnswer;
    } else {
      // For text input, check if answers match (case-insensitive)
      return userAnswerLower === correctAnswer;
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      Alert.alert("Error", "Please provide an answer");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to submit answers");
      return;
    }

    setIsSubmitting(true);
    const currentQuestion = questions[currentQuestionIndex];
    const answerTimeSec = Math.floor((Date.now() - startTime) / 1000);

    let correct = false;
    let feedback = "";
    let confidence = 0;
    console.log("trybefore", currentQuestion);

    try {
      console.log("try", currentQuestion.question_type, "answer:", userAnswer);

      // question_typeが空の場合はoptionsの有無で判定
      const questionType =
        currentQuestion.question_type ||
        (currentQuestion.options && currentQuestion.options.length > 0
          ? "multiple_choice"
          : "text_input");
      console.log(
        "[handleSubmitAnswer] Determined question type:",
        questionType
      );

      // text_input問題の場合はクライアントサイドAI評価を使用
      if (questionType === "text_input") {
        console.log("evaluateTextAnswer called");

        const evaluation = evaluateTextAnswer(
          currentQuestion.correct_answer,
          userAnswer,
          language
        );
        correct = evaluation.is_correct;
        feedback = evaluation.feedback;
        confidence = evaluation.confidence;
      } else {
        // multiple_choiceとtrue_falseは従来通り完全一致チェック
        correct = checkAnswer(userAnswer);
        feedback = correct ? t("Correct!", "正解！") : t("Incorrect", "不正解");
        confidence = correct ? 1.0 : 0.0;
      }

      // 回答を配列に保存（API送信はしない）
      const newAnswer = {
        question_id: currentQuestion.id,
        user_answer: userAnswer,
        is_correct: correct,
        answer_time_sec: answerTimeSec,
      };
      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);

      setIsCorrect(correct);
      setEvaluationFeedback(feedback);
      setEvaluationConfidence(confidence);
      setShowResult(true);
      setTotalAnswered(totalAnswered + 1);

      // text_input問題の場合、常に手動上書きを許可
      setCanOverride(questionType === "text_input");

      if (correct) {
        setScore(score + 1);
      }
    } catch (error) {
      console.error("Failed to evaluate answer:", error);
      Alert.alert("Error", "Failed to evaluate your answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverrideCorrect = () => {
    Alert.alert(
      t("Mark as Correct?", "正解として記録しますか？"),
      t("Save this answer as correct.", "この回答を正解として保存します。"),
      [
        { text: t("Cancel", "キャンセル"), style: "cancel" },
        {
          text: t("Mark Correct", "正解として記録"),
          onPress: () => {
            // 最後の回答を正解に上書き
            const updatedAnswers = [...answers];
            updatedAnswers[updatedAnswers.length - 1].is_correct = true;
            setAnswers(updatedAnswers);

            // UIを正解状態に更新
            setIsCorrect(true);
            setScore(score + 1);
            setEvaluationFeedback(
              t(
                "✓ Marked as correct by user",
                "✓ ユーザーが正解として記録しました"
              )
            );
            setCanOverride(false);
          },
        },
      ]
    );
  };

  const handleOverrideIncorrect = () => {
    Alert.alert(
      t("Mark as Incorrect?", "不正解として記録しますか？"),
      t("Save this answer as incorrect.", "この回答を不正解として保存します。"),
      [
        { text: t("Cancel", "キャンセル"), style: "cancel" },
        {
          text: t("Mark Incorrect", "不正解として記録"),
          style: "destructive",
          onPress: () => {
            // 最後の回答を不正解に上書き
            const updatedAnswers = [...answers];
            updatedAnswers[updatedAnswers.length - 1].is_correct = false;
            setAnswers(updatedAnswers);

            // UIを不正解状態に更新
            setIsCorrect(false);
            setScore(score - 1);
            setEvaluationFeedback(
              t(
                "✗ Marked as incorrect by user",
                "✗ ユーザーが不正解として記録しました"
              )
            );
            setCanOverride(false);
          },
        },
      ]
    );
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer("");
      setShowResult(false);
      setCanOverride(false);
      setStartTime(Date.now());
    } else {
      // 全問終了 → 回答を一括送信
      // useRefから最新のanswers配列を取得
      submitAllAnswers(answersRef.current);
    }
  };

  const submitAllAnswers = async (allAnswers: typeof answers) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // 合計回答時間を計算
      const totalTime = allAnswers.reduce((sum, answer) => sum + answer.answer_time_sec, 0);

      // 結果データを準備（問題テキストと正解を含める）
      const answersWithDetails = allAnswers.map((answer) => {
        const question = questions.find(q => q.id === answer.question_id);
        return {
          ...answer,
          question_text: question?.question_text || '',
          correct_answer: question?.correct_answer || '',
          category: question?.category,
        };
      });

      if (user.is_premium) {
        // 課金ユーザー: クラウドに保存
        for (const answer of allAnswers) {
          await answersApi.submitAnswer({
            user_id: user.id,
            question_id: answer.question_id,
            user_answer: answer.user_answer,
            is_correct: answer.is_correct,
            answer_time_sec: answer.answer_time_sec,
            session_id: sessionId,
          });
        }
      } else {
        // 無料ユーザー: ローカルに保存
        const localAnswers =
          (await AsyncStorage.getItem(`answers_${user.id}`)) || "[]";
        const parsedAnswers = JSON.parse(localAnswers);

        const newAnswers = allAnswers.map((answer) => ({
          ...answer,
          session_id: sessionId,
          answered_at: new Date().toISOString(),
        }));

        await AsyncStorage.setItem(
          `answers_${user.id}`,
          JSON.stringify([...parsedAnswers, ...newAnswers])
        );
      }

      // 結果画面に遷移
      router.replace({
        pathname: '/(app)/quiz/result',
        params: {
          score: score.toString(),
          total: totalAnswered.toString(),
          totalTime: totalTime.toString(),
          answers: JSON.stringify(answersWithDetails),
        },
      });
    } catch (error: any) {
      console.error("Failed to save answers:", error);
      Alert.alert("Error", "Failed to save answers. Please try again.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAnswerInput = () => {
    const currentQuestion = questions[currentQuestionIndex];

    if (
      currentQuestion.question_type === "multiple_choice" &&
      currentQuestion.options
    ) {
      return (
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                userAnswer === option && styles.optionButtonSelected,
              ]}
              onPress={() => setUserAnswer(option)}
              disabled={showResult}
            >
              <Text
                style={[
                  styles.optionText,
                  userAnswer === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    } else if (currentQuestion.question_type === "true_false") {
      return (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              userAnswer === "true" && styles.optionButtonSelected,
            ]}
            onPress={() => setUserAnswer("true")}
            disabled={showResult}
          >
            <Text
              style={[
                styles.optionText,
                userAnswer === "true" && styles.optionTextSelected,
              ]}
            >
              True
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButton,
              userAnswer === "false" && styles.optionButtonSelected,
            ]}
            onPress={() => setUserAnswer("false")}
            disabled={showResult}
          >
            <Text
              style={[
                styles.optionText,
                userAnswer === "false" && styles.optionTextSelected,
              ]}
            >
              False
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <TextInput
          style={styles.textInput}
          placeholder="Enter your answer"
          value={userAnswer}
          onChangeText={setUserAnswer}
          editable={!showResult}
          multiline
        />
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No questions available</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
          <TouchableOpacity onPress={isSpeaking ? stopSpeaking : speakQuestion}>
            <Text style={styles.speakerIcon}>
              {isSpeaking ? "🔇" : "🔊"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.scoreText}>
            Score: {score}/{totalAnswered}
          </Text>
          <TouchableOpacity
            style={styles.autoPlayToggle}
            onPress={() => setAutoPlay(!autoPlay)}
          >
            <Text style={styles.autoPlayText}>
              {autoPlay ? "🔊" : "🔇"} {t("Auto", "自動")} {autoPlay ? "ON" : "OFF"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        {currentQuestion.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{currentQuestion.category}</Text>
          </View>
        )}

        <View style={styles.difficultyContainer}>
          <Text style={styles.difficultyText}>
            Difficulty: {(currentQuestion.difficulty * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerLabel}>Your Answer:</Text>
        {renderAnswerInput()}
      </View>

      {showResult && (
        <View
          style={[
            styles.resultCard,
            isCorrect ? styles.resultCorrect : styles.resultIncorrect,
          ]}
        >
          <Text style={styles.resultTitle}>
            {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
          </Text>

          {/* AI評価フィードバック */}
          {evaluationFeedback && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>{evaluationFeedback}</Text>
              {evaluationConfidence < 1.0 && evaluationConfidence > 0 && (
                <Text style={styles.confidenceText}>
                  信頼度: {(evaluationConfidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>
          )}

          <Text style={styles.correctAnswerText}>
            Correct Answer: {currentQuestion.correct_answer}
          </Text>

          {/* 手動上書きボタン */}
          {canOverride && !isCorrect && (
            <TouchableOpacity
              style={styles.overrideButton}
              onPress={handleOverrideCorrect}
            >
              <Text style={styles.overrideButtonText}>
                💡 {t("Actually Correct", "実は正解だった")}
              </Text>
            </TouchableOpacity>
          )}

          {canOverride && isCorrect && (
            <TouchableOpacity
              style={styles.overrideButtonIncorrect}
              onPress={handleOverrideIncorrect}
            >
              <Text style={styles.overrideButtonText}>
                ⚠️ {t("Actually Incorrect", "実は不正解だった")}
              </Text>
            </TouchableOpacity>
          )}

          {currentQuestion.explanation && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationLabel}>Explanation:</Text>
              <Text style={styles.explanationText}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!showResult ? (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmitAnswer}
            disabled={isSubmitting || !userAnswer.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextQuestion}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestionIndex < questions.length - 1
                ? "Next Question"
                : "Finish Quiz"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
  },
  header: {
    backgroundColor: "#007AFF",
    padding: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  speakerIcon: {
    fontSize: 24,
    color: "#fff",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  autoPlayToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  autoPlayText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  questionCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    lineHeight: 26,
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  categoryText: {
    color: "#1976D2",
    fontSize: 12,
    fontWeight: "600",
  },
  difficultyContainer: {
    marginTop: 8,
  },
  difficultyText: {
    fontSize: 14,
    color: "#666",
  },
  answerSection: {
    margin: 16,
    marginTop: 0,
  },
  answerLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  optionButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  resultCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultCorrect: {
    backgroundColor: "#E8F5E9",
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  resultIncorrect: {
    backgroundColor: "#FFEBEE",
    borderWidth: 2,
    borderColor: "#F44336",
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  feedbackContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
  },
  feedbackText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
    lineHeight: 22,
  },
  confidenceText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
  correctAnswerText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 12,
    fontWeight: "600",
  },
  explanationContainer: {
    marginTop: 8,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 16,
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
  overrideButton: {
    backgroundColor: "#FF9800",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F57C00",
  },
  overrideButtonIncorrect: {
    backgroundColor: "#F44336",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D32F2F",
  },
  overrideButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
