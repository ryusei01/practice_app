import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import { localStorageService, LocalQuestionSet } from "../../../src/services/localStorageService";
import Header from "../../../src/components/Header";
import QuizEngine, { QuizQuestion, QuizAnswer } from "../../../src/components/QuizEngine";

export default function TrialQuizScreen() {
  const { id } = useLocalSearchParams();
  const [questionSet, setQuestionSet] = useState<LocalQuestionSet | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const router = useRouter();

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
      console.error("Error loading trial question set:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to load question set", "問題セットの読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[], score: number, totalTime: number) => {
    if (!questionSet) return;

    // 結果を保存
    try {
      await localStorageService.saveTrialResult(questionSet.id, {
        score: score,
        totalQuestions: questionSet.questions.length,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving trial result:", error);
    }

    // 結果画面を表示
    setFinalScore(score);
    setFinalTotal(questionSet.questions.length);
    setShowResult(true);
  };

  const handleRestart = () => {
    setShowResult(false);
    setFinalScore(0);
    setFinalTotal(0);
    // 問題セットをリロードして QuizEngine をリセット
    loadQuestionSet();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!questionSet) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {t("Question set not found", "問題セットが見つかりません")}
        </Text>
      </View>
    );
  }

  if (showResult) {
    const percentage = Math.round((finalScore / finalTotal) * 100);

    return (
      <View style={styles.container}>
        <Header />
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <Text style={styles.resultTitle}>{t("Quiz Complete!", "クイズ完了！")}</Text>
          <Text style={styles.resultScore}>
            {finalScore} / {finalTotal}
          </Text>
          <Text style={styles.resultPercentage}>{percentage}%</Text>

          <TouchableOpacity style={styles.button} onPress={handleRestart}>
            <Text style={styles.buttonText}>{t("Try Again", "もう一度")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, styles.buttonOutlineText]}>
              {t("Back to List", "一覧に戻る")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // LocalQuestionをQuizQuestionに変換
  const quizQuestions: QuizQuestion[] = questionSet.questions.map((q, index) => ({
    id: `${questionSet.id}_q${index}`,
    question_text: q.question,
    correct_answer: q.answer,
    question_type: "text_input",
  }));

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.trialBadge}>
        <Text style={styles.trialBadgeText}>
          {t("Trial Mode", "お試しモード")}
        </Text>
      </View>
      <QuizEngine
        questions={quizQuestions}
        onComplete={handleQuizComplete}
        onQuit={() => router.back()}
        headerColor="#34C759"
        showAdvancedFeatures={true}
        initialRedSheetEnabled={questionSet.redSheetEnabled || false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  trialBadge: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    margin: 16,
    marginBottom: 0,
  },
  trialBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  resultScore: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
  },
  resultPercentage: {
    fontSize: 36,
    fontWeight: "600",
    color: "#34C759",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  buttonOutlineText: {
    color: "#007AFF",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
});
