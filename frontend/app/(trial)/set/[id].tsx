import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../../src/services/localStorageService";
import Header from "../../../src/components/Header";

export default function TrialSetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const router = useRouter();
  const [questionSet, setQuestionSet] = useState<LocalQuestionSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const set = await localStorageService.getTrialQuestionSet(id);
      setQuestionSet(set);
    } catch (error) {
      console.error("Failed to load question set:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to load question set", "問題セットの読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = () => {
    if (!questionSet || questionSet.questions.length === 0) {
      Alert.alert(
        t("No Questions", "問題がありません"),
        t(
          "This question set has no questions",
          "この問題セットには問題がありません"
        )
      );
      return;
    }
    router.push(`/(trial)/quiz/${id}`);
  };

  const handleStartFlashcard = () => {
    if (!questionSet || questionSet.questions.length === 0) {
      return;
    }
    router.push(`/(app)/flashcard/${id}`);
  };

  const renderQuestion = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionNumber}>Q{index + 1}</Text>
        {item.difficulty && (
          <Text style={styles.difficulty}>
            {t("Level", "レベル")}: {item.difficulty}
          </Text>
        )}
      </View>
      <Text style={styles.questionText}>{item.question}</Text>
    </View>
  );

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
      <Header />

      <View style={styles.header}>
        <Text style={styles.title}>{questionSet.title}</Text>
        {questionSet.description && (
          <Text style={styles.description}>{questionSet.description}</Text>
        )}
        <View style={styles.trialBadge}>
          <Text style={styles.trialBadgeText}>
            {t("Trial Mode", "お試しモード")}
          </Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{questionSet.questions.length}</Text>
          <Text style={styles.statLabel}>{t("Questions", "問題数")}</Text>
        </View>
      </View>

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
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backToListButtonText}>
            {t("Back to List", "一覧に戻る")}
          </Text>
        </TouchableOpacity>
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
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
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
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 180,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  questionText: {
    fontSize: 16,
    color: "#333",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 24,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  startQuizButton: {
    flex: 1,
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  startQuizButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  flashcardButton: {
    flex: 1,
    backgroundColor: "#FF1D69",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  flashcardButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
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
});
