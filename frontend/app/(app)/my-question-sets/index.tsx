import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  questionSetsApi,
  QuestionSet,
  QuestionSetWithQuestions,
} from "../../../src/api/questionSets";
import {
  getAvailableTextbooks,
  Textbook,
} from "../../../src/services/textbookService";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import AdBanner from "../../../src/components/AdBanner";
import { srsService } from "../../../src/services/srsService";

export default function MyQuestionSetsScreen() {
  const [myQuestionSets, setMyQuestionSets] = useState<QuestionSet[]>([]);
  const [purchasedQuestionSets, setPurchasedQuestionSets] = useState<
    QuestionSet[]
  >([]);
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  useEffect(() => {
    // 認証済みの場合のみ問題セットを読み込む
    if (user) {
      loadQuestionSets();
      return;
    }

    // 未認証で、認証チェックが終わったらログインへ
    if (!isAuthLoading && !user) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthLoading]);

  const loadQuestionSets = async () => {
    try {
      const [myData, purchasedData] = await Promise.all([
        questionSetsApi.getMy(),
        questionSetsApi.getPurchased(),
      ]);

      const textbooksData = await getAvailableTextbooks();

      setMyQuestionSets(myData);
      setPurchasedQuestionSets(purchasedData);
      setAvailableTextbooks(textbooksData);

      const counts: Record<string, number> = {};
      for (const set of [...myData, ...purchasedData]) {
        counts[set.id] = await srsService.getDueCount(set.id);
      }
      setDueCounts(counts);
    } catch (error: any) {
      console.error("Failed to load question sets:", error);

      if (error.response?.status === 403) {
        Alert.alert(
          t("Permission Denied", "アクセス拒否"),
          t(
            "You don't have permission to access this resource. Please try logging in again.",
            "このリソースへのアクセス権限がありません。再度ログインしてください。"
          )
        );
      } else {
        Alert.alert(
          t("Error", "エラー"),
          t("Failed to load question sets", "問題集の読み込みに失敗しました")
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDownload = async (questionSet: QuestionSet) => {
    if (!user) return;

    try {
      Alert.alert(
        t("Downloading", "ダウンロード中"),
        t("Downloading question set...", "問題集をダウンロード中...")
      );

      const data = await questionSetsApi.download(questionSet.id);

      // ローカルに保存
      const localKey = `downloaded_question_sets_${user.id}`;
      const storedData = await AsyncStorage.getItem(localKey);
      const localQuestionSets = storedData ? JSON.parse(storedData) : [];

      // 既存のダウンロードを上書き
      const existingIndex = localQuestionSets.findIndex(
        (qs: QuestionSetWithQuestions) => qs.id === data.id
      );

      if (existingIndex >= 0) {
        localQuestionSets[existingIndex] = data;
      } else {
        localQuestionSets.push(data);
      }

      await AsyncStorage.setItem(localKey, JSON.stringify(localQuestionSets));

      Alert.alert(
        t("Success", "成功"),
        t(
          `Downloaded "${questionSet.title}" with ${data.questions.length} questions!`,
          `「${questionSet.title}」を ${data.questions.length} 問ダウンロードしました！`
        )
      );
    } catch (error: any) {
      console.error("Download failed:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to download question set", "問題集のダウンロードに失敗しました")
      );
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadQuestionSets();
  };

  const navigateToCreateQuestionSet = () => {
    router.push("/(app)/question-sets/create");
  };

  const navigateToDetail = (id: string) => {
    router.push(`/(app)/question-sets/${id}`);
  };

  const navigateToPremium = () => {
    router.push("/(app)/premium-upgrade");
  };

  const renderMyQuestionSetItem = ({ item }: { item: QuestionSet }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          padding: isSmallScreen ? 12 : 16,
          marginBottom: isSmallScreen ? 10 : 12,
        },
      ]}
      onPress={() => navigateToDetail(item.id)}
      testID={`my-qs-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { fontSize: isSmallScreen ? 16 : 18 }]}>
          {item.title}
        </Text>
        {(dueCounts[item.id] || 0) > 0 && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueBadgeText}>
              {t(`${dueCounts[item.id]} due`, `${dueCounts[item.id]}問 要復習`)}
            </Text>
          </View>
        )}
        {item.is_published && (
          <View style={styles.publishedBadge}>
            <Text style={styles.publishedText}>{t("Published", "公開中")}</Text>
          </View>
        )}
      </View>
      {item.description && (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardCategory}>{item.category}</Text>
        <Text style={styles.cardQuestions}>
          {t(`${item.total_questions} questions`, `${item.total_questions} 問`)}
        </Text>
        {item.price > 0 && <Text style={styles.cardPrice}>¥{item.price}</Text>}
      </View>
    </TouchableOpacity>
  );

  const renderPurchasedItem = ({ item }: { item: QuestionSet }) => (
    <View style={styles.card} nativeID={`purchased-card-${item.id}`}>
      <TouchableOpacity
        onPress={() => navigateToDetail(item.id)}
        testID={`purchased-card-button-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {(dueCounts[item.id] || 0) > 0 && (
            <View style={styles.dueBadge}>
              <Text style={styles.dueBadgeText}>
                {t(`${dueCounts[item.id]} due`, `${dueCounts[item.id]}問 要復習`)}
              </Text>
            </View>
          )}
          <View style={styles.purchasedBadge}>
            <Text style={styles.purchasedText}>{t("Purchased", "購入済み")}</Text>
          </View>
        </View>
        {item.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCategory}>{item.category}</Text>
          <Text style={styles.cardQuestions}>
            {t(`${item.total_questions} questions`, `${item.total_questions} 問`)}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownload(item)}
        testID={`download-btn-${item.id}`}
      >
        <Text style={styles.downloadButtonText}>
          {t("Download for Offline", "オフラインでダウンロード")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTextbookItem = ({ item }: { item: Textbook }) => (
    <View
      style={[
        styles.textbookCard,
        {
          padding: isSmallScreen ? 12 : 16,
          marginBottom: isSmallScreen ? 10 : 12,
        },
      ]}
      nativeID={`textbook-card-${item.path}`}
    >
      <View style={styles.textbookCardHeader}>
        <Text style={styles.textbookCardIcon}>📚</Text>
        <Text
          style={[
            styles.textbookCardName,
            { fontSize: isSmallScreen ? 14 : 16 },
          ]}
        >
          {item.name}
        </Text>
      </View>
      <Text
        style={[styles.textbookCardType, { fontSize: isSmallScreen ? 11 : 14 }]}
      >
        {item.type === "markdown" ? "📄 Markdown" : "📕 PDF"}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer} nativeID="my-qs-loading">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 未認証の場合（認証チェックが完了している）
  if (!user) {
    return (
      <View style={styles.centerContainer} nativeID="my-qs-unauth">
        <Text style={styles.emptyText}>
          {t("Please log in to continue", "続行するにはログインしてください")}
        </Text>
        <TouchableOpacity
          style={[styles.downloadButton, { marginTop: 12 }]}
          onPress={() => router.replace("/(auth)/login")}
          testID="my-qs-btn-login"
        >
          <Text style={styles.downloadButtonText}>
            {t("Go to Login", "ログインへ")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} nativeID="my-qs-container">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { padding: isSmallScreen ? 12 : 16, paddingBottom: 80 },
        ]}
        nativeID="my-qs-scroll"
      >
        {/* Premium Banner */}
        {!user?.is_premium && (
          <TouchableOpacity
            style={[
              styles.premiumBanner,
              {
                padding: isSmallScreen ? 16 : 20,
                marginBottom: isSmallScreen ? 16 : 20,
              },
            ]}
            onPress={navigateToPremium}
            testID="my-qs-premium-banner"
          >
            <Text
              style={[
                styles.premiumBannerTitle,
                { fontSize: isSmallScreen ? 18 : 20 },
              ]}
            >
              {t("✨ Upgrade to Premium", "✨ プレミアムにアップグレード")}
            </Text>
            <Text
              style={[
                styles.premiumBannerText,
                { fontSize: isSmallScreen ? 13 : 14 },
              ]}
            >
              {t(
                "Cloud sync • Unlimited storage • Multi-device access",
                "クラウド同期 • 無制限ストレージ • マルチデバイスアクセス"
              )}
            </Text>
          </TouchableOpacity>
        )}

        <AdBanner />

        {/* My Question Sets Section */}
        <View style={styles.section} nativeID="my-qs-section">
          <Text style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}>
            {t("My Question Sets", "マイ問題集")}
          </Text>
          {myQuestionSets.length === 0 ? (
            <View style={styles.emptyContainer} nativeID="my-qs-empty">
              <Text style={styles.emptyText}>
                {t("No question sets yet", "まだ問題集がありません")}
              </Text>
              <Text style={styles.emptySubtext}>
                {t(
                  "Create your first question set to get started",
                  "最初の問題集を作成して始めましょう"
                )}
              </Text>
            </View>
          ) : (
            myQuestionSets.map((item) => (
              <View key={item.id}>{renderMyQuestionSetItem({ item })}</View>
            ))
          )}
        </View>

        {/* Purchased Question Sets Section */}
        {purchasedQuestionSets.length > 0 && (
          <View style={styles.section} nativeID="purchased-qs-section">
            <Text style={styles.sectionTitle}>
              {t("Purchased Question Sets", "購入済み問題集")}
            </Text>
            {purchasedQuestionSets.map((item) => (
              <View key={item.id}>{renderPurchasedItem({ item })}</View>
            ))}
          </View>
        )}

        {/* Available Textbooks Section */}
        <View style={styles.section} nativeID="textbooks-section">
          <Text style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}>
            {t("Available Textbooks", "利用可能な教科書")}
          </Text>
          {availableTextbooks.length === 0 ? (
            <View style={styles.emptyContainer} nativeID="textbooks-empty">
              <Text style={styles.emptyText}>
                {t("No textbooks available", "利用可能な教科書がありません")}
              </Text>
            </View>
          ) : (
            availableTextbooks.map((item) => (
              <View key={item.path}>{renderTextbookItem({ item })}</View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={navigateToCreateQuestionSet}
        testID="my-qs-fab-create"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  premiumBanner: {
    backgroundColor: "#5A67D8",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  premiumBannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  premiumBannerText: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  publishedBadge: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publishedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  purchasedBadge: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  purchasedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  dueBadge: {
    backgroundColor: "#FF9500",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  dueBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  downloadButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: "center",
    minWidth: 180,
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardCategory: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  cardQuestions: {
    fontSize: 14,
    color: "#666",
  },
  cardPrice: {
    fontSize: 14,
    color: "#FF9500",
    fontWeight: "600",
    marginLeft: "auto",
  },
  textbookCard: {
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
  textbookCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  textbookCardIcon: {
    fontSize: 20,
  },
  textbookCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  textbookCardType: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  fabText: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "300",
  },
});






