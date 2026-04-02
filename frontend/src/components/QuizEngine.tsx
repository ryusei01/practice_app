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
  Modal,
} from "react-native";
import { useLanguage } from "../contexts/LanguageContext";
import { evaluateTextAnswer } from "../utils/aiEvaluator";
import { translateText, translateQuestion } from "../api/translate";

// Platform-specific import for expo-speech (not available on web)
let Speech: any = null;
if (Platform.OS !== "web") {
  Speech = require("expo-speech");
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  correct_answer: string;
  question_type?: "multiple_choice" | "true_false" | "text_input";
  options?: string[];
  explanation?: string;
  category?: string;
  difficulty?: number;
}

export interface QuizAnswer {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  /** ユーザーが「わからない」と明示した場合（SRS などで通常の不正解より厳しく扱う） */
  admitted_unknown?: boolean;
}

export interface QuizEngineProps {
  questions: QuizQuestion[];
  onComplete: (answers: QuizAnswer[], score: number, totalTime: number) => void;
  onQuit?: () => void;
  headerColor?: string;
  showAdvancedFeatures?: boolean; // 音声読み上げ、AI評価など
  initialRedSheetEnabled?: boolean; // 赤シート機能の初期状態
  initialQuestionIndex?: number; // 開始する問題のインデックス
}

