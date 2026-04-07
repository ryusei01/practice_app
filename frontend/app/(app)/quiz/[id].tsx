import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import { questionsApi, Question } from "../../../src/api/questions";
import { answersApi } from "../../../src/api/answers";
import QuizEngine, { QuizQuestion, QuizAnswer } from "../../../src/components/QuizEngine";
import { srsService } from "../../../src/services/srsService";
import { getApiErrorMessage } from "../../../src/utils/apiError";

export default function QuizScreen() {
  const { id, questionIds, startIndex, mode } = useLocalSearchParams<{
    id: string;
    questionIds?: string;
    startIndex?: string;
    mode?: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionId] = useState<string>(
    `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  const isAllMode = mode === "all";

  useEffect(() => {
    if (id && user) {
      loadQuestions();
    }
  }, [id, user, questionIds]);

  const loadQuestions = async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const data = await questionsApi.getAll(
        { question_set_id: id as string },
        { skipGlobalErrorModal: true }
      );
      console.log("[loadQuestions] Loaded questions:", data);
      console.log("[loadQuestions] First question details:", data[0]);

      if (data.length === 0) {
        Alert.alert("No Questions", "This question set has no questions yet.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      // questionIdsパラメータがある場合、指定された問題のみをフィルタ（順序を保持）
      if (questionIds) {
        const selectedIds = questionIds.split(',');
        const questionMap = new Map(data.map(q => [q.id, q]));
        const filteredQuestions = selectedIds
          .map(qid => questionMap.get(qid))
          .filter((q): q is Question => q !== undefined);

        if (filteredQuestions.length === 0) {
          Alert.alert("No Questions", "Selected questions not found.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }

        setQuestions(filteredQuestions);
      } else {
        setQuestions(data);
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
      setLoadError(
        getApiErrorMessage(
          error,
          "Failed to load questions",
          "問題の読み込みに失敗しました"
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleProgressChange = async (currentIndex: number) => {
    if (!isAllMode) return;
    try {
      await AsyncStorage.setItem(
        `@quiz_progress_${id}`,
        JSON.stringify({
          currentIndex,
          totalQuestions: questions.length,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn("Failed to save quiz progress:", e);
    }
  };

  const clearProgress = async () => {
    try {
      await AsyncStorage.removeItem(`@quiz_progress_${id}`);
    } catch (e) {
      console.warn("Failed to clear quiz progress:", e);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[], score: number, totalTime: number) => {
    if (!user) return;

    if (isAllMode) await clearProgress();

    try {
      // 結果データを準備（問題テキストと正解を含める）
      const answersWithDetails = answers.map((answer) => {
        const question = questions.find(q => q.id === answer.question_id);
        return {
          ...answer,
          question_text: question?.question_text || '',
          correct_answer: question?.correct_answer || '',
          question_type: question?.question_type || '',
          options: question?.options || undefined,
          explanation: question?.explanation || undefined,
          category: question?.category,
        };
      });

      if (user.is_premium) {
        // 課金ユーザー: クラウドに保存
        for (const answer of answers) {
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

        const newAnswers = answers.map((answer) => ({
          ...answer,
          session_id: sessionId,
          answered_at: new Date().toISOString(),
        }));

        await AsyncStorage.setItem(
          `answers_${user.id}`,
          JSON.stringify([...parsedAnswers, ...newAnswers])
        );
      }

      // SRS状態を更新（通常版もローカルで共通管理）
      for (const ans of answers) {
        await srsService.updateAfterAnswer(
          id as string,
          ans.question_id,
          ans.is_correct,
          ans.answer_time_sec,
          ans.admitted_unknown ? { admittedUnknown: true } : undefined
        );
      }

      // 結果画面に遷移
      router.replace({
        pathname: '/(app)/quiz/result',
        params: {
          score: score.toString(),
          total: answers.length.toString(),
          totalTime: totalTime.toString(),
          answers: JSON.stringify(answersWithDetails),
          questionSetId: id as string,
        },
      });
    } catch (error: any) {
      console.error("Failed to save answers:", error);
      Alert.alert("Error", "Failed to save answers. Please try again.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadQuestions()}
        >
          <Text style={styles.retryButtonText}>{t("Retry", "再試行")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{t("Go Back", "戻る")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // QuestionをQuizQuestionに変換
  const quizQuestions: QuizQuestion[] = questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    correct_answer: q.correct_answer,
    question_type: q.question_type as "multiple_choice" | "true_false" | "text_input" | undefined,
    options: q.options,
    explanation: q.explanation,
    category: q.category,
    difficulty: q.difficulty,
    media_urls: q.media_urls as any,
  }));

  return (
    <QuizEngine
      questions={quizQuestions}
      onComplete={handleQuizComplete}
      onQuit={() => router.back()}
      headerColor="#007AFF"
      showAdvancedFeatures={true}
      initialQuestionIndex={parseInt(startIndex || "0")}
      onProgressChange={isAllMode ? handleProgressChange : undefined}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginBottom: 16,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backLink: {
    color: "#007AFF",
    fontSize: 16,
  },
});
