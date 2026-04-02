import React, { useEffect, useState } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
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
import Modal from "../src/components/Modal";
import { Platform } from "react-native";

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTrialStartWarningModal, setShowTrialStartWarningModal] =
    useState(false);

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
      const setLinkTag = (rel: string, href: string, hreflang?: string) => {
        const selector = hreflang
          ? `link[rel="${rel}"][hreflang="${hreflang}"]`
          : `link[rel="${rel}"]`;
        let link = document.querySelector(selector) as HTMLLinkElement;
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", rel);
          if (hreflang) {
            link.setAttribute("hreflang", hreflang);
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
            ? "AI Practice Book - AIと一緒に間違えた問題を忘却曲線に沿って出題するAI単語帳・問題集学習プラットフォーム"
            : "AI Practice Book - AI-Powered Flashcard & Quiz App with Spaced Repetition";
        document.title = pageTitle;

        // Description（160文字以内、言語に応じて）
        const description =
          currentLang === "ja"
            ? "間違えた問題を分析・記録し集中的に苦手をつぶし、忘却曲線に沿って最適なタイミングで復習を提案。苦手克服に特化した、次世代のAI単語帳・問題集アプリ。登録不要でお試し可能。"
            : "Analyze and track your wrong answers, then review them at the perfect moment using the forgetting curve. A next-gen flashcard & quiz app built to eliminate weak spots. Try free without registration.";

        // メタタグ設定
        setMetaTag("description", description);
        setMetaTag(
          "keywords",
          "AI,learning,quiz,flashcard,spaced repetition,forgetting curve,weak areas,score improvement,personalized study,AI,学習,クイズ,単語帳,問題集,忘却曲線,苦手克服,復習,適応型学習,苦手分野,スコアアップ,個別学習"
        );

        // Open Graph
        const ogTitle =
          currentLang === "ja"
            ? "AI Practice Book - 忘却曲線と誤り集計で苦手を克服するAI単語帳・問題集"
            : "AI Practice Book - Master Your Weak Spots with Spaced Repetition";
        const ogDescription =
          currentLang === "ja"
            ? "間違えた問題を分析・記録し、忘却曲線に沿った最適なタイミングで復習を提案。苦手克服に特化した次世代の単語帳・問題集アプリ。"
            : "Track your mistakes, review at the right time with the forgetting curve, and turn weak spots into strengths. Your next-gen flashcard & quiz app.";

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
          testID="lang-btn-en"
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
          testID="lang-btn-ja"
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

    const headerLoginButton = (
      <TouchableOpacity
        style={styles.headerCornerButton}
        onPress={() => setShowLoginModal(true)}
        testID="header-btn-login"
      >
        <Text
          style={[
            styles.headerCornerButtonText,
            { fontSize: isSmallScreen ? 14 : 16 },
          ]}
          nativeID="header-login-text"
        >
          {t("Sign In", "ログイン")}
        </Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.wrapper} nativeID="home-wrapper-guest">
        <Header
          leftComponent={headerLoginButton}
          rightComponent={languageSwitcher}
        />
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
                "Your mistakes. Your best teacher.",
                "間違えた問題が、最強の教材になる。"
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
              testID="btn-trial"
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
              onPress={() => setShowTrialStartWarningModal(true)}
              testID="btn-register"
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
              onPress={() => setShowLoginModal(true)}
              testID="btn-login"
            >
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

        <Modal
          visible={showTrialStartWarningModal}
          title={t(
            "Before you start (saved on this device only)",
            "始める前に（この端末だけに保存されます）"
          )}
          onClose={() => setShowTrialStartWarningModal(false)}
        >
          <View style={styles.modalBody}>
            <View style={[styles.infoBox, styles.trialWarningBox]}>
              <Text style={styles.infoBoxIcon}>⚠️</Text>
              <View style={styles.infoBoxContent}>
                <Text style={styles.infoBoxTitle}>
                  {t("Local-only trial data", "お試しデータはローカル保存です")}
                </Text>
                <Text style={styles.infoBoxText}>
                  {t(
                    "Without signing in, your question sets and progress are stored only on this device. They are not backed up to our servers and cannot be synced to other devices.",
                    "ログインしない場合、作成した問題集や学習の進捗はこの端末内にだけ保存され、サーバーへバックアップされません。他の端末とは同期されません。"
                  )}
                </Text>
              </View>
            </View>

            <Text style={styles.trialWarningListTitle}>
              {t(
                "Your data may disappear if you:",
                "次のようなとき、データが消える可能性があります。"
              )}
            </Text>
            <View style={styles.trialWarningList}>
              <Text style={styles.trialWarningBullet}>
                {t(
                  "Clear site data, storage, or cache in your browser or app settings",
                  "ブラウザやアプリの設定でサイトデータ・ストレージ・キャッシュを削除したとき"
                )}
              </Text>
              <Text style={styles.trialWarningBullet}>
                {t(
                  "Open the app on a different device or browser (no cloud sync)",
                  "別の端末や別ブラウザで利用したとき（クラウド同期なしのため見えません）"
                )}
              </Text>
              <Text style={styles.trialWarningBullet}>
                {t(
                  "Use private/incognito mode, or rely on temporary storage that may be cleared when tabs close",
                  "シークレット／プライベート閲覧を使ったとき、またはタブを閉じると消える一時保存に頼っているとき"
                )}
              </Text>
              <Text style={styles.trialWarningBullet}>
                {t(
                  "Uninstall the app or reset the device",
                  "アプリをアンインストールしたとき、端末を初期化したとき"
                )}
              </Text>
              <Text style={styles.trialWarningBullet}>
                {t(
                  "In rare cases: very low storage, OS/browser updates, or automated cleanup by the system",
                  "まれに、ストレージ不足・OS／ブラウザの更新・端末側の自動クリーンアップなどで失われることがあります"
                )}
              </Text>
            </View>

            <View style={[styles.infoBox, styles.premiumBox]}>
              <Text style={styles.infoBoxIcon}>☁️</Text>
              <View style={styles.infoBoxContent}>
                <Text style={[styles.infoBoxTitle, styles.premiumTitle]}>
                  {t(
                    "To keep data safe: sign in & premium",
                    "データを守るには：ログインと有料プラン"
                  )}
                </Text>
                <Text style={styles.infoBoxText}>
                  {t(
                    "Signing in lets you use cloud sync and backups on the Premium plan so your work is not tied to one browser tab.",
                    "ログイン後、有料プランではクラウド同期・バックアップが利用でき、1つのブラウザに縛られず学習を続けられます。"
                  )}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.googleSignInButton}
              onPress={() => {
                setShowTrialStartWarningModal(false);
                setShowLoginModal(true);
              }}
              testID="btn-trial-warning-login"
            >
              <Text style={styles.googleSignInText}>
                {t("Sign in", "ログインする")}
              </Text>
            </TouchableOpacity>

            <View style={styles.trialWarningActionStack}>
              <TouchableOpacity
                style={[styles.modalWideCta, styles.modalWideCtaPremium]}
                onPress={() => {
                  setShowTrialStartWarningModal(false);
                  router.push("/(app)/premium-upgrade");
                }}
                testID="btn-trial-warning-premium"
              >
                <Text style={styles.buttonText}>
                  {t("View Premium plan", "有料プランを見る")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalWideCta, styles.modalWideCtaStart]}
                onPress={() => {
                  setShowTrialStartWarningModal(false);
                  router.push("/(trial)/trial-question-sets");
                }}
                testID="btn-trial-warning-continue"
              >
                <Text style={styles.buttonText}>
                  {t(
                    "I understand — start (device-only storage)",
                    "理解したうえで始める"
                  )}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowTrialStartWarningModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>
                {t("Close", "閉じる")}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <Modal
          visible={showLoginModal}
          title={t("Sign In", "ログイン")}
          onClose={() => setShowLoginModal(false)}
        >
          <View style={styles.modalBody}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxIcon}>💾</Text>
              <View style={styles.infoBoxContent}>
                <Text style={styles.infoBoxTitle}>
                  {t("Local Storage", "ローカル保存")}
                </Text>
                <Text style={styles.infoBoxText}>
                  {t(
                    "Your data is stored only on this device. You can use all features without signing in.",
                    "作成したデータはこのデバイスにのみ保存されます。ログインなしでもすべての機能をご利用いただけます。"
                  )}
                </Text>
              </View>
            </View>

            <View style={[styles.infoBox, styles.premiumBox]}>
              <Text style={styles.infoBoxIcon}>☁️</Text>
              <View style={styles.infoBoxContent}>
                <Text style={[styles.infoBoxTitle, styles.premiumTitle]}>
                  {t("Cloud Storage (Paid Plan)", "クラウド保存（有料プラン）")}
                </Text>
                <Text style={styles.infoBoxText}>
                  {t(
                    "Sign in and subscribe to Premium to sync answers and question sets across devices via the cloud. Without Premium, data stays local to this device even after sign-in.",
                    "ログイン後もデータは端末内（ローカル）のままです。プレミアムに加入すると回答・問題集をクラウド同期し、複数端末でバックアップ・学習を続けられます。"
                  )}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.googleSignInButton}
              onPress={() => {
                setShowLoginModal(false);
                router.push("/(auth)/login");
              }}
            >
              <Text style={styles.googleSignInText}>
                {t("Sign in with Google", "Googleでサインイン")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLoginModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>
                {t("Cancel", "キャンセル")}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
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
  headerCornerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerCornerButtonText: {
    color: "#fff",
    fontWeight: "600",
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
  trialWarningBox: {
    backgroundColor: "#FFF4E5",
    borderWidth: 1,
    borderColor: "#E6C200",
  },
  trialWarningListTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    marginTop: 4,
  },
  trialWarningList: {
    marginBottom: 14,
    gap: 8,
  },
  trialWarningBullet: {
    fontSize: 13,
    color: "#444",
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: 4,
  },
  /** 注意モーダル内: `button` の maxWidth:300 を避け、親幅いっぱいに揃える */
  trialWarningActionStack: {
    alignSelf: "stretch",
    width: "100%",
  },
  modalWideCta: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  modalWideCtaPremium: {
    backgroundColor: "#FF9500",
  },
  modalWideCtaStart: {
    backgroundColor: "#007AFF",
  },
  modalBody: {
    paddingBottom: 4,
    alignSelf: "stretch",
    width: "100%",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F7FF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  premiumBox: {
    backgroundColor: "#FFF8E7",
  },
  infoBoxIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  premiumTitle: {
    color: "#B8860B",
  },
  infoBoxText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },
  googleSignInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#dadce0",
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginBottom: 10,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    }),
    elevation: 2,
    ...Platform.select({
      web: { cursor: "pointer" },
      default: {},
    }),
  },
  googleSignInText: {
    color: "#3c4043",
    fontSize: 15,
    fontWeight: "600",
  },
  modalCancelButton: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
  },
  modalCancelButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
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
