import React, { useCallback, useEffect, useState } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";
import Header from "../../src/components/Header";
import AdBanner from "../../src/components/AdBanner";
import { aiApi, CategoryPrediction, ImprovementSuggestion } from "../../src/api/ai";
import { answersApi } from "../../src/api/answers";

type SummaryStats = {
  total: number;
  correct: number;
  correctRate: number;
  avgTimeSec: number;
};

function normalizeStatsPayload(data: Record<string, unknown> | null): SummaryStats {
  if (!data) {
    return { total: 0, correct: 0, correctRate: 0, avgTimeSec: 0 };
  }
  const total = Number(data.total_attempts ?? data.total_answers ?? 0) || 0;
  const correct = Number(data.correct_count ?? data.correct_answers ?? 0) || 0;
  const correctRate =
    typeof data.correct_rate === "number"
      ? data.correct_rate
      : total > 0
        ? correct / total
        : 0;
  const avgTimeSec = Number(data.avg_time_sec ?? data.average_answer_time ?? 0) || 0;
  return { total, correct, correctRate, avgTimeSec };
}

export default function AIDashboardScreen() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmall = width < 600;

  const [categoryPredictions, setCategoryPredictions] = useState<CategoryPrediction[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    setErrorMessage(null);
    try {
      const [predictions, improvementSuggestions, statsRes] = await Promise.all([
        aiApi.getCategoryPredictions(user.id),
        aiApi.getImprovementSuggestions(user.id),
        answersApi.getUserStats(user.id).catch(() => null),
      ]);

      const listPred = Array.isArray(predictions)
        ? predictions
        : predictions
          ? Object.entries(predictions as Record<string, CategoryPrediction>).map(([category, rest]) => ({
              category,
              ...(typeof rest === "object" && rest !== null ? rest : {}),
            }))
          : [];

      setCategoryPredictions(listPred as CategoryPrediction[]);

      const rawSug = improvementSuggestions as unknown as Record<string, unknown>[];
      setSuggestions(
        rawSug.map((s) => {
          const pri = s.priority;
          let priorityNum = 5;
          if (typeof pri === "number") priorityNum = pri;
          else if (pri === "high") priorityNum = 9;
          else if (pri === "medium") priorityNum = 6;
          else if (pri === "low") priorityNum = 3;
          return {
            category: String(s.category ?? ""),
            suggestion: String(s.suggestion ?? s.message ?? ""),
            priority: priorityNum,
          };
        })
      );
      setSummary(normalizeStatsPayload(statsRes as Record<string, unknown> | null));
    } catch (e) {
      console.error("Failed to load AI dashboard:", e);
      setErrorMessage(
        t("Could not load AI insights. Pull to retry.", "AIの分析を読み込めませんでした。引っ張って再試行してください。")
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user, loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (authLoading || (isLoading && !errorMessage)) {
    return (
      <View style={styles.screen}>
        <Header title={t("AI Dashboard", "AIダッシュボード")} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.muted}>{t("Loading...", "読み込み中...")}</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.screen}>
        <Header title={t("AI Dashboard", "AIダッシュボード")} />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>{t("Please sign in to view AI insights.", "ログインするとAIの分析を表示できます。")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t("AI Dashboard", "AIダッシュボード")} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.lead}>
          {t(
            "Personalized insights from your answer history and category stats.",
            "回答履歴とカテゴリ別の統計から、あなた向けの見解を表示します。"
          )}
        </Text>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {summary && summary.total > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("Overview", "全体サマリー")}</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("Total answers", "累計解答")}</Text>
                <Text style={styles.summaryValue}>{summary.total}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("Correct", "正解")}</Text>
                <Text style={styles.summaryValue}>{summary.correct}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("Accuracy", "正答率")}</Text>
                <Text style={styles.summaryValue}>
                  {(summary.correctRate * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t("Avg. time (sec)", "平均時間（秒）")}</Text>
                <Text style={styles.summaryValue}>{summary.avgTimeSec.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Score predictions by category", "カテゴリ別の予測スコア")}
          </Text>
          {categoryPredictions.length > 0 ? (
            categoryPredictions.map((prediction, index) => {
              const maxScore = prediction.max_score > 0 ? prediction.max_score : 100;
              const ratio = Math.min(1, Math.max(0, prediction.predicted_score / maxScore));
              return (
                <View key={`${prediction.category}-${index}`} style={styles.predictionCard}>
                  <View style={styles.predictionHeader}>
                    <Text style={[styles.categoryName, isSmall && styles.categoryNameSmall]}>
                      {prediction.category}
                    </Text>
                    <Text style={styles.scoreText}>
                      {prediction.predicted_score.toFixed(0)}/{maxScore}
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${ratio * 100}%` }]} />
                  </View>
                  <Text style={styles.confidenceText}>
                    {t("Confidence", "信頼度")}: {(prediction.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t(
                  "No category predictions yet. Answer more questions to see AI insights!",
                  "まだカテゴリ別の予測がありません。問題に答えるとAIの分析が表示されます。"
                )}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Improvement suggestions", "学習の提案")}</Text>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <View key={`${suggestion.category}-${index}`} style={styles.suggestionCard}>
                <View style={styles.suggestionHeader}>
                  <Text style={styles.suggestionCategory}>
                    {suggestion.category?.trim()
                      ? suggestion.category
                      : t("Study pace", "学習ペース")}
                  </Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor:
                          suggestion.priority >= 8 ? "#FF3B30" : suggestion.priority >= 5 ? "#FF9500" : "#34C759",
                      },
                    ]}
                  >
                    <Text style={styles.priorityText}>P{suggestion.priority}</Text>
                  </View>
                </View>
                <Text style={styles.suggestionText}>{suggestion.suggestion}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t(
                  "No suggestions yet. Keep practicing for personalized tips!",
                  "まだ提案がありません。学習を続けるとパーソナライズされたヒントが表示されます。"
                )}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("AI features", "AI機能について")}</Text>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t("Adaptive learning", "適応型学習")}</Text>
            <Text style={styles.featureDescription}>
              {t(
                "Difficulty and recommendations adapt based on your performance.",
                "成績に応じて難易度やおすすめ問題が調整されます。"
              )}
            </Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t("Smart recommendations", "スマート推薦")}</Text>
            <Text style={styles.featureDescription}>
              {t(
                "Get question picks that target weak areas efficiently.",
                "苦手分野を効率よくつかむ問題の選出ができます。"
              )}
            </Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t("Score prediction", "スコア予測")}</Text>
            <Text style={styles.featureDescription}>
              {t(
                "See estimated scores by category from your practice history.",
                "練習履歴から、カテゴリごとの想定スコアの目安を表示します。"
              )}
            </Text>
          </View>
        </View>

        <AdBanner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  muted: {
    marginTop: 12,
    color: "#666",
    fontSize: 15,
  },
  lead: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 8,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFEBEE",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  summaryLabel: {
    fontSize: 15,
    color: "#555",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  predictionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  predictionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  categoryNameSmall: {
    fontSize: 16,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#007AFF",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: "#666",
  },
  suggestionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  suggestionCategory: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  suggestionText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  featureCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});
