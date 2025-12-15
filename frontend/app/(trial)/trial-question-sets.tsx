import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../src/services/localStorageService";
import {
  getAvailableTextbooks,
  Textbook,
} from "../../src/services/textbookService";
import Header from "../../src/components/Header";
import Modal from "../../src/components/Modal";

export default function TrialQuestionSetsScreen() {
  const [questionSets, setQuestionSets] = useState<LocalQuestionSet[]>([]);
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(false); // 重複読み込み防止用
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

  const loadQuestionSets = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const sets = await localStorageService.getTrialQuestionSets();
      setQuestionSets(sets);

      const textbooks = await getAvailableTextbooks();
      setAvailableTextbooks(textbooks);
    } catch (error) {
      console.error("Error loading trial question sets:", error);
      showModal(
        t("Error", "エラー"),
        t("Failed to load question sets", "問題セットの読み込みに失敗しました"),
        [{ text: t("OK", "OK"), onPress: () => setModalVisible(false) }]
      );
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [t]);

  // 画面がフォーカスされたときに問題セット一覧を再読み込み
  useFocusEffect(
    useCallback(() => {
      loadQuestionSets();
    }, [loadQuestionSets])
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
        "property"
      );
      setMetaTag(
        "og:description",
        "Experience AI-powered learning for free. Create quizzes and practice with flashcards without creating an account. | AI学習を無料で体験。アカウント作成不要でクイズと単語帳を試せます。",
        "property"
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
          testID={`trial-card-button-${item.id}`}
        >
          <Text style={styles.cardTitle} nativeID={`trial-title-${item.id}`}>
            {item.title}
          </Text>
          <Text
            style={styles.cardDescription}
            nativeID={`trial-desc-${item.id}`}
          >
            {item.description}
          </Text>
          <Text style={styles.cardInfo} nativeID={`trial-info-${item.id}`}>
            {t("Questions", "問題数")}: {item.questions.length}
          </Text>
          <View style={styles.trialBadge} nativeID={`trial-badge-${item.id}`}>
            <Text
              style={styles.trialBadgeText}
              nativeID={`trial-badge-text-${item.id}`}
            >
              {t("Trial Mode", "お試しモード")}
            </Text>
          </View>
        </TouchableOpacity>
        {!isDefaultSet && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            testID={`trial-delete-btn-${item.id}`}
          >
            <Text
              style={styles.deleteButtonText}
              nativeID={`trial-delete-text-${item.id}`}
            >
              {t("Delete", "削除")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleTextbookPress = (textbook: Textbook) => {
    const encodedPath = encodeURIComponent(textbook.path);
    router.push(`/(trial)/textbook/${encodedPath}?type=${textbook.type}`);
  };

  const renderTextbookItem = ({ item }: { item: Textbook }) => (
    <TouchableOpacity
      style={styles.textbookCard}
      onPress={() => handleTextbookPress(item)}
    >
      <View style={styles.textbookCardHeader}>
        <Text style={styles.textbookCardIcon}>📚</Text>
        <Text style={styles.textbookCardName}>{item.name}</Text>
      </View>
      <Text style={styles.textbookCardType}>
        {item.type === "markdown" ? "📄 Markdown" : "📕 PDF"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} nativeID="trial-sets-container">
      <Header title={t("Trial Question Sets", "お試し問題セット")} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        nativeID="trial-sets-content"
      >
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
          questionSets.map((item) => (
            <View key={item.id}>{renderQuestionSet({ item })}</View>
          ))
        )}

        {/* 教科書セクション */}
        {availableTextbooks.length > 0 && (
          <View style={styles.textbookSection}>
            <Text style={styles.sectionTitle}>
              {t("Available Textbooks", "利用可能な教科書")}
            </Text>
            {availableTextbooks.map((item) => (
              <View key={item.path}>{renderTextbookItem({ item })}</View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/(trial)/create")}
          testID="trial-btn-create"
        >
          <Text style={styles.createButtonText} nativeID="trial-btn-create-text">
            {t("Create Question Set", "問題セットを作成")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={modalConfig.buttons}
        onClose={() => setModalVisible(false)}
      />
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
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  cardInfo: {
    fontSize: 12,
    color: "#888",
    marginBottom: 10,
  },
  trialBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  trialBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-end",
    marginTop: 10,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyState: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  textbookSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  textbookCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textbookCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  textbookCardIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  textbookCardName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  textbookCardType: {
    fontSize: 12,
    color: "#888",
  },
});


