import React, { useState, useEffect } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";
import Header from "../../src/components/Header";
import { authApi } from "../../src/api/auth";
import { answersApi, UserStats } from "../../src/api/answers";
import {
  questionSetsApi,
  QuestionSet,
  contentLanguageDisplayLabel,
} from "../../src/api/questionSets";
import { paymentsApi, Purchase } from "../../src/api/payments";
import apiClient from "../../src/api/client";

interface AnswerHistory {
  id: string;
  question_id: string;
  question_text: string;
  question_set_title: string;
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  answered_at: string;
}

export default function MyPageScreen() {
  const { user, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentAnswers, setRecentAnswers] = useState<AnswerHistory[]>([]);
  const [myQuestionSets, setMyQuestionSets] = useState<QuestionSet[]>([]);
  const [purchasedQuestionSets, setPurchasedQuestionSets] = useState<
    QuestionSet[]
  >([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 編集モーダル用のstate
  const [showEditUsernameModal, setShowEditUsernameModal] = useState(false);
  const [editingUsername, setEditingUsername] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user && isAuthenticated) {
      loadData();
    }
  }, [user, isAuthenticated]);

  const loadData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      // 並列でデータを取得
      const [userData, statsData, answersResponse, purchasedData] =
        await Promise.all([
          authApi.getCurrentUser(),
          answersApi.getUserStats(user.id).catch(() => null),
          answersApi.getAnswerHistory(user.id).catch(() => []),
          questionSetsApi.getPurchased().catch(() => []),
        ]);

      setUserInfo(userData);

      // 販売者の場合のみ問題集を取得
      let mySetsData: QuestionSet[] = [];
      if (userData?.is_seller) {
        try {
          mySetsData = await questionSetsApi.getMy();
        } catch (error) {
          console.error("[MyPage] Failed to load my question sets:", error);
        }
      }

      // 統計データのフィールド名を変換
      if (statsData) {
        setStats({
          user_id: user.id,
          total_answers: statsData.total_attempts || 0,
          correct_answers: statsData.correct_count || 0,
          accuracy_rate: statsData.correct_rate || 0,
          average_answer_time: statsData.avg_time_sec || 0,
          total_study_time: 0,
          categories_studied: 0,
          last_activity: null,
        });
      }
      // 回答履歴はシンプルに表示（問題文などは後で取得可能）
      const answers = Array.isArray(answersResponse)
        ? answersResponse
        : (answersResponse as any)?.answers || [];
      setRecentAnswers(
        answers.slice(0, 10).map((answer: any) => ({
          id: answer.id,
          question_id: answer.question_id,
          question_text:
            answer.question?.question_text || t("Question", "問題"),
          question_set_title:
            answer.question?.question_set?.title || t("Unknown", "不明"),
          user_answer: answer.user_answer,
          is_correct: answer.is_correct,
          answer_time_sec: answer.answer_time_sec || 0,
          answered_at: answer.answered_at,
        }))
      );
      setMyQuestionSets(mySetsData.slice(0, 5));
      setPurchasedQuestionSets(purchasedData.slice(0, 5));
    } catch (error: any) {
      console.error("[MyPage] Failed to load data:", error);
      setErrorMessage(
        t(
          "Failed to load profile data",
          "プロフィールデータの読み込みに失敗しました"
        )
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleEditUsername = () => {
    if (!userInfo) return;
    setEditingUsername(userInfo.full_name || "");
    setShowEditUsernameModal(true);
  };

  const handleSaveUsername = async () => {
    if (!editingUsername.trim()) {
      setErrorMessage(
        t("Username cannot be empty", "ユーザー名は空にできません")
      );
      return;
    }

    if (editingUsername.length > 50) {
      setErrorMessage(
        t(
          "Username must be 50 characters or less",
          "ユーザー名は50文字以下である必要があります"
        )
      );
      return;
    }

    setIsUpdatingUsername(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiClient.put("/auth/me", null, {
        params: { username: editingUsername.trim() },
      });
      setSuccessMessage(
        t("Username updated successfully", "ユーザー名を更新しました")
      );
      setShowEditUsernameModal(false);
      await loadData(); // データを再読み込み
    } catch (error: any) {
      console.error("[MyPage] Failed to update username:", error);
      setErrorMessage(
        error.response?.data?.detail ||
          t("Failed to update username", "ユーザー名の更新に失敗しました")
      );
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("[MyPage] Logout failed:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (language === "ja") {
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    if (language === "ja") {
      return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRoleLabel = (role: string, isSeller: boolean) => {
    if (role === "admin" || role === "super_admin") {
      return t("Administrator", "管理者");
    }
    if (isSeller) {
      return t("Seller", "販売者");
    }
    return t("User", "一般ユーザー");
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? "#4CAF50" : "#F44336";
  };

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? t("Active", "有効") : t("Inactive", "無効");
  };

  if (authLoading || (isLoading && !isRefreshing)) {
    return (
      <View style={styles.wrapper}>
        <Header title={t("My Profile", "マイページ")} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // リダイレクト中
  }

  if (!userInfo) {
    return (
      <View style={styles.wrapper}>
        <Header title={t("My Profile", "マイページ")} />
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            {t("User not found", "ユーザーが見つかりません")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Header title={t("My Profile", "マイページ")} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* エラーメッセージ */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* 成功メッセージ */}
        {successMessage ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* 基本情報セクション */}
        <View
          style={[
            styles.section,
            {
              margin: isSmallScreen ? 12 : 15,
              padding: isSmallScreen ? 16 : 20,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}
          >
            {t("Basic Information", "基本情報")}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t("Username", "ユーザー名")}:</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue}>{userInfo.full_name || "-"}</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditUsername}
                testID="edit-username-button"
              >
                <Text style={styles.editButtonText}>{t("Edit", "編集")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t("Email", "メールアドレス")}:
            </Text>
            <Text style={styles.infoValue}>{userInfo.email || "-"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t("Account Created", "アカウント作成日")}:
            </Text>
            <Text style={styles.infoValue}>
              {userInfo.created_at ? formatDate(userInfo.created_at) : "-"}
            </Text>
          </View>
        </View>

        {/* アカウントステータスセクション */}
        <View
          style={[
            styles.section,
            {
              margin: isSmallScreen ? 12 : 15,
              padding: isSmallScreen ? 16 : 20,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}
          >
            {t("Account Status", "アカウントステータス")}
          </Text>

          <View style={styles.badgesContainer}>
            <View
              style={[
                styles.badge,
                { backgroundColor: getStatusBadgeColor(userInfo.is_active) },
              ]}
            >
              <Text style={styles.badgeText}>
                {getStatusLabel(userInfo.is_active)}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: "#007AFF" }]}>
              <Text style={styles.badgeText}>
                {getRoleLabel(
                  userInfo.role || "user",
                  userInfo.is_seller || false
                )}
              </Text>
            </View>

            {userInfo.is_premium ? (
              <View>
                <View style={[styles.badge, { backgroundColor: "#FF9800" }]}>
                  <Text style={styles.badgeText}>
                    {t("Premium", "プレミアム")}
                    {userInfo.premium_expires_at
                      ? ` (${formatDate(userInfo.premium_expires_at)})`
                      : ""}
                  </Text>
                </View>
                {(userInfo.account_credit_jpy ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#007AFF", marginTop: 6 }]}>
                    <Text style={styles.badgeText}>
                      {t("Credit", "クレジット")}: ¥{(userInfo.account_credit_jpy ?? 0).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.badge, styles.upgradeBadge]}
                onPress={() => router.push("/(app)/premium-upgrade")}
                testID="upgrade-premium-button"
              >
                <Text style={styles.badgeText}>
                  {t("Upgrade to Premium", "プレミアムにアップグレード")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {userInfo.is_seller && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(app)/seller-dashboard")}
              testID="seller-dashboard-button"
            >
              <Text style={styles.actionButtonText}>
                {t("Seller Dashboard", "販売者ダッシュボード")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 学習統計セクション */}
        {stats && (
          <View
            style={[
              styles.section,
              {
                margin: isSmallScreen ? 12 : 15,
                padding: isSmallScreen ? 16 : 20,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                {t("Learning Statistics", "学習統計")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/stats")}
                testID="view-stats-button"
              >
                <Text style={styles.linkText}>
                  {t("View Details", "詳細を見る")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total_answers || 0}</Text>
                <Text style={styles.statLabel}>
                  {t("Total Answers", "総回答数")}
                </Text>
              </View>

              <View style={[styles.statCard, styles.successCard]}>
                <Text style={[styles.statValue, styles.statSuccessText]}>
                  {stats.correct_answers || 0}
                </Text>
                <Text style={styles.statLabel}>
                  {t("Correct Answers", "正答数")}
                </Text>
              </View>

              <View style={[styles.statCard, styles.accuracyCard]}>
                <Text style={[styles.statValue, styles.statAccuracyText]}>
                  {stats.accuracy_rate > 0
                    ? (stats.accuracy_rate * 100).toFixed(1)
                    : "0.0"}
                  %
                </Text>
                <Text style={styles.statLabel}>
                  {t("Accuracy Rate", "正答率")}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {stats.average_answer_time
                    ? formatTime(stats.average_answer_time)
                    : "0:00"}
                </Text>
                <Text style={styles.statLabel}>
                  {t("Average Time", "平均回答時間")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 最近の学習履歴セクション */}
        {recentAnswers.length > 0 && (
          <View
            style={[
              styles.section,
              {
                margin: isSmallScreen ? 12 : 15,
                padding: isSmallScreen ? 16 : 20,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                {t("Recent Learning History", "最近の学習履歴")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/stats")}
                testID="view-history-button"
              >
                <Text style={styles.linkText}>
                  {t("View All", "すべて見る")}
                </Text>
              </TouchableOpacity>
            </View>

            {recentAnswers.slice(0, 5).map((answer) => (
              <View key={answer.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyQuestionSet} numberOfLines={1}>
                    {answer.question_set_title || t("Unknown", "不明")}
                  </Text>
                  <View
                    style={[
                      styles.historyStatusBadge,
                      answer.is_correct
                        ? styles.correctBadge
                        : styles.incorrectBadge,
                    ]}
                  >
                    <Text style={styles.historyStatusText}>
                      {answer.is_correct ? "○" : "×"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyQuestion} numberOfLines={2}>
                  {answer.question_text}
                </Text>
                <Text style={styles.historyMeta}>
                  {formatDateTime(answer.answered_at)} •{" "}
                  {formatTime(answer.answer_time_sec)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 作成した問題集セクション（販売者の場合） */}
        {userInfo.is_seller && myQuestionSets.length > 0 && (
          <View
            style={[
              styles.section,
              {
                margin: isSmallScreen ? 12 : 15,
                padding: isSmallScreen ? 16 : 20,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: isSmallScreen ? 18 : 20 },
                ]}
              >
                {t("My Question Sets", "作成した問題集")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/seller-dashboard")}
                testID="view-my-questions-button"
              >
                <Text style={styles.linkText}>
                  {t("View All", "すべて見る")}
                </Text>
              </TouchableOpacity>
            </View>

            {myQuestionSets.map((qs) => (
              <TouchableOpacity
                key={qs.id}
                style={styles.questionSetItem}
                onPress={() => router.push(`/(app)/question-sets/${qs.id}`)}
                testID={`question-set-${qs.id}`}
              >
                <Text style={styles.questionSetTitle}>{qs.title}</Text>
                <Text style={styles.questionSetMeta}>
                  {contentLanguageDisplayLabel(qs.content_language, t)} •{" "}
                  {qs.total_questions || 0} {t("questions", "問")} • ¥
                  {qs.price || 0} • {qs.total_purchases || 0}{" "}
                  {t("sales", "販売")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 購入した問題集セクション */}
        {purchasedQuestionSets.length > 0 && (
          <View
            style={[
              styles.section,
              {
                margin: isSmallScreen ? 12 : 15,
                padding: isSmallScreen ? 16 : 20,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: isSmallScreen ? 18 : 20 },
              ]}
            >
              {t("Purchased Question Sets", "購入した問題集")}
            </Text>

            {purchasedQuestionSets.map((qs) => (
              <TouchableOpacity
                key={qs.id}
                style={styles.questionSetItem}
                onPress={() => router.push(`/(app)/question-sets/${qs.id}`)}
                testID={`purchased-set-${qs.id}`}
              >
                <Text style={styles.questionSetTitle}>{qs.title}</Text>
                <Text style={styles.questionSetMeta}>
                  {contentLanguageDisplayLabel(qs.content_language, t)} •{" "}
                  {qs.total_questions || 0} {t("questions", "問")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* クイックアクションセクション */}
        <View
          style={[
            styles.section,
            {
              margin: isSmallScreen ? 12 : 15,
              padding: isSmallScreen ? 16 : 20,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}
          >
            {t("Quick Actions", "クイックアクション")}
          </Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(app)/settings")}
            testID="settings-button"
          >
            <Text style={styles.actionButtonText}>{t("Settings", "設定")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(app)/stats")}
            testID="stats-button"
          >
            <Text style={styles.actionButtonText}>
              {t("Detailed Statistics", "詳細統計")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
            testID="logout-button"
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              {t("Logout", "ログアウト")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ユーザー名編集モーダル */}
        <Modal
          visible={showEditUsernameModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowEditUsernameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  width: isSmallScreen ? "95%" : "90%",
                  maxWidth: isSmallScreen ? 400 : 500,
                  padding: isSmallScreen ? 20 : 25,
                },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { fontSize: isSmallScreen ? 20 : 22 },
                ]}
              >
                {t("Edit Username", "ユーザー名を編集")}
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    padding: isSmallScreen ? 10 : 12,
                    fontSize: isSmallScreen ? 15 : 16,
                  },
                ]}
                placeholder={t("Username", "ユーザー名")}
                value={editingUsername}
                onChangeText={setEditingUsername}
                maxLength={50}
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowEditUsernameModal(false);
                    setEditingUsername("");
                    setErrorMessage("");
                  }}
                  disabled={isUpdatingUsername}
                >
                  <Text style={styles.modalButtonText}>
                    {t("Cancel", "キャンセル")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveUsername}
                  disabled={isUpdatingUsername || !editingUsername.trim()}
                >
                  {isUpdatingUsername ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {t("Save", "保存")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    margin: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  successText: {
    color: "#2E7D32",
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    margin: 15,
    padding: 20,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 2,
    textAlign: "right",
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 2,
    justifyContent: "flex-end",
  },
  editButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  upgradeBadge: {
    backgroundColor: "#FF9800",
  },
  actionButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#F44336",
    marginTop: 10,
  },
  logoutButtonText: {
    color: "#fff",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  successCard: {
    backgroundColor: "#E8F5E9",
  },
  accuracyCard: {
    backgroundColor: "#E3F2FD",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statSuccessText: {
    color: "#2E7D32",
  },
  statAccuracyText: {
    color: "#1976D2",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 12,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyQuestionSet: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "600",
    flex: 1,
  },
  historyStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  correctBadge: {
    backgroundColor: "#4CAF50",
  },
  incorrectBadge: {
    backgroundColor: "#F44336",
  },
  historyStatusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  historyQuestion: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 12,
    color: "#999",
  },
  questionSetItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 12,
    marginBottom: 12,
  },
  questionSetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  questionSetMeta: {
    fontSize: 12,
    color: "#666",
  },
  linkText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 25,
    width: "90%",
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#757575",
  },
  modalButtonSave: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
