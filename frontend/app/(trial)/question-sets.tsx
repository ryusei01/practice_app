import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../src/services/localStorageService";
import Header from "../../src/components/Header";
import Modal from "../../src/components/Modal";

export default function TrialQuestionSetsScreen() {
  const [questionSets, setQuestionSets] = useState<LocalQuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    title: "",
    message: "",
    buttons: [],
  });

  const showModal = (
    title: string,
    message: string,
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>
  ) => {
    setModalConfig({ title, message, buttons });
    setModalVisible(true);
  };

  const loadQuestionSets = async () => {
    setIsLoading(true);
    try {
      // TrialModeContextで既に初期化されているのでここでは不要
      const sets = await localStorageService.getTrialQuestionSets();
      console.log("[TrialQuestionSets] Loaded", sets.length, "question sets");
      setQuestionSets(sets);
    } catch (error) {
      console.error("Error loading trial question sets:", error);
      showModal(
        t("Error", "エラー"),
        t("Failed to load question sets", "問題セットの読み込みに失敗しました"),
        [{ text: t("OK", "OK"), onPress: () => setModalVisible(false) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 画面がフォーカスされたときに問題セット一覧を再読み込み
  useFocusEffect(
    useCallback(() => {
      loadQuestionSets();
    }, [])
  );

  useEffect(() => {
    // Web版の場合、動的にメタタグを設定
    if (Platform.OS === "web") {
      document.title = "AI Practice Book Ver.β";

      const setMetaTag = (name: string, content: string, property?: string) => {
        const selector = property
          ? `meta[property="${name}"]`
          : `meta[name="${name}"]`;
        let meta = document.querySelector(selector) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement("meta");
          if (property) {
            meta.setAttribute("property", name);
          } else {
            meta.setAttribute("name", name);
          }
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      setMetaTag(
        "description",
        "Create and practice with custom question sets without signing up. Try our AI-powered flashcard mode and quiz system for free. | 登録不要でカスタム問題セットを作成・練習。AI搭載の単語帳モードとクイズシステムを無料で試せます。"
      );
      setMetaTag(
        "keywords",
        "trial,free,no signup,flashcard,quiz,practice,demo,trial mode,無料,登録不要,お試し,単語帳,クイズ,練習"
      );
      setMetaTag(
        "og:title",
        "Try AI Practice Book Free - No Sign Up Required | AI Practice Book 無料お試し - 登録不要",
        true
      );
      setMetaTag(
        "og:description",
        "Experience AI-powered learning for free. Create quizzes and practice with flashcards without creating an account. | AI学習を無料で体験。アカウント作成不要でクイズと単語帳を試せます。",
        true
      );
      setMetaTag("robots", "index, follow");
    }
  }, []);

  const handleDelete = async (id: string) => {
    showModal(
      t("Delete Question Set", "問題セットを削除"),
      t(
        "Are you sure you want to delete this question set?",
        "この問題セットを削除してもよろしいですか？"
      ),
      [
        {
          text: t("Cancel", "キャンセル"),
          style: "cancel",
          onPress: () => setModalVisible(false),
        },
        {
          text: t("Delete", "削除"),
          style: "destructive",
          onPress: async () => {
            setModalVisible(false);
            try {
              await localStorageService.deleteTrialQuestionSet(id);
              await loadQuestionSets();
              showModal(
                t("Success", "成功"),
                t("Question set deleted", "問題セットを削除しました"),
                [{ text: t("OK", "OK"), onPress: () => setModalVisible(false) }]
              );
            } catch (error) {
              showModal(
                t("Error", "エラー"),
                t(
                  "Failed to delete question set",
                  "問題セットの削除に失敗しました"
                ),
                [{ text: t("OK", "OK"), onPress: () => setModalVisible(false) }]
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
      <View style={styles.card} nativeID={`trial-card-${item.id}`}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => router.push(`/(trial)/set/${item.id}`)}
          nativeID={`trial-card-button-${item.id}`}
        >
          <Text style={styles.cardTitle} nativeID={`trial-title-${item.id}`}>{item.title}</Text>
          <Text style={styles.cardDescription} nativeID={`trial-desc-${item.id}`}>{item.description}</Text>
          <Text style={styles.cardInfo} nativeID={`trial-info-${item.id}`}>
            {t("Questions", "問題数")}: {item.questions.length}
          </Text>
          <View style={styles.trialBadge} nativeID={`trial-badge-${item.id}`}>
            <Text style={styles.trialBadgeText} nativeID={`trial-badge-text-${item.id}`}>
              {t("Trial Mode", "お試しモード")}
            </Text>
          </View>
        </TouchableOpacity>
        {!isDefaultSet && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            nativeID={`trial-delete-btn-${item.id}`}
          >
            <Text style={styles.deleteButtonText} nativeID={`trial-delete-text-${item.id}`}>{t("Delete", "削除")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} nativeID="trial-sets-container">
      <Header title={t("Trial Question Sets", "お試し問題セット")} />
      <View style={styles.content} nativeID="trial-sets-content">

        {questionSets.length === 0 && !isLoading ? (
          <View style={styles.emptyState} nativeID="trial-sets-empty">
            <Text style={styles.emptyText} nativeID="trial-sets-empty-text">
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
            nativeID="trial-sets-list"
          />
        )}

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/(trial)/create")}
          nativeID="trial-btn-create"
        >
          <Text style={styles.createButtonText} nativeID="trial-btn-create-text">
            {t("Create Question Set", "問題セットを作成")}
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
