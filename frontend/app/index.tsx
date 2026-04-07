import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useLanguage } from "../src/contexts/LanguageContext";
import Header from "../src/components/Header";
import Modal from "../src/components/Modal";
import { Platform } from "react-native";
import { submitPublicContact } from "../src/api/contact";
import { getApiErrorMessage } from "../src/utils/apiError";
import { APP_TITLE, APP_TAGLINE, SEO_SITE_NAME } from "../src/constants/branding";

const BETA_NOTICE_SEEN_KEY = "@beta_notice_seen";

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [showTrialStartWarningModal, setShowTrialStartWarningModal] =
    useState(false);
  /** ベータ版（システム）の案内。AsyncStorage で初回のみ表示 */
  const [showBetaNoticeModal, setShowBetaNoticeModal] = useState(false);

  const dismissBetaNotice = useCallback(() => {
    setShowBetaNoticeModal(false);
    void AsyncStorage.setItem(BETA_NOTICE_SEEN_KEY, "1");
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(BETA_NOTICE_SEEN_KEY);
        if (!cancelled && seen !== "1") {
          setShowBetaNoticeModal(true);
        }
      } catch {
        if (!cancelled) setShowBetaNoticeModal(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

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
            ? `${APP_TITLE}（${APP_TAGLINE}）- AIと一緒に間違えた問題を忘却曲線に沿って出題するAI単語帳・問題集学習プラットフォーム`
            : `${APP_TITLE} - ${APP_TAGLINE} | AI-Powered Flashcard & Quiz App with Spaced Repetition`;
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
            ? `${APP_TITLE}（${APP_TAGLINE}）- 忘却曲線と誤り集計で苦手を克服するAI単語帳・問題集`
            : `${APP_TITLE} - ${APP_TAGLINE} | Master Your Weak Spots with Spaced Repetition`;
        const ogDescription =
          currentLang === "ja"
            ? "間違えた問題を分析・記録し、忘却曲線に沿った最適なタイミングで復習を提案。苦手克服に特化した次世代の単語帳・問題集アプリ。"
            : "Track your mistakes, review at the right time with the forgetting curve, and turn weak spots into strengths. Your next-gen flashcard & quiz app.";

        setMetaTag("og:title", ogTitle, true);
        setMetaTag("og:description", ogDescription, true);
        setMetaTag("og:type", "website", true);
        setMetaTag("og:url", baseUrl, true);
        setMetaTag("og:site_name", SEO_SITE_NAME, true);
        setMetaTag("application-name", SEO_SITE_NAME);
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
        setMetaTag("author", SEO_SITE_NAME);

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
        document.title = `${APP_TITLE} Ver.β`;
        setMetaTag(
          "description",
          "Manage your question sets, view AI analytics, and track your learning progress. | 問題集を管理し、AI分析を表示し、学習の進捗を追跡します。"
        );
        setMetaTag("robots", "noindex, nofollow");
      }
    }
  }, [isAuthenticated, language]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(app)/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

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
        onPress={() => {
          dismissBetaNotice();
          setShowLoginModal(true);
        }}
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
              {t(APP_TITLE, APP_TITLE)}
            </Text>
            <Text
              style={[
                styles.brandTagline,
                {
                  fontSize: isSmallScreen ? 14 : 16,
                  marginBottom: isSmallScreen ? 8 : 10,
                },
              ]}
              nativeID="home-brand-tagline"
            >
              {t(APP_TAGLINE, APP_TAGLINE)}
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

            <View
              style={[
                styles.serviceSection,
                {
                  maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 480 : 600,
                },
              ]}
              nativeID="service-section"
            >
              <Text style={styles.serviceSectionTitle}>
                {t("Services & Pricing", "サービス内容と料金")}
              </Text>

              <View style={styles.serviceCard}>
                <Text style={styles.serviceCardLabel}>
                  {t("Free Trial", "無料トライアル")}
                </Text>
                <Text style={styles.serviceCardPrice}>
                  {t("Free", "無料")}
                </Text>
                <Text style={styles.serviceCardDesc}>
                  {t(
                    "Create question sets, take quizzes, and use flashcards. Data is stored locally on your device.",
                    "問題集の作成・クイズ・単語帳をご利用いただけます。データは端末内にローカル保存されます。"
                  )}
                </Text>
              </View>

              <View style={[styles.serviceCard, styles.serviceCardPremium]}>
                <Text style={styles.serviceCardLabel}>
                  {t("Premium Plan", "プレミアムプラン")}
                </Text>
                <Text style={[styles.serviceCardPrice, styles.serviceCardPricePremium]}>
                  <Text style={styles.serviceCardPriceStruck}>
                    {t("350 JPY / month (list)", "月額350円")}
                  </Text>
                  <Text>{t(" ", " ")}</Text>
                  <Text style={styles.serviceCardPriceEmphasis}>
                    {t("200 JPY / month", "月額200円")}
                  </Text>
                  <Text>
                    {t(" or 1,800 JPY / year", " / 年額1,800円")}
                  </Text>
                </Text>
                <Text style={styles.serviceCardPriceMeta}>
                  <Text style={styles.serviceCardPriceStruck}>
                    {t(
                      "Monthly: 350 yen & 100 credits (usual)",
                      "月額：350円・100クレジット"
                    )}
                  </Text>
                  <Text>
                    {t(
                      " → Monthly: ¥200 & 0 credits until marketplace matures. Yearly: 0 credits.",
                      " → 月額200円・0クレジット（マーケットプレイス充実まで）。年間プランは0クレジット。"
                    )}
                  </Text>
                </Text>
                <Text style={styles.serviceCardDesc}>
                  {t(
                    "Ad-free study with cloud sync and backup across devices.",
                    "広告なし、クラウド同期・バックアップで複数端末から学習可能。"
                  )}
                </Text>
              </View>

              <View style={styles.serviceCard}>
                <Text style={styles.serviceCardLabel}>
                  {t("Question Set Marketplace", "問題集マーケットプレイス")}
                </Text>
                <Text style={styles.serviceCardPrice}>
                  {t("Prices set by sellers", "出品者が価格を設定")}
                </Text>
                <Text style={styles.serviceCardDesc}>
                  {t(
                    "Buy and sell user-created question sets. Free and paid sets available.",
                    "ユーザーが作成した問題集を売買できます。無料・有料の問題集があります。"
                  )}
                </Text>
              </View>

              <Text style={styles.servicePaymentNote}>
                {t(
                  "Payment: Credit card via Stripe (Visa / Mastercard / American Express / JCB)",
                  "決済方法：クレジットカード（Stripe経由）Visa / Mastercard / American Express / JCB"
                )}
              </Text>
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
              onPress={() => {
                dismissBetaNotice();
                router.push("/(trial)/trial-question-sets");
              }}
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
              onPress={() => {
                dismissBetaNotice();
                setShowTrialStartWarningModal(true);
              }}
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
              onPress={() => {
                dismissBetaNotice();
                setShowLoginModal(true);
              }}
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

          <View style={styles.footer} nativeID="footer">
            <View
              style={[
                styles.footerLinks,
                isSmallScreen && styles.footerLinksColumn,
              ]}
            >
              <TouchableOpacity
                onPress={() => router.push("/(public)/tokusho")}
                style={styles.footerLinkTouchable}
              >
                <Text style={styles.footerLink}>
                  {t(
                    "Specified Commercial Transactions Act",
                    "特定商取引法に基づく表記"
                  )}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.footerSep, isSmallScreen && { display: "none" }]}>|</Text>
              <TouchableOpacity
                onPress={() => router.push("/(public)/terms-of-service")}
                style={styles.footerLinkTouchable}
              >
                <Text style={styles.footerLink}>
                  {t("Terms of Service", "利用規約")}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.footerSep, isSmallScreen && { display: "none" }]}>|</Text>
              <TouchableOpacity
                onPress={() => router.push("/(public)/privacy-policy")}
                style={styles.footerLinkTouchable}
              >
                <Text style={styles.footerLink}>
                  {t("Privacy Policy", "プライバシーポリシー")}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.footerSep, isSmallScreen && { display: "none" }]}>|</Text>
              <TouchableOpacity
                onPress={() => {
                  setContactError(null);
                  setContactSuccess(false);
                  setShowContactModal(true);
                }}
                style={styles.footerLinkTouchable}
              >
                <Text style={styles.footerLink}>
                  {t("Contact / Feedback", "お問い合わせ/フィードバック")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.footerCopy}>
              {"\u00A9"} {new Date().getFullYear()}{" "}
              {t("Ryusei Ishida", "石田 琉聖")} — {APP_TITLE}
            </Text>
          </View>
        </ScrollView>

        <Modal
          visible={showBetaNoticeModal}
          title={t("Beta version", "ベータ版です")}
          onClose={dismissBetaNotice}
        >
          <View style={styles.modalBody}>
            <Text style={styles.betaNoticeText}>
              {t(
                "This service runs on a beta system. Features, behavior, and design may change without notice.",
                "本サービスはベータ版のシステムで提供しています。機能・挙動・デザインは予告なく変更される場合があります。"
              )}
            </Text>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={dismissBetaNotice}
              testID="btn-beta-notice-close"
            >
              <Text style={styles.modalCancelButtonText}>
                {t("OK", "OK")}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>

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
                    "Without both sign-in and an active Premium plan, your question sets and progress are stored only on this device. They are not backed up to our servers and cannot be synced to other devices.",
                    "ログインかつ有料プラン加入がない場合、作成した問題集や学習の進捗はこの端末内にだけ保存され、サーバーへバックアップされません。他の端末とは同期されません。"
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
                    "To keep data safe: sign in and Premium plan",
                    "データを守るには：ログインかつ有料プラン"
                  )}
                </Text>
                <Text style={styles.infoBoxText}>
                  {t(
                    "With both sign-in and the Premium plan, you can use cloud sync and backups and continue learning without being tied to one browser.\n※Sign-in alone cannot sync or back up to the cloud for questions you created yourself, other than purchase-related data.",
                    "ログインかつ有料プランではクラウド同期・バックアップが利用でき、1つのブラウザに縛られず学習を続けられます。\n※ログインのみでは購入データ以外のご自身で作成された問題はクラウド同期・バックアップは不可能です"
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
                    "I agree — start (device-only storage)",
                    "同意した上で始める"
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
          visible={showContactModal}
          title={t("Contact / Feedback", "お問い合わせ/フィードバック")}
          onClose={() => {
            setShowContactModal(false);
            setContactError(null);
            setContactSuccess(false);
          }}
        >
          <View style={styles.modalBody}>
            {contactSuccess ? (
              <>
                <Text style={styles.contactSuccessText}>
                  {t(
                    "Your message has been sent. We will get back to you if needed.",
                    "送信しました。内容を確認し、必要に応じてご返信いたします。"
                  )}
                </Text>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowContactModal(false);
                    setContactSuccess(false);
                  }}
                  testID="btn-contact-success-close"
                >
                  <Text style={styles.modalCancelButtonText}>
                    {t("Close", "閉じる")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.contactHint}>
                  {t(
                    "We use your email only to respond to this inquiry.",
                    "ご入力いただいたメールアドレスは、本お問い合わせへの返信にのみ使用します。"
                  )}
                </Text>
                <Text style={styles.contactFieldLabel}>
                  {t("Email", "メールアドレス")}
                  <Text style={styles.contactRequired}> *</Text>
                </Text>
                <TextInput
                  style={styles.contactInput}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder={t("you@example.com", "you@example.com")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!contactSubmitting}
                />
                <Text style={styles.contactFieldLabel}>
                  {t("Name (optional)", "お名前（任意）")}
                </Text>
                <TextInput
                  style={styles.contactInput}
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder={t("Your name", "お名前")}
                  editable={!contactSubmitting}
                />
                <Text style={styles.contactFieldLabel}>
                  {t("Message", "お問い合わせ内容")}
                  <Text style={styles.contactRequired}> *</Text>
                </Text>
                <TextInput
                  style={[styles.contactInput, styles.contactInputMultiline]}
                  value={contactMessage}
                  onChangeText={setContactMessage}
                  placeholder={t(
                    "Please enter at least 10 characters.",
                    "10文字以上でご入力ください。"
                  )}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!contactSubmitting}
                />
                {contactError ? (
                  <Text style={styles.contactErrorText}>{contactError}</Text>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.googleSignInButton,
                    { backgroundColor: "#007AFF", borderColor: "#007AFF" },
                    contactSubmitting && { opacity: 0.7 },
                  ]}
                  disabled={contactSubmitting}
                  onPress={async () => {
                    setContactError(null);
                    const email = contactEmail.trim();
                    const msg = contactMessage.trim();
                    if (!email) {
                      setContactError(
                        t("Please enter your email.", "メールアドレスを入力してください。")
                      );
                      return;
                    }
                    if (msg.length < 10) {
                      setContactError(
                        t(
                          "Please enter at least 10 characters.",
                          "お問い合わせ内容は10文字以上で入力してください。"
                        )
                      );
                      return;
                    }
                    setContactSubmitting(true);
                    try {
                      await submitPublicContact({
                        email,
                        name: contactName.trim() || undefined,
                        message: msg,
                      });
                      setContactSuccess(true);
                      setContactEmail("");
                      setContactName("");
                      setContactMessage("");
                    } catch (e) {
                      setContactError(
                        getApiErrorMessage(
                          e,
                          "Could not send your message.",
                          "送信に失敗しました。"
                        )
                      );
                    } finally {
                      setContactSubmitting(false);
                    }
                  }}
                  testID="btn-contact-submit"
                >
                  {contactSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.googleSignInText, { color: "#fff" }]}>
                      {t("Send", "送信する")}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowContactModal(false);
                    setContactError(null);
                  }}
                  disabled={contactSubmitting}
                >
                  <Text style={styles.modalCancelButtonText}>
                    {t("Cancel", "キャンセル")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
  brandTagline: {
    color: "#555",
    textAlign: "center",
    fontWeight: "600",
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
  betaNoticeText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    marginBottom: 16,
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
  serviceSection: {
    width: "100%",
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  serviceSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  serviceCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  serviceCardPremium: {
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#E6C200",
  },
  serviceCardLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  serviceCardPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 6,
  },
  serviceCardPricePremium: {
    color: "#B8860B",
  },
  serviceCardPriceStruck: {
    textDecorationLine: "line-through",
    opacity: 0.75,
  },
  serviceCardPriceEmphasis: {
    fontWeight: "800",
  },
  serviceCardPriceMeta: {
    fontSize: 12,
    color: "#7a5c00",
    marginBottom: 6,
  },
  serviceCardDesc: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },
  servicePaymentNote: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  footerLinksColumn: {
    flexDirection: "column",
    gap: 10,
  },
  footerLinkTouchable: {
    paddingVertical: 2,
  },
  footerLink: {
    fontSize: 13,
    color: "#007AFF",
  },
  footerSep: {
    fontSize: 13,
    color: "#999",
  },
  footerCopy: {
    fontSize: 12,
    color: "#999",
  },
  contactHint: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 14,
  },
  contactFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    alignSelf: "stretch",
  },
  contactRequired: {
    color: "#FF3B30",
  },
  contactInput: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  contactInputMultiline: {
    minHeight: 120,
    paddingTop: 10,
  },
  contactErrorText: {
    fontSize: 13,
    color: "#FF3B30",
    marginBottom: 10,
    alignSelf: "stretch",
  },
  contactSuccessText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
    marginBottom: 16,
    textAlign: "center",
  },
});
