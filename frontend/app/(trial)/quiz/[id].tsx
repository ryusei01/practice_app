import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import { localStorageService, LocalQuestionSet } from "../../../src/services/localStorageService";
import Header from "../../../src/components/Header";
import QuizEngine, { QuizQuestion, QuizAnswer } from "../../../src/components/QuizEngine";
import Modal from "../../../src/components/Modal";

export default function TrialQuizScreen() {
  const { id, startIndex, questionIds } = useLocalSearchParams<{ 
    id: string; 
    startIndex?: string;
    questionIds?: string;
  }>();
  const [questionSet, setQuestionSet] = useState<LocalQuestionSet | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<LocalQuestion[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const router = useRouter();
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadQuestionSet();
  }, [id]);

  const loadQuestionSet = async () => {
    if (!id || typeof id !== "string") return;

    try {
      const set = await localStorageService.getTrialQuestionSet(id);
      if (set) {
        setQuestionSet(set);

        // questionIdsが指定されている場合は、選択された問題のみを使用
        if (questionIds) {
          const selectedIds = questionIds.split(',');
          const selected = set.questions.filter(q => selectedIds.includes(q.id));
          setSelectedQuestions(selected);
        } else {
          setSelectedQuestions(null); // 全ての問題を使用
        }
      } else {
        setErrorMessage(t("Question set not found", "問題セットが見つかりません"));
        setErrorModalVisible(true);
      }
    } catch (error) {
      console.error("Error loading trial question set:", error);
      setErrorMessage(t("Failed to load question set", "問題セットの読み込みに失敗しました"));
      setErrorModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswer[], score: number, totalTime: number) => {
    if (!questionSet) return;

    // 結果を保存
    try {
      // サマリーを保存（回答数ベース）
      await localStorageService.saveTrialResult(questionSet.id, {
        score: score,
        totalQuestions: answers.length, // 回答した問題数
        completedAt: new Date().toISOString(),
      });

      // 詳細な回答データを保存（フラッシュカードと同じキーを使用）
      const storageKey = `@flashcard_answers_${questionSet.id}`;
      const existingData = await AsyncStorage.getItem(storageKey);
      const existingAnswers = existingData ? JSON.parse(existingData) : [];

      const newAnswerDataArray = answers.map((ans) => ({
        question_id: ans.question_id,
        question_set_id: questionSet.id,
        is_correct: ans.is_correct,
        answer_time_sec: ans.answer_time_sec,
        answered_at: new Date().toISOString(),
      }));

      const combinedAnswers = [...existingAnswers, ...newAnswerDataArray];
      await AsyncStorage.setItem(storageKey, JSON.stringify(combinedAnswers));

      // 古い回答履歴をクリーンアップ（最新1000件のみ保持）
      await localStorageService.cleanupOldAnswers(questionSet.id, 1000);
    } catch (error: any) {
      console.error("Error saving trial result:", error);
      // 容量超過エラーの場合はユーザーに通知
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('Storage quota exceeded')) {
        // エラーは表示するが、クイズ結果は表示する
        console.warn("Storage quota exceeded. Some data may not be saved.");
      }
    }

    // 結果画面を表示（回答数ベース）
    setFinalScore(score);
    setFinalTotal(answers.length); // 回答した問題数
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
      <View style={styles.container}>
        <Header title={t("Error", "エラー")} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>
            {t("Question set not found", "問題セットが見つかりません")}
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
        <Modal
          visible={errorModalVisible}
          title={t("Error", "エラー")}
          message={errorMessage}
          buttons={[
            { text: t("OK", "OK"), onPress: () => {
              setErrorModalVisible(false);
              router.back();
            }}
          ]}
          onClose={() => {
            setErrorModalVisible(false);
            router.back();
          }}
        />
      </View>
    );
  }

  if (showResult) {
    const percentage = Math.round((finalScore / finalTotal) * 100);

    return (
      <View style={styles.container}>
        <Header title={t("Quiz Result", "クイズ結果")} />
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
            onPress={() => router.push(`/(trial)/set/${id}`)}
          >
            <Text style={[styles.buttonText, styles.buttonOutlineText]}>
              {t("Back to List", "一覧に戻る")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // 使用する問題を決定（選択された問題があればそれを使用、なければ全て）
  const questionsToUse = selectedQuestions || questionSet.questions;

  // LocalQuestionをQuizQuestionに変換
  const quizQuestions: QuizQuestion[] = questionsToUse.map((q, index) => ({
    id: q.id || `${questionSet.id}_q${index}`,
    question_text: q.question,
    correct_answer: q.answer,
    question_type: "text_input",
  }));

  return (
    <View style={styles.container}>
      <Header title={questionSet.title} />
      <View style={styles.trialBadge}>
        <Text style={styles.trialBadgeText}>
          {t("Trial Mode", "お試しモード")}
        </Text>
      </View>
      <QuizEngine
        questions={quizQuestions}
        onComplete={handleQuizComplete}
        onQuit={() => router.push(`/(trial)/set/${id}`)}
        headerColor="#34C759"
        showAdvancedFeatures={true}
        initialRedSheetEnabled={questionSet.redSheetEnabled || false}
        initialQuestionIndex={parseInt(startIndex || "0")}
      />
      <Modal
        visible={errorModalVisible}
        title={t("Error", "エラー")}
        message={errorMessage}
        buttons={[
          { text: t("OK", "OK"), onPress: () => setErrorModalVisible(false) }
        ]}
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
    marginBottom: 20,
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
