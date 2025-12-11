import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../src/services/localStorageService";
import Header from "../../src/components/Header";

export default function TrialQuestionSetsScreen() {
  const [questionSets, setQuestionSets] = useState<LocalQuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const router = useRouter();

  const loadQuestionSets = async () => {
    setIsLoading(true);
    try {
      // TrialModeContextで既に初期化されているのでここでは不要
      const sets = await localStorageService.getTrialQuestionSets();
      console.log('[TrialQuestionSets] Loaded', sets.length, 'question sets');
      setQuestionSets(sets);
    } catch (error) {
      console.error("Error loading trial question sets:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to load question sets", "問題セットの読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const handleDelete = async (id: string) => {
    Alert.alert(
      t("Delete Question Set", "問題セットを削除"),
      t(
        "Are you sure you want to delete this question set?",
        "この問題セットを削除してもよろしいですか？"
      ),
      [
        {
          text: t("Cancel", "キャンセル"),
          style: "cancel",
        },
        {
          text: t("Delete", "削除"),
          style: "destructive",
          onPress: async () => {
            try {
              await localStorageService.deleteTrialQuestionSet(id);
              await loadQuestionSets();
              Alert.alert(
                t("Success", "成功"),
                t("Question set deleted", "問題セットを削除しました")
              );
            } catch (error) {
              Alert.alert(
                t("Error", "エラー"),
                t(
                  "Failed to delete question set",
                  "問題セットの削除に失敗しました"
                )
              );
            }
          },
        },
      ]
    );
  };

  const renderQuestionSet = ({ item }: { item: LocalQuestionSet }) => {
    // デフォルト問題セット（IDがdefault_で始まる）は削除不可
    const isDefaultSet = item.id.startsWith("default_");

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => router.push(`/(trial)/set/${item.id}`)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <Text style={styles.cardInfo}>
            {t("Questions", "問題数")}: {item.questions.length}
          </Text>
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>
              {t("Trial Mode", "お試しモード")}
            </Text>
          </View>
        </TouchableOpacity>
        {!isDefaultSet && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
          >
            <Text style={styles.deleteButtonText}>{t("Delete", "削除")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t("Trial Question Sets", "お試し問題セット")}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              "Create and practice without signing up",
              "登録なしで問題を作成・練習できます"
            )}
          </Text>
        </View>

        {questionSets.length === 0 && !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {t(
                "No question sets yet. Create your first one!",
                "まだ問題セットがありません。最初の問題セットを作成しましょう！"
              )}
            </Text>
          </View>
        ) : (
          <FlatList
            data={questionSets}
            renderItem={renderQuestionSet}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={isLoading}
            onRefresh={loadQuestionSets}
          />
        )}

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/(trial)/create")}
        >
          <Text style={styles.createButtonText}>
            {t("Create Question Set", "問題セットを作成")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            {t("Back to Home", "ホームに戻る")}
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
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  cardInfo: {
    fontSize: 12,
    color: "#999",
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
  deleteButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginBottom: 20,
  },
});
