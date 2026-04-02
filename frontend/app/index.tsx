import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useLanguage } from "../src/contexts/LanguageContext";
import Header from "../src/components/Header";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  // Web版の場合、動的にメタタグを設定
  useEffect(() => {
    if (Platform.OS === "web") {
      // メタタグを設定する関数
      const setMetaTag = (
        name: string,
        content: string,
        property?: boolean
      ) => {
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

      // Linkタグを設定する関数
      const setLinkTag = (rel: string, href: string, type?: string) => {
        const selector = type
          ? `link[rel="${rel}"][type="${type}"]`
          : `link[rel="${rel}"]`;
        let link = document.querySelector(selector) as HTMLLinkElement;
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", rel);
          if (type) {
            link.setAttribute("type", type);
          }
          document.head.appendChild(link);
        }
        link.href = href;
      };

      if (!isAuthenticated) {
        // 未ログイン時: SEO最適化
        const baseUrl = "https://ai-practice-book.com";
        const currentLang = language === "ja" ? "ja" : "en";

        // タイトル設定（言語に応じて）
        const pageTitle =
          currentLang === "ja"
            ? "AI Practice Book - AIが苦手分野を優先的に出題する学習プラットフォーム"
            : "AI Practice Book - AI-Powered Learning Platform for Personalized Study";
        document.title = pageTitle;

        // Description（160文字以内、言語に応じて）
        const description =
          currentLang === "ja"
            ? "AIが苦手分野を優先的に出題し、最適な問題を推薦してスコアアップをサポート。あなたに合わせた適応型学習プラットフォーム。登録不要でお試し可能。"
            : "AI-powered learning platform that prioritizes your weak areas and recommends optimal questions to boost your scores. Smart adaptive learning tailored to your needs. Try free without registration.";

        // メタタグ設定
        setMetaTag("description", description);
        setMetaTag(
          "keywords",
          "AI,learning,quiz,adaptive learning,weak areas,score improvement,personalized study,AI,学習,クイズ,適応型学習,苦手分野,スコアアップ,個別学習"
        );

        // Open Graph
        const ogTitle =
          currentLang === "ja"
            ? "AI Practice Book - あなた専用のAI学習アシスタント"
            : "AI Practice Book - Your Personal AI Study Assistant";
        const ogDescription =
          currentLang === "ja"
            ? "AIが苦手分野を優先し、最適な問題を推薦してスコアを改善。あなた専用の適応型学習。"
            : "AI prioritizes your weak areas and recommends optimal questions to improve your scores. Adaptive learning personalized for you.";

        setMetaTag("og:title", ogTitle, true);
        setMetaTag("og:description", ogDescription, true);
        setMetaTag("og:type", "website", true);
        setMetaTag("og:url", baseUrl, true);
        setMetaTag("og:site_name", "AI Practice Book", true);
        setMetaTag("og:locale", currentLang === "ja" ? "ja_JP" : "en_US", true);
        if (currentLang === "ja") {
          setMetaTag("og:locale:alternate", "en_US", true);
        } else {
          setMetaTag("og:locale:alternate", "ja_JP", true);
        }

        // Twitter Card
        setMetaTag("twitter:card", "summary_large_image");
        setMetaTag("twitter:title", ogTitle);
        setMetaTag("twitter:description", ogDescription);

        // その他のSEOタグ
        setMetaTag("robots", "index, follow");
        setMetaTag("language", currentLang === "ja" ? "Japanese" : "English");
        setMetaTag("author", "AI Practice Book");

        // Canonical URL
        setLinkTag("canonical", baseUrl);

        // Alternate language links
        setLinkTag("alternate", `${baseUrl}?lang=ja`, "x-default");
        setLinkTag("alternate", `${baseUrl}?lang=ja`, "ja");
        setLinkTag("alternate", `${baseUrl}?lang=en`, "en");

        // Google Search Console 検証用メタタグ
        setMetaTag(
          "google-site-verification",
          "14RFhI0FXY1YDiIG4D-RC3U27kBT-VYNdOeYDPyncC8"
        );
      } else {
        // ログイン時: プライバシー保護
        document.title = "AI Practice Book Ver.β";
        setMetaTag(
          "description",
          "Manage your question sets, view AI analytics, and track your learning progress. | 問題集を管理し、AI分析を表示し、学習の進捗を追跡します。"
        );
        setMetaTag("robots", "noindex, nofollow");
      }
    }
  }, [isAuthenticated, language]);

  if (isLoading) {
    return (
      <View style={styles.container} nativeID="loading-container">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    // 言語切り替えボタンコンポーネント
    const languageSwitcher = (
      <View style={styles.languageSwitcherHeader} nativeID="language-switcher">
        <TouchableOpacity
          style={[
            styles.langButtonHeader,
            language === "en" && styles.langButtonActiveHeader,
          ]}
          onPress={() => setLanguage("en")}
          nativeID="lang-btn-en"
        >
          <Text
            style={[
              styles.langButtonTextHeader,
              language === "en" && styles.langButtonTextActiveHeader,
            ]}
            nativeID="lang-text-en"
          >
            EN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.langButtonHeader,
            language === "ja" && styles.langButtonActiveHeader,
          ]}
          onPress={() => setLanguage("ja")}
          nativeID="lang-btn-ja"
        >
          <Text
            style={[
              styles.langButtonTextHeader,
              language === "ja" && styles.langButtonTextActiveHeader,
            ]}
            nativeID="lang-text-ja"
          >
            日本語
          </Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={styles.wrapper} nativeID="home-wrapper-guest">
        <Header rightComponent={languageSwitcher} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          nativeID="home-scroll-guest"
        >
          <View style={styles.container} nativeID="home-container-guest">
            <Text
              style={[
                styles.title,
                {
                  fontSize: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
                  marginBottom: isSmallScreen ? 6 : 8,
                },
              ]}
              nativeID="home-title"
            >
              {t("AI Practice Book", "AI Practice Book")}
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: isSmallScreen ? 16 : 18,
                  marginBottom: isSmallScreen ? 32 : 48,
                },
              ]}
              nativeID="home-subtitle"
            >
              {t(
                "Your Personal Study Assistant",
                "あなた専用の学習アシスタント"
              )}
            </Text>

            <View
              style={[
                styles.featuresContainer,
                {
                  maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 400 : 600,
                  marginBottom: isSmallScreen ? 24 : 32,
                },
              ]}
              nativeID="features-container"
            >
              <View style={styles.featureItem} nativeID="feature-question-sets">
                <Text style={styles.featureIcon} nativeID="feature-icon-1">
                  📚
                </Text>
                <Text style={styles.featureTitle} nativeID="feature-title-1">
                  {t("Create Question Sets", "問題集を作成")}
                </Text>
                <Text style={styles.featureDesc} nativeID="feature-desc-1">
                  {t(
                    "Create custom quizzes with CSV import",
                    "CSVで簡単に問題集を作成"
                  )}
                </Text>
              </View>

              <View style={styles.featureItem} nativeID="feature-ai-evaluation">
                <Text style={styles.featureIcon} nativeID="feature-icon-2">
                  🎯
                </Text>
                <Text style={styles.featureTitle} nativeID="feature-title-2">
                  {t("AI Evaluation", "AI評価")}
                </Text>
                <Text style={styles.featureDesc} nativeID="feature-desc-2">
                  {t("Smart answer checking with AI", "AIが回答を賢く評価")}
                </Text>
              </View>

              <View style={styles.featureItem} nativeID="feature-flashcard">
                <Text style={styles.featureIcon} nativeID="feature-icon-3">
                  📇
                </Text>
                <Text style={styles.featureTitle} nativeID="feature-title-3">
                  {t("Flashcard Mode", "単語帳モード")}
                </Text>
                <Text style={styles.featureDesc} nativeID="feature-desc-3">
                  {t("Study with voice support", "音声読み上げで効率学習")}
                </Text>
              </View>

              <View style={styles.featureItem} nativeID="feature-voice">
                <Text style={styles.featureIcon} nativeID="feature-icon-4">
                  🔊
                </Text>
                <Text style={styles.featureTitle} nativeID="feature-title-4">
                  {t("Voice Reading", "音声読み上げ")}
                </Text>
                <Text style={styles.featureDesc} nativeID="feature-desc-4">
                  {t("Japanese & English support", "日本語・英語対応")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.trialButton,
                {
                  maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 350 : 400,
                  padding: isSmallScreen ? 14 : 16,
                },
              ]}
              onPress={() => router.push("/(trial)/trial-question-sets")}
              nativeID="btn-trial"
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
                nativeID="btn-trial-text"
              >
                {t("Try Without Sign Up", "登録なしで試す")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {
                  maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 350 : 400,
                  padding: isSmallScreen ? 14 : 16,
                },
              ]}
              onPress={() => router.push("/(auth)/register")}
              disabled={false}
              nativeID="btn-register"
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
                nativeID="btn-register-text"
              >
                {t("Get Started", "今すぐ始める")}
              </Text>
              <View style={styles.overlay} nativeID="btn-register-overlay">
                <Text
                  style={[
                    styles.overlayText,
                    { fontSize: isSmallScreen ? 16 : 18 },
                  ]}
                  nativeID="btn-register-overlay-text"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonOutline,
                {
                  maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 350 : 400,
                  padding: isSmallScreen ? 14 : 16,
                },
              ]}
              onPress={() => router.push("/(auth)/login")}
              disabled={false}
              nativeID="btn-login"
            >
              <View style={styles.overlay} nativeID="btn-login-overlay">
                <Text
                  style={[
                    styles.overlayText,
                    { fontSize: isSmallScreen ? 16 : 18 },
                  ]}
                  nativeID="btn-login-overlay-text"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
              <Text
                style={[
                  styles.buttonText,
                  styles.buttonOutlineText,
                  { fontSize: isSmallScreen ? 14 : 16 },
                ]}
                nativeID="btn-login-text"
              >
                {t("Sign In", "ログイン")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(app)/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  return null;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  languageSwitcher: {
    position: "absolute",
    top: 100,
    right: 20,
    flexDirection: "row",
    gap: 8,
  },
  languageSwitcherHeader: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  langButtonHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: "#007AFF",
  },
  langButtonActiveHeader: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  langButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  langButtonTextHeader: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  langButtonTextActive: {
    color: "#fff",
  },
  langButtonTextActiveHeader: {
    color: "#fff",
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 48,
    textAlign: "center",
  },
  email: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  menuContainer: {
    position: "relative",
    width: "100%",
    maxWidth: 300,
    gap: 12,
    marginBottom: 32,
  },
  menuButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  overlayText: {
    fontWeight: "bold",
    fontSize: 18,
    top: -15,
  },
  menuButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sellerButton: {
    backgroundColor: "#34C759",
  },
  settingsButton: {
    backgroundColor: "#FF9500",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonOutlineText: {
    color: "#007AFF",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
  },
  trialButton: {
    backgroundColor: "#34C759",
  },
  featuresContainer: {
    width: "100%",
    maxWidth: 300,
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
  },
  featureDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
