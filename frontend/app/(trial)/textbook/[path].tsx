import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import Header from "../../../src/components/Header";
import { normalizeTextbookPath } from "../../../src/services/textbookService";
import { translateTextbook } from "../../../src/api/translate";

export default function TextbookViewScreen() {
  console.log("[Textbook] Component rendering");
  const { path, type } = useLocalSearchParams<{
    path: string;
    type?: string;
  }>();
  console.log("[Textbook] useLocalSearchParams:", { path, type });
  const { t, language } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [textbookType, setTextbookType] = useState<string>("markdown");
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  useEffect(() => {
    console.log("[Textbook] useEffect triggered, path:", path);
    if (path) {
      loadTextbook();
    } else {
      console.log("[Textbook] No path provided");
    }
  }, [path]);

  const loadTextbook = async () => {
    console.log(
      "[Textbook] loadTextbook called with path:",
      path,
      "type:",
      type
    );
    try {
      setLoading(true);
      setError(null);

      const decodedPath = decodeURIComponent(path || "");
      console.log("[Textbook] Decoded path:", decodedPath);

      // 英語名を日本語名に正規化
      const normalizedPath = normalizeTextbookPath(decodedPath);
      console.log("[Textbook] Normalized path:", normalizedPath);

      const fileType = type || "markdown";
      console.log("[Textbook] File type:", fileType);
      setTextbookType(fileType);

      if (fileType === "markdown") {
        console.log("[Textbook] Loading markdown file...");
        await loadMarkdown(normalizedPath);
      } else if (fileType === "pdf") {
        console.log("[Textbook] Setting PDF path:", {
          path: normalizedPath,
          length: normalizedPath.length,
        });
        setContent(normalizedPath);
        setOriginalContent(normalizedPath);
      } else {
        console.log("[Textbook] Defaulting to markdown");
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

  const loadMarkdown = async (filePath: string) => {
    console.log("[Textbook] loadMarkdown called with path:", filePath);
    try {
      // パスがURLの場合
      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        console.log("[Textbook] Loading from HTTP/HTTPS URL:", filePath);
        const response = await fetch(filePath);
        const text = await response.text();
        console.log("[Textbook] Loaded from HTTP/HTTPS URL:", {
          path: filePath,
          textLength: text.length,
          textPreview: text.substring(0, 100),
        });
        setContent(text);
        setOriginalContent(text);
        return;
      }

      // ローカルファイルの場合
      if (filePath.startsWith("file://")) {
        console.log("[Textbook] Loading from local file:", filePath);
        const fileContent = await FileSystem.readAsStringAsync(filePath);
        console.log("[Textbook] Loaded from local file:", {
          path: filePath,
          contentLength: fileContent.length,
          contentPreview: fileContent.substring(0, 100),
        });
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
        filePath
      )}`;

      try {
        console.log("[Textbook] Fetching from API:", fileUrl);
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
        } else {
          console.log(
            "[Textbook] API fetch failed with status:",
            response.status
          );
        }
      } catch (fetchErr) {
        console.error("[Textbook] Failed to fetch from API:", fetchErr);
        // 接続エラーの場合、フォールバック処理を試す
      }

      // フォールバック: 直接パスから読み込む（開発環境用）
      if (Platform.OS === "web") {
        try {
          // Web版の場合、docs/textbook/から直接読み込む
          const fallbackPath = `/docs/textbook/${encodeURIComponent(filePath)}`;
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
      console.error(
        "[Textbook] All loading methods failed. File path:",
        filePath
      );
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
      console.error("Failed to load markdown:", err);
      setError(
        t(
          "Failed to load markdown file",
          "Markdownファイルの読み込みに失敗しました"
        )
      );
    }
  };

  // 言語を自動検出する関数
  const detectLanguage = useCallback((text: string): "ja" | "en" => {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text) ? "ja" : "en";
  }, []);

  const handleTranslate = useCallback(async () => {
    console.log("[Textbook] handleTranslate called", {
      isTranslating,
      textbookType,
      originalContentLength: originalContent.length,
      contentLength: content.length,
      isTranslated,
      language,
    });

    if (
      isTranslating ||
      textbookType !== "markdown" ||
      !originalContent.trim()
    ) {
      console.log("[Textbook] Translation skipped:", {
        isTranslating,
        textbookType,
        hasOriginalContent: !!originalContent.trim(),
      });
      return;
    }

    console.log("[Textbook] Starting translation...");
    setIsTranslating(true);
    try {
      // 翻訳済みの場合は元に戻す
      if (isTranslated) {
        // 元のコンテンツに戻す
        console.log("[Textbook] Reverting to original content");
        setContent(originalContent);
        setIsTranslated(false);
      } else {
        // 元のコンテンツの言語を検出
        const sourceLang = detectLanguage(originalContent);
        // 設定されている言語に翻訳
        const targetLang = language;

        console.log("[Textbook] Language detection:", {
          sourceLang,
          targetLang,
          originalContentPreview: originalContent.substring(0, 100),
        });

        // 既に設定言語と同じ場合は翻訳不要
        if (sourceLang === targetLang) {
          console.log(
            "[Textbook] Content is already in target language, skipping translation"
          );
          setContent(originalContent);
          setIsTranslated(false);
        } else {
          // originalContentを設定言語に翻訳
          console.log("[Textbook] Calling translateTextbook API:", {
            sourceLang,
            targetLang,
            originalContentLength: originalContent.length,
            originalContentPreview: originalContent.substring(0, 100),
          });

          const result = await translateTextbook({
            markdown_text: originalContent,
            target_lang: targetLang,
            source_lang: sourceLang,
          });

          console.log("[Textbook] Translation completed:", {
            sourceLang: result.source_lang,
            targetLang: result.target_lang,
            translatedLength: result.translated_text.length,
            translatedPreview: result.translated_text.substring(0, 100),
          });
          setContent(result.translated_text);
          setIsTranslated(true);
        }
      }
    } catch (error) {
      console.error("[Textbook] Translation error:", error);
      console.error(
        "[Textbook] Translation error details:",
        JSON.stringify(error, null, 2)
      );
    } finally {
      console.log(
        "[Textbook] Translation finished, setting isTranslating to false"
      );
      setIsTranslating(false);
    }
  }, [
    isTranslating,
    textbookType,
    originalContent,
    language,
    isTranslated,
    content,
    detectLanguage,
  ]);

  const rightComponent = useMemo(() => {
    // Markdownファイルで、コンテンツが読み込まれている場合のみ表示
    const hasContent =
      content.trim().length > 0 || originalContent.trim().length > 0;
    const shouldShow =
      textbookType === "markdown" && hasContent && !loading && !error;

    console.log("[Textbook] rightComponent calculation:", {
      hasContent,
      shouldShow,
      textbookType,
      contentLength: content.length,
      originalContentLength: originalContent.length,
      loading,
      error,
    });

    if (shouldShow) {
      const buttonText = isTranslated
        ? t("Translated", "翻訳済")
        : t("Translate", "翻訳");

      return (
        <TouchableOpacity
          onPress={() => {
            console.log("[Textbook] Translate button pressed");
            handleTranslate();
          }}
          style={styles.translateButton}
          disabled={isTranslating}
          testID="translate-button"
        >
          {isTranslating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text
              style={styles.translateButtonText}
              nativeID="translate-button"
            >
              {buttonText}
            </Text>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  }, [
    textbookType,
    content,
    originalContent,
    isTranslating,
    isTranslated,
    handleTranslate,
    loading,
    error,
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
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  translateButtonText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
});
