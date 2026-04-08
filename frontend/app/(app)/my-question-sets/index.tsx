import React, { useState, useEffect, useMemo, useCallback } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
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
  TextInput,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  questionSetsApi,
  QuestionSet,
  QuestionSetWithQuestions,
  LanguageFilter,
  contentLanguagesDisplayLabel,
  questionSetMatchesLanguageFilter,
  contentLanguageDisplayLabel,
} from "../../../src/api/questionSets";
import { questionsApi } from "../../../src/api/questions";
import {
  getAvailableTextbooks,
  Textbook,
} from "../../../src/services/textbookService";
import {
  localStorageService,
  LocalQuestionSet,
} from "../../../src/services/localStorageService";
import { loadDefaultQuestionSets } from "../../../src/data/defaultQuestionSets";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import AdBanner from "../../../src/components/AdBanner";
import FeedbackModal from "../../../src/components/FeedbackModal";
import Modal from "../../../src/components/Modal";
import { srsService } from "../../../src/services/srsService";

export default function MyQuestionSetsScreen() {
  const [myQuestionSets, setMyQuestionSets] = useState<QuestionSet[]>([]);
  const [purchasedQuestionSets, setPurchasedQuestionSets] = useState<
    QuestionSet[]
  >([]);
  const [trialQuestionSets, setTrialQuestionSets] = useState<LocalQuestionSet[]>([]);
  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [availableTextbooks, setAvailableTextbooks] = useState<Textbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const [showDefaultSets, setShowDefaultSets] = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const val = await AsyncStorage.getItem("pref_showDefaultSets");
        if (val !== null) setShowDefaultSets(val === "true");
      } catch (_) {}
    };
    loadPrefs();
  }, []);

  const toggleShowDefaultSets = useCallback(async () => {
    const next = !showDefaultSets;
    setShowDefaultSets(next);
    await AsyncStorage.setItem("pref_showDefaultSets", String(next));
  }, [showDefaultSets]);

  useEffect(() => {
    if (user) {
      loadQuestionSets();
      return;
    }

    if (!isAuthLoading && !user) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthLoading]);

  const loadQuestionSets = async () => {
    try {
      await loadDefaultQuestionSets();

      const [myData, purchasedData, trialData, textbooksData] = await Promise.all([
        questionSetsApi.getMy(),
        questionSetsApi.getPurchased(),
        localStorageService.getTrialQuestionSets(),
        getAvailableTextbooks(),
      ]);

      setMyQuestionSets(myData);
      setPurchasedQuestionSets(purchasedData);
      setTrialQuestionSets(trialData);
      setAvailableTextbooks(textbooksData);

      const counts: Record<string, number> = {};
      for (const set of [...myData, ...purchasedData]) {
        counts[set.id] = await srsService.getDueCount(set.id);
      }
      for (const set of trialData) {
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

  const handleExportMyCSV = async (item: QuestionSet) => {
    try {
      const csvData = await questionSetsApi.exportCSV(item.id);
      const safeTitle =
        (item.title || "export").replace(/[^a-zA-Z0-9\u3000-\u9fff_-]/g, "_") || "export";
      const filename = `${safeTitle}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvData, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: t("Export CSV", "CSVをエクスポート"),
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert(t("Saved", "保存完了"), fileUri);
        }
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        t("Failed to export CSV", "CSVのエクスポートに失敗しました");
      Alert.alert(t("Error", "エラー"), msg);
    }
  };

  const handleExportTrialCSV = async (item: LocalQuestionSet) => {
    try {
      const escapeCSV = (val: string) => {
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };
      const header =
        "question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2";
      const rows = item.questions.map((q) => {
        const diffVal =
          q.difficulty === "easy" ? "0.2" : q.difficulty === "hard" ? "0.8" : "0.5";
        const questionType =
          q.question_type ||
          (q.options && q.options.length > 0
            ? "multiple_choice"
            : q.answer.trim().toLowerCase() === "true" || q.answer.trim().toLowerCase() === "false"
              ? "true_false"
              : "text_input");
        const options = q.options || [];
        return [
          escapeCSV(q.question || ""),
          questionType,
          escapeCSV(options[0] || ""),
          escapeCSV(options[1] || ""),
          escapeCSV(options[2] || ""),
          escapeCSV(options[3] || ""),
          escapeCSV(q.answer || ""),
          escapeCSV(q.explanation || ""),
          diffVal,
          escapeCSV(q.category || ""),
          escapeCSV(q.subcategory1 || ""),
          escapeCSV(q.subcategory2 || ""),
        ].join(",");
      });
      const csvData = "\ufeff" + header + "\n" + rows.join("\n");
      const safeTitle =
        (item.title || "export").replace(/[^a-zA-Z0-9\u3000-\u9fff_-]/g, "_") || "export";
      const filename = `${safeTitle}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvData, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: t("Export CSV", "CSVをエクスポート"),
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert(t("Saved", "保存完了"), fileUri);
        }
      }
    } catch (error) {
      console.error("Failed to export trial CSV:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to export CSV", "CSVのエクスポートに失敗しました")
      );
    }
  };

  // CSV import → create question set flow
  const [csvImportModalVisible, setCsvImportModalVisible] = useState(false);
  const [csvImportTitle, setCsvImportTitle] = useState("");
  const [csvImportFile, setCsvImportFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // PDF export moved to detail header screen.

  const handlePickCSVAndCreate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const suggestedTitle = (file.name || "")
        .replace(/\.csv$/i, "")
        .replace(/[_-]/g, " ")
        .trim();
      setCsvImportFile({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "text/csv",
      });
      setCsvImportTitle(suggestedTitle || "");
      setCsvImportModalVisible(true);
    } catch (error) {
      console.error("Failed to pick CSV:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to select file", "ファイルの選択に失敗しました")
      );
    }
  };

  const handleConfirmCSVImport = async () => {
    if (!csvImportFile || !csvImportTitle.trim()) return;
    setCsvImporting(true);
    try {
      const newSet = await questionSetsApi.create({
        title: csvImportTitle.trim(),
        description: "",
        category: "general",
      });
      const uploadResult = await questionsApi.bulkUploadCSV(newSet.id, {
        uri: csvImportFile.uri,
        name: csvImportFile.name,
        type: csvImportFile.mimeType,
      });
      setCsvImportModalVisible(false);
      setCsvImportFile(null);
      setCsvImportTitle("");

      const msg =
        uploadResult.total_errors > 0
          ? t(
              `Created "${newSet.title}" with ${uploadResult.total_created} questions (${uploadResult.total_errors} errors)`,
              `「${newSet.title}」を作成しました（${uploadResult.total_created}問成功、${uploadResult.total_errors}件エラー）`
            )
          : t(
              `Created "${newSet.title}" with ${uploadResult.total_created} questions!`,
              `「${newSet.title}」を${uploadResult.total_created}問で作成しました！`
            );
      Alert.alert(t("Success", "成功"), msg);
      loadQuestionSets();
    } catch (error: any) {
      console.error("Failed to create question set from CSV:", error);
      const detail =
        error?.response?.data?.detail ||
        t(
          "Failed to create question set from CSV",
          "CSVからの問題集作成に失敗しました"
        );
      Alert.alert(t("Error", "エラー"), detail);
    } finally {
      setCsvImporting(false);
    }
  };

  const filteredMyQuestionSets = useMemo(
    () =>
      myQuestionSets.filter((q) =>
        questionSetMatchesLanguageFilter(
          q.content_languages,
          q.content_language ?? null,
          languageFilter
        )
      ),
    [myQuestionSets, languageFilter]
  );

  const filteredPurchasedQuestionSets = useMemo(
    () =>
      purchasedQuestionSets.filter((q) =>
        questionSetMatchesLanguageFilter(
          q.content_languages,
          q.content_language ?? null,
          languageFilter
        )
      ),
    [purchasedQuestionSets, languageFilter]
  );

  const filteredTrialQuestionSets = useMemo(
    () =>
      trialQuestionSets
        .filter((item) =>
          showDefaultSets ? true : !item.id.startsWith("default_")
        )
        .filter((item) =>
          questionSetMatchesLanguageFilter(
            item.content_languages,
            item.content_language ?? null,
            languageFilter
          )
        ),
    [trialQuestionSets, showDefaultSets, languageFilter]
  );

  const filteredTextbooks = useMemo(
    () =>
      availableTextbooks.filter(
        (tb) =>
          languageFilter === "all" || tb.language === languageFilter
      ),
    [availableTextbooks, languageFilter]
  );

  const renderLangFilterChip = (
    value: LanguageFilter,
    label: string,
    testId: string
  ) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        languageFilter === value && styles.filterChipActive,
      ]}
      onPress={() => setLanguageFilter(value)}
      testID={testId}
    >
      <Text
        style={[
          styles.filterChipText,
          languageFilter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

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
      activeOpacity={0.85}
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
        <Text style={styles.cardLang}>
          {contentLanguagesDisplayLabel(
            item.content_languages,
            item.content_language,
            t
          )}
        </Text>
        <Text style={styles.cardQuestions}>
          {t(`${item.total_questions} questions`, `${item.total_questions} 問`)}
        </Text>
        {item.price > 0 && <Text style={styles.cardPrice}>¥{item.price}</Text>}
      </View>
      {item.total_questions > 0 && (
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.csvExportBadge}
            onPress={() => handleExportMyCSV(item)}
            testID={`csv-export-btn-${item.id}`}
          >
            <Text style={styles.csvExportBadgeText}>
              ⤓ {t("CSV", "CSV")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
          <Text style={styles.cardLang}>
            {contentLanguagesDisplayLabel(
              item.content_languages,
              item.content_language,
              t
            )}
          </Text>
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
          ⤓ {t("Download for Offline", "オフラインでダウンロード")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTrialQuestionSetItem = ({ item }: { item: LocalQuestionSet }) => (
    <View
      style={[
        styles.card,
        {
          padding: isSmallScreen ? 12 : 16,
          marginBottom: isSmallScreen ? 10 : 12,
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.push(`/(trial)/set/${item.id}`)}
        testID={`trial-qs-card-${item.id}`}
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
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>
              {t("Trial Mode", "お試しモード")}
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardCategory}>
            {contentLanguagesDisplayLabel(
              item.content_languages,
              item.content_language,
              t
            )}
          </Text>
          <Text style={styles.cardQuestions}>
            {t(`${item.questions.length} questions`, `${item.questions.length} 問`)}
          </Text>
        </View>
      </TouchableOpacity>
      {item.questions.length > 0 && (
        <TouchableOpacity
          style={styles.csvExportBadge}
          onPress={() => handleExportTrialCSV(item)}
          testID={`csv-export-trial-btn-${item.id}`}
        >
          <Text style={styles.csvExportBadgeText}>
            ⤓ {t("CSV", "CSV")}
          </Text>
        </TouchableOpacity>
      )}
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
        {" · "}
        {contentLanguageDisplayLabel(item.language, t)}
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

        <View style={styles.filterRow} nativeID="my-qs-lang-filter">
          {renderLangFilterChip(
            "all",
            t("All languages", "すべて"),
            "my-qs-filter-all"
          )}
          {renderLangFilterChip(
            "ja",
            t("Japanese", "日本語"),
            "my-qs-filter-ja"
          )}
          {renderLangFilterChip("en", "English", "my-qs-filter-en")}
        </View>

        {trialQuestionSets.length > 0 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                showDefaultSets && styles.filterChipActive,
              ]}
              onPress={toggleShowDefaultSets}
              testID="my-qs-toggle-default-sets"
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
          </View>
        )}

        {/* My Question Sets Section */}
        <View style={styles.section} nativeID="my-qs-section">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20, marginBottom: 0 }]}>
              {t("My Question Sets", "マイ問題集")}
            </Text>
            <TouchableOpacity
              style={styles.csvImportButton}
              onPress={handlePickCSVAndCreate}
            >
              <Text style={styles.csvImportButtonText}>
                {t("CSV Import", "CSV取込")}
              </Text>
            </TouchableOpacity>
          </View>
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
          ) : filteredMyQuestionSets.length === 0 ? (
            <View style={styles.emptyContainer} nativeID="my-qs-filter-empty">
              <Text style={styles.emptyText}>
                {t(
                  "No question sets match this language filter",
                  "この言語に一致する問題集がありません"
                )}
              </Text>
            </View>
          ) : (
            filteredMyQuestionSets.map((item) => (
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
            {filteredPurchasedQuestionSets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {t(
                    "No purchased sets match this language filter",
                    "この言語に一致する購入済み問題集がありません"
                  )}
                </Text>
              </View>
            ) : (
              filteredPurchasedQuestionSets.map((item) => (
                <View key={item.id}>{renderPurchasedItem({ item })}</View>
              ))
            )}
          </View>
        )}

        {/* Trial / Default Question Sets Section */}
        {trialQuestionSets.length > 0 && (
          <View style={styles.section} nativeID="trial-qs-section">
            <Text style={[styles.sectionTitle, { fontSize: isSmallScreen ? 18 : 20 }]}>
              {t("Trial Question Sets", "お試し問題セット")}
            </Text>
            {filteredTrialQuestionSets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {t(
                    "No trial sets match this filter",
                    "この条件に一致するお試し問題セットがありません"
                  )}
                </Text>
              </View>
            ) : (
              filteredTrialQuestionSets.map((item) => (
                <View key={item.id}>{renderTrialQuestionSetItem({ item })}</View>
              ))
            )}
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
          ) : filteredTextbooks.length === 0 ? (
            <View style={styles.emptyContainer} nativeID="textbooks-filter-empty">
              <Text style={styles.emptyText}>
                {t(
                  "No textbooks match this language filter",
                  "この言語に一致する教科書がありません"
                )}
              </Text>
            </View>
          ) : (
            filteredTextbooks.map((item) => (
              <View key={item.path}>{renderTextbookItem({ item })}</View>
            ))
          )}
        </View>

        {/* Feedback Section */}
        <TouchableOpacity
          style={styles.feedbackBanner}
          onPress={() => setShowFeedbackModal(true)}
          testID="my-qs-feedback-banner"
        >
          <Text style={styles.feedbackBannerTitle}>
            {t("Review & Feedback", "レビュー・ご要望")}
          </Text>
          <Text style={styles.feedbackBannerText}>
            {t(
              "Help us improve! Share your review or feature requests",
              "アプリの改善にご協力ください！レビューや機能リクエストをお寄せください"
            )}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={navigateToCreateQuestionSet}
        testID="my-qs-fab-create"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={csvImportModalVisible}
        title={t("Create from CSV", "CSVから問題集を作成")}
        onClose={() => {
          setCsvImportModalVisible(false);
          setCsvImportFile(null);
          setCsvImportTitle("");
        }}
      >
        <View style={styles.csvImportModalContent}>
          <Text style={styles.csvImportFileName}>
            {csvImportFile?.name}
          </Text>
          <Text style={styles.csvImportLabel}>
            {t("Question Set Title", "問題集のタイトル")}
          </Text>
          <TextInput
            style={styles.csvImportInput}
            value={csvImportTitle}
            onChangeText={setCsvImportTitle}
            placeholder={t("Enter title", "タイトルを入力")}
            autoFocus
          />
          <View style={styles.csvImportActions}>
            <TouchableOpacity
              style={styles.csvImportCancelButton}
              onPress={() => {
                setCsvImportModalVisible(false);
                setCsvImportFile(null);
                setCsvImportTitle("");
              }}
            >
              <Text style={styles.csvImportCancelText}>
                {t("Cancel", "キャンセル")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.csvImportConfirmButton,
                (!csvImportTitle.trim() || csvImporting) &&
                  styles.csvImportConfirmDisabled,
              ]}
              onPress={handleConfirmCSVImport}
              disabled={!csvImportTitle.trim() || csvImporting}
            >
              {csvImporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.csvImportConfirmText}>
                  {t("Create", "作成")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
    }),
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 8,
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
  trialBadge: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trialBadgeText: {
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
  cardLang: {
    fontSize: 13,
    color: "#5856D6",
    fontWeight: "600",
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  csvImportButton: {
    backgroundColor: "#FF9500",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  csvImportButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  csvImportModalContent: {
    padding: 4,
  },
  csvImportFileName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  csvImportLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  csvImportInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  csvImportActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  csvImportCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  csvImportCancelText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
  },
  csvImportConfirmButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  csvImportConfirmDisabled: {
    backgroundColor: "#B0B0B0",
  },
  csvImportConfirmText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  csvExportBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  csvExportBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  feedbackBanner: {
    backgroundColor: "#5A67D8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  feedbackBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  feedbackBannerText: {
    fontSize: 13,
    color: "#fff",
    opacity: 0.9,
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
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    }),
    elevation: 6,
  },
  fabText: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "300",
  },
});






