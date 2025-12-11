import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../../src/contexts/AuthContext";
import { questionsApi, Question } from "../../../src/api/questions";
import { answersApi } from "../../../src/api/answers";
import QuizEngine, { QuizQuestion, QuizAnswer } from "../../../src/components/QuizEngine";

export default function QuizScreen() {
  const { id, questionIds } = useLocalSearchParams<{ id: string; questionIds?: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId] = useState<string>(
    `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  useEffect(() => {
    if (id && user) {
      loadQuestions();
    }
  }, [id, user, questionIds]);

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

      // questionIdsパラメータがある場合、指定された問題のみをフィルタ
      if (questionIds) {
        const selectedIds = questionIds.split(',');
        const filteredQuestions = data.filter(q => selectedIds.includes(q.id));

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
      Alert.alert("Error", "Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[], score: number, totalTime: number) => {
    if (!user) return;

    try {
      // 結果データを準備（問題テキストと正解を含める）
      const answersWithDetails = answers.map((answer) => {
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

      // 結果画面に遷移
      router.replace({
        pathname: '/(app)/quiz/result',
        params: {
          score: score.toString(),
          total: answers.length.toString(),
          totalTime: totalTime.toString(),
          answers: JSON.stringify(answersWithDetails),
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
  }));

  return (
    <QuizEngine
      questions={quizQuestions}
      onComplete={handleQuizComplete}
      onQuit={() => router.back()}
      headerColor="#007AFF"
      showAdvancedFeatures={true}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
});
