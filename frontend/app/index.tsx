import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
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

  // Web版の場合、動的にメタタグを設定
  useEffect(() => {
    if (Platform.OS === "web") {
      // タイトル設定
      document.title = isAuthenticated
        ? "AI Practice Book Ver.β"
        : "AI Practice Book Ver.β";

      // メタタグを設定する関数
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

      if (!isAuthenticated) {
        // 未ログイン時: SEO最適化
        setMetaTag(
          "description",
          "AI-powered learning platform that prioritizes your weak areas and recommends optimal questions to boost your scores. Smart adaptive learning tailored to your needs. | AIが苦手分野を優先的に出題し、最適な問題を推薦してスコアアップをサポート。あなたに合わせた適応型学習。"
        );
        setMetaTag(
          "keywords",
          "AI,learning,quiz,adaptive learning,weak areas,score improvement,personalized study,AI,学習,クイズ,適応型学習,苦手分野,スコアアップ,個別学習"
        );
        setMetaTag(
          "og:title",
          "AI Practice Book - Your Personal Study Assistant | AI Practice Book - あなた専用の学習アシスタント",
          true
        );
        setMetaTag(
          "og:description",
          "AI prioritizes your weak areas and recommends optimal questions to improve your scores. Adaptive learning personalized for you. | AIが苦手分野を優先し、最適な問題を推薦してスコアを改善。あなた専用の適応型学習。",
          true
        );
        setMetaTag("og:type", "website", true);
        setMetaTag("twitter:card", "summary_large_image");
        setMetaTag(
          "twitter:title",
          "AI Practice Book - Your Personal Study Assistant | AI Practice Book - あなた専用の学習アシスタント"
        );
        setMetaTag(
          "twitter:description",
          "AI identifies your weaknesses and recommends the best questions to boost your scores efficiently | AIが弱点を特定し、効率的にスコアを上げる最適な問題を推薦"
        );
        setMetaTag("robots", "index, follow");
        setMetaTag("language", "English, Japanese");
      } else {
        // ログイン時: プライバシー保護
        setMetaTag(
          "description",
          "Manage your question sets, view AI analytics, and track your learning progress. | 問題集を管理し、AI分析を表示し、学習の進捗を追跡します。"
        );
        setMetaTag("robots", "noindex, nofollow");
      }
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.container} nativeID="loading-container">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.wrapper} nativeID="home-wrapper-guest">
        <Header />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          nativeID="home-scroll-guest"
        >
          <View style={styles.container} nativeID="home-container-guest">
            {/* Language Switcher */}
            <View style={styles.languageSwitcher} nativeID="language-switcher">
              <TouchableOpacity
                style={[
                  styles.langButton,
                  language === "en" && styles.langButtonActive,
                ]}
                onPress={() => setLanguage("en")}
                nativeID="lang-btn-en"
              >
                <Text
                  style={[
                    styles.langButtonText,
                    language === "en" && styles.langButtonTextActive,
                  ]}
                  nativeID="lang-text-en"
                >
                  EN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  language === "ja" && styles.langButtonActive,
                ]}
                onPress={() => setLanguage("ja")}
                nativeID="lang-btn-ja"
              >
                <Text
                  style={[
                    styles.langButtonText,
                    language === "ja" && styles.langButtonTextActive,
                  ]}
                  nativeID="lang-text-ja"
                >
                  日本語
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title} nativeID="home-title">
              {t("AI Practice Book", "AI Practice Book")}
            </Text>
            <Text style={styles.subtitle} nativeID="home-subtitle">
              {t(
                "Your Personal Study Assistant",
                "あなた専用の学習アシスタント"
              )}
            </Text>

            <View
              style={styles.featuresContainer}
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
              style={styles.button}
              onPress={() => router.push("/(auth)/register")}
              disabled={true}
              nativeID="btn-register"
            >
              <Text style={styles.buttonText} nativeID="btn-register-text">
                {t("Get Started", "今すぐ始める")}
              </Text>
              <View style={styles.overlay} nativeID="btn-register-overlay">
                <Text
                  style={styles.overlayText}
                  nativeID="btn-register-overlay-text"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonOutline]}
              onPress={() => router.push("/(auth)/login")}
              disabled={true}
              nativeID="btn-login"
            >
              <View style={styles.overlay} nativeID="btn-login-overlay">
                <Text
                  style={styles.overlayText}
                  nativeID="btn-login-overlay-text"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
              <Text
                style={[styles.buttonText, styles.buttonOutlineText]}
                nativeID="btn-login-text"
              >
                {t("Sign In", "ログイン")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.trialButton]}
              onPress={() => router.push("/(trial)/question-sets")}
              nativeID="btn-trial"
            >
              <Text style={styles.buttonText} nativeID="btn-trial-text">
                {t("Try Without Sign Up", "登録なしで試す")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.wrapper} nativeID="home-wrapper-authenticated">
      <Header />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        nativeID="home-scroll-authenticated"
      >
        <View style={styles.container} nativeID="home-container-authenticated">
          {/* Language Switcher */}
          <View
            style={styles.languageSwitcher}
            nativeID="language-switcher-auth"
          >
            <TouchableOpacity
              style={[
                styles.langButton,
                language === "en" && styles.langButtonActive,
              ]}
              onPress={() => setLanguage("en")}
              nativeID="lang-btn-en-auth"
            >
              <Text
                style={[
                  styles.langButtonText,
                  language === "en" && styles.langButtonTextActive,
                ]}
                nativeID="lang-text-en-auth"
              >
                EN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langButton,
                language === "ja" && styles.langButtonActive,
              ]}
              onPress={() => setLanguage("ja")}
              nativeID="lang-btn-ja-auth"
            >
              <Text
                style={[
                  styles.langButtonText,
                  language === "ja" && styles.langButtonTextActive,
                ]}
                nativeID="lang-text-ja-auth"
              >
                日本語
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title} nativeID="welcome-title">
            {t("Welcome", "ようこそ")}, {user?.full_name}!
          </Text>
          <Text style={styles.email} nativeID="user-email">
            {user?.email}
          </Text>

          <View style={styles.menuContainer} nativeID="menu-container">
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => router.push("/(app)/ai-dashboard")}
              nativeID="menu-btn-ai-dashboard"
            >
              <Text
                style={styles.menuButtonText}
                nativeID="menu-text-ai-dashboard"
              >
                {t("AI Dashboard", "AIダッシュボード")}
              </Text>
              <View style={styles.overlay} nativeID="menu-overlay-ai-dashboard">
                <Text
                  style={styles.overlayText}
                  nativeID="menu-overlay-text-ai-dashboard"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => router.push("/(app)/question-sets")}
              nativeID="menu-btn-question-sets"
            >
              <Text
                style={styles.menuButtonText}
                nativeID="menu-text-question-sets"
              >
                {t("My Question Sets", "マイ問題集")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => router.push("/(app)/question-sets/create")}
              nativeID="menu-btn-create-set"
            >
              <Text
                style={styles.menuButtonText}
                nativeID="menu-text-create-set"
              >
                {t("Create Question Set", "問題集を作成")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuButton, styles.sellerButton]}
              onPress={() => router.push("/(app)/seller-dashboard")}
              nativeID="menu-btn-seller"
            >
              <Text style={styles.menuButtonText} nativeID="menu-text-seller">
                {t("Seller Dashboard", "販売者ダッシュボード")}
              </Text>
              <View style={styles.overlay} nativeID="menu-overlay-seller">
                <Text
                  style={styles.overlayText}
                  nativeID="menu-overlay-text-seller"
                >
                  {t("Under Preparation", "準備中")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuButton, styles.settingsButton]}
              onPress={() => router.push("/(app)/settings")}
              nativeID="menu-btn-settings"
            >
              <Text style={styles.menuButtonText} nativeID="menu-text-settings">
                {t("Security Settings", "セキュリティ設定")}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={logout}
            nativeID="btn-logout"
          >
            <Text style={styles.buttonText} nativeID="btn-logout-text">
              {t("Logout", "ログアウト")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
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
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: "#007AFF",
  },
  langButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  langButtonTextActive: {
    color: "#fff",
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
