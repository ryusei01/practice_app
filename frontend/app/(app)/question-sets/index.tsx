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
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  questionSetsApi,
  QuestionSet,
  QuestionSetWithQuestions,
} from "../../../src/api/questionSets";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";

export default function QuestionSetsScreen() {
  const [myQuestionSets, setMyQuestionSets] = useState<QuestionSet[]>([]);
  const [purchasedQuestionSets, setPurchasedQuestionSets] = useState<
    QuestionSet[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    try {
      const [myData, purchasedData] = await Promise.all([
        questionSetsApi.getMy(),
        questionSetsApi.getPurchased(),
      ]);
      setMyQuestionSets(myData);
      setPurchasedQuestionSets(purchasedData);
    } catch (error) {
      console.error("Failed to load question sets:", error);
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
        t(
          "Failed to download question set",
          "問題集のダウンロードに失敗しました"
        )
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
      style={styles.card}
      onPress={() => navigateToDetail(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
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
    <View style={styles.card}>
      <TouchableOpacity onPress={() => navigateToDetail(item.id)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.purchasedBadge}>
            <Text style={styles.purchasedText}>
              {t("Purchased", "購入済み")}
            </Text>
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
            {t(
              `${item.total_questions} questions`,
              `${item.total_questions} 問`
            )}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownload(item)}
      >
        <Text style={styles.downloadButtonText}>
          {t("Download for Offline", "オフラインでダウンロード")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Premium Banner */}
        {!user?.is_premium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={navigateToPremium}
          >
            <Text style={styles.premiumBannerTitle}>
              {t("✨ Upgrade to Premium", "✨ プレミアムにアップグレード")}
            </Text>
            <Text style={styles.premiumBannerText}>
              {t(
                "Cloud sync • Unlimited storage • Multi-device access",
                "クラウド同期 • 無制限ストレージ • マルチデバイスアクセス"
              )}
            </Text>
          </TouchableOpacity>
        )}

        {/* My Question Sets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("My Question Sets", "マイ問題集")}
          </Text>
          {myQuestionSets.length === 0 ? (
            <View style={styles.emptyContainer}>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("Purchased Question Sets", "購入済み問題集")}
            </Text>
            {purchasedQuestionSets.map((item) => (
              <View key={item.id}>{renderPurchasedItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={navigateToCreateQuestionSet}>
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
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  premiumBanner: {
    backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
  listContainer: {
    padding: 16,
    paddingBottom: 80,
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
  downloadButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: "center",
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
  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
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
