import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect, usePathname } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../src/services/localStorageService";
import {
  LanguageFilter,
  resolvedContentLanguage,
  contentLanguageDisplayLabel,
} from "../../src/api/questionSets";
import {
  getAvailableTextbooks,
  Textbook,
} from "../../src/services/textbookService";
import { useAuth } from "../../src/contexts/AuthContext";
import Header from "../../src/components/Header";
import Modal from "../../src/components/Modal";
import { srsService } from "../../src/services/srsService";

export default function TrialQuestionSetsScreen() {
  const [questionSets, setQuestionSets] = useState<LocalQuestionSet[]>([]);
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(false); // 重複読み込み防止用
  const [showDefaultSets, setShowDefaultSets] = useState(true);
  const [showTextbooks, setShowTextbooks] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const scrollViewRef = useRef<ScrollView>(null);
  const textbookSectionYRef = useRef<number | null>(null);
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

      const counts: Record<string, number> = {};
      for (const set of sets) {
        counts[set.id] = await srsService.getDueCount(set.id);
      }
      setDueCounts(counts);
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

  // 表示設定を AsyncStorage から読み込む
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [defVal, tbVal] = await Promise.all([
          AsyncStorage.getItem("pref_showDefaultSets"),
          AsyncStorage.getItem("pref_showTextbooks"),
        ]);
        if (defVal !== null) setShowDefaultSets(defVal === "true");
        if (tbVal !== null) setShowTextbooks(tbVal === "true");
      } catch (_) {}
    };
    loadPrefs();
  }, []);

  const toggleShowDefaultSets = async () => {
    const next = !showDefaultSets;
    setShowDefaultSets(next);
    await AsyncStorage.setItem("pref_showDefaultSets", String(next));
  };

  const toggleShowTextbooks = async () => {
    const next = !showTextbooks;
    setShowTextbooks(next);
    await AsyncStorage.setItem("pref_showTextbooks", String(next));
  };

  // 画面がフォーカスされたときに問題セット一覧を再読み込み
  useFocusEffect(
    useCallback(() => {
      loadQuestionSets();
    }, [loadQuestionSets])
  );

  useEffect(() => {
    // Web版の場合、動的にメタタグを設定
    if (Platform.OS === "web") {
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

      const isJa = language === "ja";

      document.title = isJa
        ? "AI Practice Book - 無料お試し | 登録不要で問題セットを練習"
        : "AI Practice Book - Free Trial | Practice Question Sets Without Sign Up";

      setMetaTag(
        "description",
        isJa
          ? "登録不要でカスタム問題セットを作成・練習。AI搭載の単語帳モードとクイズシステムを無料で試せます。"
          : "Create and practice with custom question sets without signing up. Try our AI-powered flashcard mode and quiz system for free."
      );
      setMetaTag(
        "keywords",
        isJa
          ? "無料,登録不要,お試し,単語帳,クイズ,練習,AI学習,問題セット"
          : "trial,free,no signup,flashcard,quiz,practice,demo,AI learning,question sets"
      );
      setMetaTag(
        "og:title",
        isJa
          ? "AI Practice Book 無料お試し - 登録不要で体験"
          : "Try AI Practice Book Free - No Sign Up Required",
        "property"
      );
      setMetaTag(
        "og:description",
        isJa
          ? "AI学習を無料で体験。アカウント作成不要でクイズと単語帳を試せます。"
          : "Experience AI-powered learning for free. Create quizzes and practice with flashcards without creating an account.",
        "property"
      );
      setMetaTag("og:locale", isJa ? "ja_JP" : "en_US", "property");
      setMetaTag("robots", "index, follow");
    }
  }, [language]);

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
      <View
        style={[
          styles.card,
          {
            padding: isSmallScreen ? 12 : 15,
            marginBottom: isSmallScreen ? 12 : 15,
          },
        ]}
        nativeID={`trial-card-${item.id}`}
      >
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => router.push(`/(trial)/set/${item.id}`)}
          testID={`trial-card-button-${item.id}`}
        >
          <Text
            style={[styles.cardTitle, { fontSize: isSmallScreen ? 16 : 18 }]}
            nativeID={`trial-title-${item.id}`}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.cardDescription,
              { fontSize: isSmallScreen ? 13 : 14 },
            ]}
            nativeID={`trial-desc-${item.id}`}
          >
            {item.description}
          </Text>
          <Text
            style={[styles.cardInfo, { fontSize: isSmallScreen ? 11 : 12 }]}
            nativeID={`trial-info-${item.id}`}
          >
            {t("Questions", "問題数")}: {item.questions.length}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.langBadge} nativeID={`trial-lang-${item.id}`}>
              <Text
                style={styles.langBadgeText}
                nativeID={`trial-lang-text-${item.id}`}
              >
                {contentLanguageDisplayLabel(item.content_language, t)}
              </Text>
            </View>
            <View style={styles.trialBadge} nativeID={`trial-badge-${item.id}`}>
              <Text
                style={styles.trialBadgeText}
                nativeID={`trial-badge-text-${item.id}`}
              >
                {t("Trial Mode", "お試しモード")}
              </Text>
            </View>
            {(dueCounts[item.id] || 0) > 0 && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>
                  {t(`${dueCounts[item.id]} due`, `${dueCounts[item.id]}問 要復習`)}
                </Text>
              </View>
            )}
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

  const visibleQuestionSets = useMemo(() => {
    return questionSets
      .filter((item) =>
        showDefaultSets ? true : !item.id.startsWith("default_")
      )
      .filter(
        (item) =>
          languageFilter === "all" ||
          resolvedContentLanguage(item.content_language) === languageFilter
      );
  }, [questionSets, showDefaultSets, languageFilter]);

  const visibleTextbooks = useMemo(
    () =>
      availableTextbooks.filter(
        (tb) =>
          languageFilter === "all" || tb.language === languageFilter
      ),
    [availableTextbooks, languageFilter]
  );

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
        {" · "}
        {contentLanguageDisplayLabel(item.language, t)}
      </Text>
    </TouchableOpacity>
  );

  const scrollToTextbooks = () => {
    const y = textbookSectionYRef.current;
    if (y == null) return;
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };

  return (
    <View style={styles.container} nativeID="trial-sets-container">
      <Header
        title={
          pathname === "/question-sets" || pathname === "/question-sets/"
            ? t("Question Sets", "問題セット")
            : t("Trial Question Sets", "お試し問題セット")
        }
        showLanguageSwitcher
      />
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: isSmallScreen ? 16 : 20,
            paddingBottom: 100,
          },
        ]}
        nativeID="trial-sets-content"
      >
        {/* フィルターチップ */}
        <View style={styles.filterRow} nativeID="trial-filter-row">
          <TouchableOpacity
            style={[
              styles.filterChip,
              showDefaultSets && styles.filterChipActive,
            ]}
            onPress={toggleShowDefaultSets}
            testID="trial-toggle-default-sets"
          >
            <Text
              style={[
                styles.filterChipText,
                showDefaultSets && styles.filterChipTextActive,
              ]}
            >
              {showDefaultSets
                ? t("Hide Defaults", "デフォルトを非表示")
                : t("Show Defaults", "デフォルトを表示")}
            </Text>
          </TouchableOpacity>

          {availableTextbooks.length > 0 && (
            <TouchableOpacity
              style={[
                styles.filterChip,
                showTextbooks && styles.filterChipActive,
              ]}
              onPress={toggleShowTextbooks}
              testID="trial-toggle-textbooks"
            >
              <Text
                style={[
                  styles.filterChipText,
                  showTextbooks && styles.filterChipTextActive,
                ]}
              >
                {showTextbooks
                  ? t("Hide Textbooks", "教科書を非表示")
                  : t("Show Textbooks", "教科書を表示")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow} nativeID="trial-lang-filter-row">
          <TouchableOpacity
            style={[
              styles.filterChip,
              languageFilter === "all" && styles.filterChipActive,
            ]}
            onPress={() => setLanguageFilter("all")}
            testID="trial-filter-lang-all"
          >
            <Text
              style={[
                styles.filterChipText,
                languageFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              {t("All languages", "すべて")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              languageFilter === "ja" && styles.filterChipActive,
            ]}
            onPress={() => setLanguageFilter("ja")}
            testID="trial-filter-lang-ja"
          >
            <Text
              style={[
                styles.filterChipText,
                languageFilter === "ja" && styles.filterChipTextActive,
              ]}
            >
              {t("Japanese", "日本語")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              languageFilter === "en" && styles.filterChipActive,
            ]}
            onPress={() => setLanguageFilter("en")}
            testID="trial-filter-lang-en"
          >
            <Text
              style={[
                styles.filterChipText,
                languageFilter === "en" && styles.filterChipTextActive,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

        {/* ジャンプボタン（教科書セクションへ） */}
        {availableTextbooks.length > 0 && showTextbooks && (
          <View
            style={styles.jumpButtonContainer}
            nativeID="trial-jump-buttons"
          >
            <TouchableOpacity
              style={[
                styles.jumpButton,
                { paddingVertical: isSmallScreen ? 10 : 12 },
              ]}
              onPress={scrollToTextbooks}
              testID="trial-jump-to-textbooks"
            >
              <Text
                style={[
                  styles.jumpButtonText,
                  { fontSize: isSmallScreen ? 13 : 14 },
                ]}
                nativeID="trial-jump-to-textbooks-text"
              >
                {t("Go to Textbooks", "教科書へ")}
              </Text>
              <Text style={styles.jumpButtonIcon} aria-label="down">
                ↓
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {questionSets.length === 0 && !isLoading ? (
          <View style={styles.emptyState} nativeID="trial-sets-empty">
            <Text
              style={[styles.emptyText, { fontSize: isSmallScreen ? 14 : 16 }]}
              nativeID="trial-sets-empty-text"
            >
              {t(
                "No question sets yet. Create your first one!",
                "まだ問題セットがありません。最初の問題セットを作成しましょう！"
              )}
            </Text>
          </View>
        ) : visibleQuestionSets.length === 0 && !isLoading ? (
          <View style={styles.emptyState} nativeID="trial-sets-filter-empty">
            <Text
              style={[styles.emptyText, { fontSize: isSmallScreen ? 14 : 16 }]}
            >
              {t(
                "No question sets match this language filter",
                "この言語に一致する問題セットがありません"
              )}
            </Text>
          </View>
        ) : (
          visibleQuestionSets.map((item) => (
            <View key={item.id}>{renderQuestionSet({ item })}</View>
          ))
        )}

        {/* 教科書セクション */}
        {availableTextbooks.length > 0 && showTextbooks && (
          <View
            style={styles.textbookSection}
            nativeID="trial-textbook-section"
            onLayout={(e) => {
              textbookSectionYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: isSmallScreen ? 18 : 20 },
              ]}
            >
              {t("Available Textbooks", "利用可能な教科書")}
            </Text>
            {visibleTextbooks.length === 0 ? (
              <Text style={[styles.emptyText, { marginBottom: 12 }]}>
                {t(
                  "No textbooks match this language filter",
                  "この言語に一致する教科書がありません"
                )}
              </Text>
            ) : (
              visibleTextbooks.map((item) => (
                <View key={item.path}>{renderTextbookItem({ item })}</View>
              ))
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.createButton,
            {
              padding: isSmallScreen ? 12 : 15,
            },
          ]}
          onPress={() =>
            user
              ? router.push("/(app)/question-sets/create")
              : router.push("/(trial)/create")
          }
          testID="trial-btn-create"
        >
          <Text
            style={[
              styles.createButtonText,
              { fontSize: isSmallScreen ? 14 : 16 },
            ]}
            nativeID="trial-btn-create-text"
          >
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
  jumpButtonContainer: {
    width: "100%",
    marginBottom: 16,
    alignItems: "center",
  },
  jumpButton: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.25)",
  },
  jumpButtonText: {
    color: "#007AFF",
    fontWeight: "700",
  },
  jumpButtonIcon: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: -1,
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
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
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
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  trialBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  trialBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  langBadge: {
    backgroundColor: "#5856D6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  langBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  dueBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dueBadgeText: {
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007AFF",
  },
  filterChipTextActive: {
    color: "#fff",
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
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
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




