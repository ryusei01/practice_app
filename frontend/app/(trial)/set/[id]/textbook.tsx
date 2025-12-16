import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLanguage } from "../../../../src/contexts/LanguageContext";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { localStorageService } from "../../../../src/services/localStorageService";
import Header from "../../../../src/components/Header";
import {
  normalizeTextbookPath,
  normalizeTextbookType,
} from "../../../../src/services/textbookService";
import { translateTextbook } from "../../../../src/api/translate";
import { TouchableOpacity } from "react-native";

export default function TrialTextbookScreen() {
  console.log("[Textbook] Component rendering");
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log("[Textbook] useLocalSearchParams id:", id);
  const { t, language } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [textbookType, setTextbookType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const isMarkdown =
    normalizeTextbookType(textbookType, "markdown") === "markdown";

  useEffect(() => {
    console.log(
      "[Textbook] useEffect triggered, loading textbook with id:",
      id
    );
    console.log(
      "[Textbook] loadTextbook function exists:",
      typeof loadTextbook
    );
    const load = async () => {
      try {
        console.log("[Textbook] About to call loadTextbook");
        await loadTextbook();
        console.log("[Textbook] loadTextbook call completed");
      } catch (err) {
        console.error("[Textbook] Error in useEffect loadTextbook:", err);
      }
    };
    load();
  }, [id]);

  const loadTextbook = async () => {
    console.log("[Textbook] loadTextbook called with id:", id);
    try {
      setLoading(true);
      setError(null);

      console.log("[Textbook] Fetching question set from localStorage...");
      const questionSet = await localStorageService.getTrialQuestionSet(
        id || ""
      );
      console.log("[Textbook] Question set fetched:", {
        exists: !!questionSet,
        textbook_path: questionSet?.textbook_path,
        textbook_type: questionSet?.textbook_type,
      });

      if (!questionSet || !questionSet.textbook_path) {
        console.log("[Textbook] No textbook available");
        setError(t("No textbook available", "教科書が設定されていません"));
        setLoading(false);
        return;
      }

      const resolvedType = normalizeTextbookType(
        questionSet.textbook_type,
        "markdown"
      );
      console.log("[Textbook] Resolved type:", {
        originalType: questionSet.textbook_type,
        resolvedType,
      });
      setTextbookType(resolvedType);

      // パスを正規化（英語名を日本語名に変換）
      const normalizedPath = normalizeTextbookPath(questionSet.textbook_path);
      console.log("[Textbook] Normalized path:", {
        originalPath: questionSet.textbook_path,
        normalizedPath,
      });

      if (resolvedType === "markdown") {
        // Markdownファイルを読み込む
        console.log("[Textbook] Loading markdown file...");
        await loadMarkdown(normalizedPath);
      } else if (resolvedType === "pdf") {
        // PDFファイルのパスを設定
        console.log("[Textbook] Setting PDF path:", {
          path: normalizedPath,
          length: normalizedPath.length,
        });
        setContent(normalizedPath);
        setOriginalContent(normalizedPath);
      } else {
        // デフォルトはmarkdownとして扱う
        await loadMarkdown(normalizedPath);
      }
    } catch (err) {
      console.error("[Textbook] Failed to load textbook:", err);
      setError(t("Failed to load textbook", "教科書の読み込みに失敗しました"));
    } finally {
      console.log("[Textbook] loadTextbook finished, setting loading to false");
      setLoading(false);
    }
  };

  const loadMarkdown = async (path: string) => {
    console.log("[Textbook] loadMarkdown called with path:", path);
    try {
      // パスがURLの場合
      if (path.startsWith("http://") || path.startsWith("https://")) {
        const response = await fetch(path);
        const text = await response.text();
        console.log("[Textbook] Loaded from HTTP/HTTPS URL:", {
          path,
          textLength: text.length,
          textPreview: text.substring(0, 100),
        });
        setContent(text);
        setOriginalContent(text);
        return;
      }

      // ローカルファイルの場合
      if (path.startsWith("file://")) {
        const fileContent = await FileSystem.readAsStringAsync(path);
        setContent(fileContent);
        setOriginalContent(fileContent);
        return;
      }

      // 相対パスの場合（docs/textbook/など）
      // バックエンドAPIからファイルを取得
      let apiBaseUrl =
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
      // /api/v1が既に含まれている場合は削除
      if (apiBaseUrl.endsWith("/api/v1")) {
        apiBaseUrl = apiBaseUrl.replace("/api/v1", "");
      }
      const fileUrl = `${apiBaseUrl}/api/v1/textbooks/${encodeURIComponent(
        path
      )}`;

      try {
        const response = await fetch(fileUrl);
        if (response.ok) {
          const text = await response.text();
          console.log("[Textbook] Loaded from API:", {
            fileUrl,
            textLength: text.length,
            textPreview: text.substring(0, 100),
          });
          setContent(text);
          setOriginalContent(text);
          return;
        }
      } catch (fetchErr) {
        console.error("Failed to fetch from API:", fetchErr);
        // 接続エラーの場合、フォールバック処理を試す
      }

      // フォールバック: 直接パスから読み込む（開発環境用）
      if (Platform.OS === "web") {
        try {
          // Web版の場合、docs/textbook/から直接読み込む
          const fallbackPath = `/docs/textbook/${encodeURIComponent(path)}`;
          console.log("[Textbook] Trying fallback path:", fallbackPath);
          const response = await fetch(fallbackPath);
          if (response.ok) {
            const text = await response.text();
            console.log("[Textbook] Successfully loaded from fallback:", {
              fallbackPath,
              textLength: text.length,
              textPreview: text.substring(0, 100),
            });
            setContent(text);
            setOriginalContent(text);
            return;
          } else {
            console.log(
              "[Textbook] Fallback fetch failed with status:",
              response.status
            );
          }
        } catch (fallbackErr) {
          console.error("Failed to fetch from fallback:", fallbackErr);
        }
      }

      // すべての方法が失敗した場合
      console.error("[Textbook] All loading methods failed. File path:", path);
      setError(
        t(
          "Failed to load textbook. Please ensure the backend server is running at " +
            apiBaseUrl,
          "教科書の読み込みに失敗しました。バックエンドサーバー（" +
            apiBaseUrl +
            "）が起動していることを確認してください。"
        )
      );
    } catch (err) {
      console.error("[Textbook] Failed to load markdown:", err);
      setError(
        t(
          "Failed to load markdown file",
          "Markdownファイルの読み込みに失敗しました"
        )
      );
    }
  };

  const handleTranslate = useCallback(async () => {
    if (isTranslating || !isMarkdown || !originalContent.trim()) return;

    setIsTranslating(true);
    try {
      const targetLang = language === "ja" ? "en" : "ja";

      const result = await translateTextbook({
        markdown_text: isTranslated ? originalContent : content,
        target_lang: targetLang,
      });

      console.log("[Textbook] Translation completed:", {
        targetLang,
        translatedLength: result.translated_text.length,
        translatedPreview: result.translated_text.substring(0, 100),
        isTranslated: !isTranslated,
      });
      setContent(result.translated_text);
      setIsTranslated(!isTranslated);
    } catch (error) {
      console.error("[Textbook] Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  }, [
    isTranslating,
    isMarkdown,
    originalContent,
    language,
    isTranslated,
    content,
  ]);

  const renderMarkdown = () => {
    // 簡易的なMarkdownレンダリング
    const lines = content.split("\n");
    return (
      <ScrollView style={styles.contentContainer}>
        {lines.map((line, index) => {
          // 見出し
          if (line.startsWith("# ")) {
            return (
              <Text key={index} style={styles.h1}>
                {line.substring(2)}
              </Text>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <Text key={index} style={styles.h2}>
                {line.substring(3)}
              </Text>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <Text key={index} style={styles.h3}>
                {line.substring(4)}
              </Text>
            );
          }
          if (line.startsWith("#### ")) {
            return (
              <Text key={index} style={styles.h4}>
                {line.substring(5)}
              </Text>
            );
          }
          // コードブロック
          if (line.startsWith("```")) {
            return null; // コードブロックは簡易実装ではスキップ
          }
          // 太字
          if (line.includes("**")) {
            const parts = line.split("**");
            return (
              <Text key={index} style={styles.paragraph}>
                {parts.map((part, i) =>
                  i % 2 === 1 ? (
                    <Text key={i} style={styles.bold}>
                      {part}
                    </Text>
                  ) : (
                    part
                  )
                )}
              </Text>
            );
          }
          // 通常のテキスト
          if (line.trim()) {
            return (
              <Text key={index} style={styles.paragraph}>
                {line}
              </Text>
            );
          }
          return <Text key={index}>{"\n"}</Text>;
        })}
      </ScrollView>
    );
  };

  const renderPDF = () => {
    // PDF表示
    if (content.startsWith("http://") || content.startsWith("https://")) {
      // WebViewでPDFを表示
      return (
        <WebView
          source={{ uri: content }}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}
        />
      );
    } else {
      // ローカルPDFファイルの場合
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {t(
              "PDF viewer not available for local files",
              "ローカルPDFファイルの表示はサポートされていません"
            )}
          </Text>
          <Text style={styles.errorSubtext}>{content}</Text>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {t("Loading textbook...", "教科書を読み込んでいます...")}
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const rightComponent = useMemo(() => {
    // Markdownファイルで、コンテンツが読み込まれている場合のみ表示
    const hasContent =
      content.trim().length > 0 || originalContent.trim().length > 0;

    // textbookTypeがnullの場合は、デフォルトでmarkdownとして扱う
    const shouldShow =
      (isMarkdown || textbookType === null) && hasContent && !loading && !error;

    if (shouldShow) {
      return (
        <TouchableOpacity
          onPress={handleTranslate}
          style={styles.translateButton}
          disabled={isTranslating}
          testID="translate-button"
        >
          {isTranslating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.translateIcon} nativeID="translate-button">
              {isTranslated ? "🔤" : "🌐"}
            </Text>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  }, [
    isMarkdown,
    content,
    originalContent,
    isTranslating,
    isTranslated,
    handleTranslate,
    textbookType,
    loading,
    error,
  ]);

  return (
    <View style={styles.container}>
      <Header rightComponent={rightComponent} />
      {textbookType === "markdown" ? renderMarkdown() : renderPDF()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  h1: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 16,
    color: "#333",
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 12,
    color: "#333",
  },
  h3: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    color: "#333",
  },
  h4: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
    color: "#333",
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: "#333",
  },
  bold: {
    fontWeight: "bold",
  },
  webView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  translateButton: {
    padding: 8,
    marginRight: 8,
  },
  translateIcon: {
    fontSize: 24,
    color: "#fff",
  },
});