export default function QuizEngine({
  questions,
  onComplete,
  onQuit,
  headerColor = "#007AFF",
  showAdvancedFeatures = true,
  initialRedSheetEnabled = false,
  initialQuestionIndex = 0,
}: QuizEngineProps) {
  const { t, language } = useLanguage();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>("");
  const [evaluationConfidence, setEvaluationConfidence] = useState<number>(0);
  const [canOverride, setCanOverride] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [redSheetEnabled, setRedSheetEnabled] = useState(initialRedSheetEnabled);
  const [translatedQuestion, setTranslatedQuestion] = useState<string>("");
  const [translatedAnswer, setTranslatedAnswer] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslatingAnswer, setIsTranslatingAnswer] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showAnswerTranslation, setShowAnswerTranslation] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideType, setOverrideType] = useState<'correct' | 'incorrect'>('correct');
  const [overrideMessage, setOverrideMessage] = useState("");

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // 言語を自動検出する関数
  const detectLanguage = (text: string): string => {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text) ? "ja-JP" : "en-US";
  };

  // 問題文を読み上げる関数
  const speakQuestion = () => {
    if (!Speech || !showAdvancedFeatures || questions.length === 0) return;
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

  // 問題文を翻訳する関数
  const handleTranslateQuestion = async () => {
    if (isTranslating) return;

    const currentQuestion = questions[currentQuestionIndex];
    setIsTranslating(true);

    try {
      // 現在の言語に基づいて翻訳先を決定
      const targetLang = language === "ja" ? "en" : "ja";

      const result = await translateText({
        text: currentQuestion.question_text,
        target_lang: targetLang,
      });

      setTranslatedQuestion(result.translated_text);
      setShowTranslation(true);
    } catch (error) {
      console.error("[QuizEngine] Translation error:", error);
      // エラー時は何もしない（翻訳失敗を静かに処理）
    } finally {
      setIsTranslating(false);
    }
  };

  // 回答・正解を翻訳する関数
  const handleTranslateAnswer = async () => {
    if (isTranslatingAnswer) return;

    const currentQuestion = questions[currentQuestionIndex];
    setIsTranslatingAnswer(true);

    try {
      // 現在の言語に基づいて翻訳先を決定
      const targetLang = language === "ja" ? "en" : "ja";

      const result = await translateQuestion({
        question_text: currentQuestion.question_text,
        correct_answer: currentQuestion.correct_answer,
        explanation: currentQuestion.explanation,
        target_lang: targetLang,
      });

      setTranslatedAnswer(result.correct_answer);
      setShowAnswerTranslation(true);
    } catch (error) {
      console.error("[QuizEngine] Answer translation error:", error);
      // エラー時は何もしない（翻訳失敗を静かに処理）
    } finally {
      setIsTranslatingAnswer(false);
    }
  };

  // 問題が変わったら音声を停止し、翻訳をリセット、自動再生がONなら読み上げ
  useEffect(() => {
    if (Speech && showAdvancedFeatures) {
      Speech.stop();
      setIsSpeaking(false);
    }

    // 翻訳をリセット
    setTranslatedQuestion("");
    setTranslatedAnswer("");
    setShowTranslation(false);
    setShowAnswerTranslation(false);

    if (autoPlay && showAdvancedFeatures && questions.length > 0 && !showResult) {
      const timer = setTimeout(() => {
        speakQuestion();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIndex, questions, showResult]);

  const checkAnswer = (answer: string): boolean => {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswer = currentQuestion.correct_answer.trim().toLowerCase();
    const userAnswerLower = answer.trim().toLowerCase();

    if (currentQuestion.question_type === "multiple_choice") {
      return userAnswerLower === correctAnswer;
    } else if (currentQuestion.question_type === "true_false") {
      return userAnswerLower === correctAnswer;
    } else {
      return userAnswerLower === correctAnswer;
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      Alert.alert(t("Error", "エラー"), t("Please provide an answer", "回答を入力してください"));
      return;
    }

    setIsSubmitting(true);
    const currentQuestion = questions[currentQuestionIndex];
    const answerTimeSec = Math.floor((Date.now() - startTime) / 1000);

    let correct = false;
    let feedback = "";
    let confidence = 0;

    try {
      const questionType =
        currentQuestion.question_type ||
        (currentQuestion.options && currentQuestion.options.length > 0
          ? "multiple_choice"
          : "text_input");

      // text_input問題の場合はAI評価（高度な機能が有効な場合のみ）
      if (questionType === "text_input" && showAdvancedFeatures) {
        console.log('[QuizEngine] Calling AI evaluation with:', {
          correctAnswer: currentQuestion.correct_answer,
          userAnswer: userAnswer,
          language: language,
          questionType: questionType
        });
        const evaluation = evaluateTextAnswer(
          currentQuestion.correct_answer,
          userAnswer,
          language as 'en' | 'ja'
        );
        console.log('[QuizEngine] AI evaluation result:', evaluation);
        correct = evaluation.is_correct;
        feedback = evaluation.feedback;
        confidence = evaluation.confidence;
      } else {
        // multiple_choiceとtrue_falseは完全一致チェック
        correct = checkAnswer(userAnswer);
        feedback = correct ? t("Correct!", "正解！") : t("Incorrect", "不正解");
        confidence = correct ? 1.0 : 0.0;
      }

      const newAnswer: QuizAnswer = {
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

      // text_input問題の場合、常に手動上書きを許可（高度な機能が有効な場合のみ）
      setCanOverride(questionType === "text_input" && showAdvancedFeatures);

      if (correct) {
        setScore(score + 1);
      }
    } catch (error) {
      console.error("Failed to evaluate answer:", error);
      Alert.alert(t("Error", "エラー"), t("Failed to evaluate your answer. Please try again.", "回答の評価に失敗しました。もう一度お試しください。"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDontKnow = () => {
    if (isSubmitting) return;

    const currentQuestion = questions[currentQuestionIndex];
    const answerTimeSec = Math.floor((Date.now() - startTime) / 1000);
    const dontKnowLabel = t("(don't know)", "（わからない）");

    const newAnswer: QuizAnswer = {
      question_id: currentQuestion.id,
      user_answer: dontKnowLabel,
      is_correct: false,
      answer_time_sec: answerTimeSec,
      admitted_unknown: true,
    };
    setAnswers([...answers, newAnswer]);

    setIsCorrect(false);
    setEvaluationFeedback(
      t("Recorded as don't know", "わからないとして記録しました")
    );
    setEvaluationConfidence(0);
    setShowResult(true);
    setTotalAnswered(totalAnswered + 1);
    setCanOverride(false);
  };

  const handleOverrideCorrect = () => {
    setOverrideType('correct');
    setShowOverrideModal(true);
  };

  const handleOverrideIncorrect = () => {
    setOverrideType('incorrect');
    setShowOverrideModal(true);
  };

  const confirmOverride = () => {
    const updatedAnswers = [...answers];
    const last = updatedAnswers[updatedAnswers.length - 1];
    if (!last || last.admitted_unknown) {
      setShowOverrideModal(false);
      return;
    }
    last.is_correct = overrideType === 'correct';
    setAnswers(updatedAnswers);

    if (overrideType === 'correct') {
      setIsCorrect(true);
      setScore(score + 1);
      const message = t("✓ Marked as correct by user", "✓ ユーザーが正解として記録しました");
      setEvaluationFeedback(message);
      setOverrideMessage(message);
    } else {
      setIsCorrect(false);
      if (isCorrect) {
        setScore(score - 1);
      }
      const message = t("✗ Marked as incorrect by user", "✗ ユーザーが不正解として記録しました");
      setEvaluationFeedback(message);
      setOverrideMessage(message);
    }

    setCanOverride(false);
    setShowOverrideModal(false);

    // 3秒後にメッセージを消す
    setTimeout(() => {
      setOverrideMessage("");
    }, 3000);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer("");
      setShowResult(false);
      setCanOverride(false);
      setStartTime(Date.now());
    } else {
      // 全問終了 → 合計時間を計算して完了コールバックを呼び出す
      const totalTime = answersRef.current.reduce((sum, answer) => sum + answer.answer_time_sec, 0);
      onComplete(answersRef.current, score, totalTime);
    }
  };

  const handleSubmitEarly = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmitEarly = () => {
    setShowSubmitModal(false);
    const totalTime = answersRef.current.reduce((sum, answer) => sum + answer.answer_time_sec, 0);
    setShowResultModal(true);
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
          placeholder={t("Enter your answer", "答えを入力してください")}
          value={userAnswer}
          onChangeText={setUserAnswer}
          editable={!showResult}
          multiline
        />
      );
    }
  };

  if (questions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t("No questions available", "問題がありません")}</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <View style={styles.headerTop}>
          <Text style={styles.progressText}>
            {t("Question", "問題")} {currentQuestionIndex + 1} / {questions.length}
          </Text>
          <View style={styles.headerTopRight}>
            {showAdvancedFeatures && Speech && (
              <TouchableOpacity onPress={isSpeaking ? stopSpeaking : speakQuestion}>
                <Text style={styles.speakerIcon}>
                  {isSpeaking ? "🔇" : "🔊"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleTranslateQuestion}
              style={styles.translateToggle}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.translateIcon}>
                  {showTranslation ? "🔤" : "🌐"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.scoreText}>
            {t("Score", "スコア")}: {score}/{totalAnswered}
          </Text>
          {showAdvancedFeatures && Speech && (
            <TouchableOpacity
              style={styles.autoPlayToggle}
              onPress={() => setAutoPlay(!autoPlay)}
            >
              <Text style={styles.autoPlayText}>
                {autoPlay ? "🔊" : "🔇"} {t("Auto", "自動")} {autoPlay ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        {/* 翻訳された問題文 */}
        {showTranslation && translatedQuestion && (
          <View style={styles.translationContainer}>
            <Text style={styles.translationLabel}>
              {language === "ja" ? "🇺🇸 English:" : "🇯🇵 日本語:"}
            </Text>
            <Text style={styles.translationText}>{translatedQuestion}</Text>
          </View>
        )}

        {currentQuestion.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{currentQuestion.category}</Text>
          </View>
        )}

        {currentQuestion.difficulty !== undefined && (
          <View style={styles.difficultyContainer}>
            <Text style={styles.difficultyText}>
              {t("Difficulty", "難易度")}: {(currentQuestion.difficulty * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerLabel}>{t("Your Answer:", "あなたの回答:")}</Text>
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
            {isCorrect ? "✓ " + t("Correct!", "正解！") : "✗ " + t("Incorrect", "不正解")}
          </Text>

          {evaluationFeedback && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>{evaluationFeedback}</Text>
              {evaluationConfidence < 1.0 && evaluationConfidence > 0 && (
                <Text style={styles.confidenceText}>
                  {t("Confidence", "信頼度")}: {(evaluationConfidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>
          )}

          <View style={styles.correctAnswerContainer}>
            <View style={styles.correctAnswerHeader}>
              <Text style={styles.correctAnswerLabel}>
                {t("Correct Answer:", "正解:")}
              </Text>
              <TouchableOpacity
                onPress={handleTranslateAnswer}
                style={styles.translateAnswerButton}
                disabled={isTranslatingAnswer}
              >
                {isTranslatingAnswer ? (
                  <ActivityIndicator color="#007AFF" size="small" />
                ) : (
                  <Text style={styles.translateAnswerIcon}>
                    {showAnswerTranslation ? "🔤" : "🌐"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.correctAnswerValue}>
              {showAnswerTranslation && translatedAnswer
                ? translatedAnswer.split('\n')[0]
                : currentQuestion.correct_answer.split('\n')[0]}
            </Text>
            {showAnswerTranslation && translatedAnswer && (
              <View style={styles.translationContainer}>
                <Text style={styles.translationLabel}>
                  {language === "ja" ? "🇺🇸 English:" : "🇯🇵 日本語:"}
                </Text>
                <Text style={styles.translationText}>{translatedAnswer}</Text>
              </View>
            )}
          </View>

          {/* 正誤を手動で記録するボタン（「わからない」のときは上書き不可） */}
          {!answers[answers.length - 1]?.admitted_unknown && (
            <View style={styles.manualRecordContainer}>
              <Text style={styles.manualRecordTitle}>
                {t("Record result:", "結果を記録:")}
              </Text>
              <View style={styles.manualRecordButtons}>
                <TouchableOpacity
                  style={[
                    styles.manualButton,
                    styles.manualButtonCorrect,
                    isCorrect && styles.manualButtonActive
                  ]}
                  onPress={() => {
                    if (!isCorrect) {
                      handleOverrideCorrect();
                    }
                  }}
                >
                  <Text style={[styles.manualButtonText, isCorrect && styles.manualButtonTextActive]}>
                    ✓ {t("Correct", "正解")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.manualButton,
                    styles.manualButtonIncorrect,
                    !isCorrect && styles.manualButtonActive
                  ]}
                  onPress={() => {
                    if (isCorrect) {
                      handleOverrideIncorrect();
                    }
                  }}
                >
                  <Text style={[styles.manualButtonText, !isCorrect && styles.manualButtonTextActive]}>
                    ✗ {t("Incorrect", "不正解")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {currentQuestion.explanation && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationLabel}>{t("Explanation:", "解説:")}</Text>
              <Text style={styles.explanationText}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!showResult ? (
          <>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmitAnswer}
              disabled={isSubmitting || !userAnswer.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t("Submit Answer", "回答する")}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dontKnowButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleDontKnow}
              disabled={isSubmitting}
            >
              <Text style={styles.dontKnowButtonText}>
                {t("Don't know", "わからない")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextQuestion}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestionIndex < questions.length - 1
                ? t("Next Question", "次の問題")
                : t("Finish Quiz", "クイズを終了")}
            </Text>
          </TouchableOpacity>
        )}

        {totalAnswered > 0 && !showResult && (
          <TouchableOpacity
            style={styles.submitEarlyButton}
            onPress={handleSubmitEarly}
          >
            <Text style={styles.submitEarlyButtonText}>
              📤 {t("Submit Now", "今すぐ送信")} ({totalAnswered}/{questions.length})
            </Text>
          </TouchableOpacity>
        )}

        {onQuit && (
          <TouchableOpacity style={styles.quitButton} onPress={onQuit}>
            <Text style={styles.quitButtonText}>{t("Quit Quiz", "終了")}</Text>
          </TouchableOpacity>
        )}
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
                "You have answered {answered} out of {total} questions. Submit your answers now?",
                "{total}問中{answered}問に回答しました。今すぐ送信しますか？"
              ).replace("{answered}", totalAnswered.toString()).replace("{total}", questions.length.toString())}
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
          const totalTime = answersRef.current.reduce((sum, answer) => sum + answer.answer_time_sec, 0);
          onComplete(answersRef.current, score, totalTime);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("Quiz Results", "クイズ結果")}
            </Text>
            <View style={styles.resultStats}>
              <Text style={styles.resultScore}>
                {t("Score", "得点")}: {score}/{totalAnswered}
              </Text>
              <Text style={styles.resultAccuracy}>
                {t("Accuracy", "正解率")}: {totalAnswered > 0 ? `${((score / totalAnswered) * 100).toFixed(1)}%` : "0%"}
              </Text>
              <Text style={styles.resultAnswered}>
                {t("Answered", "回答数")}: {totalAnswered}/{questions.length}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => {
                setShowResultModal(false);
                const totalTime = answersRef.current.reduce((sum, answer) => sum + answer.answer_time_sec, 0);
                onComplete(answersRef.current, score, totalTime);
              }}
            >
              <Text style={styles.modalButtonTextConfirm}>
                {t("OK", "OK")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Override Confirmation Modal */}
      <Modal
        transparent={true}
        visible={showOverrideModal}
        animationType="fade"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {overrideType === 'correct'
                ? t("Mark as Correct?", "正解として記録しますか？")
                : t("Mark as Incorrect?", "不正解として記録しますか？")}
            </Text>
            <Text style={styles.modalMessage}>
              {overrideType === 'correct'
                ? t("Save this answer as correct.", "この回答を正解として保存します。")
                : t("Save this answer as incorrect.", "この回答を不正解として保存します。")}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowOverrideModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>
                  {t("Cancel", "キャンセル")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, overrideType === 'correct' ? styles.modalButtonConfirm : styles.modalButtonDanger]}
                onPress={confirmOverride}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {overrideType === 'correct'
                    ? t("Mark Correct", "正解として記録")
                    : t("Mark Incorrect", "不正解として記録")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Override Message */}
      {overrideMessage && (
        <View style={styles.overrideMessageContainer}>
          <Text style={styles.overrideMessageText}>{overrideMessage}</Text>
        </View>
      )}
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
  headerTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  speakerIcon: {
    fontSize: 24,
    color: "#fff",
  },
  translateToggle: {
    padding: 4,
  },
  translateIcon: {
    fontSize: 24,
  },
  redSheetToggle: {
    padding: 4,
  },
  redSheetIcon: {
    fontSize: 24,
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
  translationContainer: {
    backgroundColor: "#F0F8FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4A90E2",
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A90E2",
    marginBottom: 4,
  },
  translationText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
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
  correctAnswerContainer: {
    marginBottom: 12,
  },
  correctAnswerLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    fontWeight: "600",
  },
  correctAnswerValue: {
    fontSize: 18,
    color: "#333",
    fontWeight: "700",
    padding: 8,
  },
  redSheetCover: {
    backgroundColor: "#FF4444",
    borderRadius: 4,
    overflow: "hidden",
  },
  redSheetText: {
    color: "#FF4444",
    userSelect: "none",
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
    marginBottom: 12,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dontKnowButton: {
    backgroundColor: "#8E8E93",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  dontKnowButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  nextButtonText: {
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
  quitButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  quitButtonText: {
    color: "#666",
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
  manualRecordContainer: {
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  manualRecordTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  manualRecordButtons: {
    flexDirection: "row",
    gap: 12,
  },
  manualButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
  },
  manualButtonCorrect: {
    backgroundColor: "#fff",
    borderColor: "#4CAF50",
  },
  manualButtonIncorrect: {
    backgroundColor: "#fff",
    borderColor: "#F44336",
  },
  manualButtonActive: {
    borderWidth: 3,
    opacity: 1,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  manualButtonTextActive: {
    color: "#333",
    fontWeight: "700",
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
  modalButtonDanger: {
    backgroundColor: "#F44336",
  },
  overrideMessageContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  overrideMessageText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
