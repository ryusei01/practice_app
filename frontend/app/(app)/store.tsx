import React, { useState, useEffect, useCallback } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  questionSetsApi,
  QuestionSet,
  contentLanguageDisplayLabel,
} from "../../src/api/questionSets";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";
import AdBanner from "../../src/components/AdBanner";
import Header from "../../src/components/Header";

export default function StoreScreen() {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const loadPublishedSets = useCallback(async () => {
    try {
      const data = await questionSetsApi.getAll({ is_published: true });
      setQuestionSets(data);
    } catch (error) {
      console.error("Failed to load published question sets:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPublishedSets();
  }, [loadPublishedSets]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadPublishedSets();
  };

  const categories = Array.from(
    new Set(questionSets.map((qs) => qs.category).filter(Boolean))
  );

  const filteredSets = selectedCategory
    ? questionSets.filter((qs) => qs.category === selectedCategory)
    : questionSets;

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t("Question Set Store", "問題集ストア")} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { padding: isSmallScreen ? 12 : 16, paddingBottom: 40 },
        ]}
      >
        <Text
          style={[styles.pageTitle, { fontSize: isSmallScreen ? 22 : 26 }]}
        >
          {t("Question Set Store", "問題集ストア")}
        </Text>
        <Text style={styles.pageSubtitle}>
          {t(
            "Browse and purchase published question sets",
            "公開されている問題集を閲覧・購入できます"
          )}
        </Text>

        <AdBanner />

        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedCategory && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedCategory && styles.filterChipTextActive,
                ]}
              >
                {t("All", "すべて")}
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  selectedCategory === cat && styles.filterChipActive,
                ]}
                onPress={() =>
                  setSelectedCategory(selectedCategory === cat ? null : cat)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCategory === cat && styles.filterChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {filteredSets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t(
                "No published question sets yet",
                "公開されている問題集はまだありません"
              )}
            </Text>
          </View>
        ) : (
          filteredSets.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                { padding: isSmallScreen ? 12 : 16 },
              ]}
              onPress={() =>
                router.push(`/(app)/question-sets/${item.id}`)
              }
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.cardTitle,
                    { fontSize: isSmallScreen ? 16 : 18 },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.price === 0 ? (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>
                      {t("Free", "無料")}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>
                      ¥{item.price.toLocaleString()}
                    </Text>
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
                <Text style={styles.cardLang}>
                  {contentLanguageDisplayLabel(item.content_language, t)}
                </Text>
                <Text style={styles.cardQuestions}>
                  {t(
                    `${item.total_questions} questions`,
                    `${item.total_questions} 問`
                  )}
                </Text>
                {item.total_purchases > 0 && (
                  <Text style={styles.cardPurchases}>
                    {t(
                      `${item.total_purchases} purchased`,
                      `${item.total_purchases} 件購入`
                    )}
                  </Text>
                )}
              </View>

              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {item.tags.slice(0, 3).map((tag, i) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.backFab}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text style={styles.backFabText}>&larr;</Text>
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
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  pageTitle: {
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#007AFF",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  freeBadge: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  freeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  priceBadge: {
    backgroundColor: "#FF9500",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  cardCategory: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  cardLang: {
    fontSize: 13,
    color: "#5856D6",
    fontWeight: "600",
  },
  cardQuestions: {
    fontSize: 13,
    color: "#666",
  },
  cardPurchases: {
    fontSize: 13,
    color: "#888",
    marginLeft: "auto",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  backFab: {
    position: "absolute",
    left: 16,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    }),
    elevation: 6,
  },
  backFabText: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
  },
});
