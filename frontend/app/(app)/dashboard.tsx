import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";
import Header from "../../src/components/Header";
import AdBanner from "../../src/components/AdBanner";
import LoadingScreen from "../../src/components/LoadingScreen";
import { useEffect } from "react";

export default function DashboardScreen() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  // 未認証の場合はログイン画面にリダイレクト
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // 言語切り替えボタンコンポーネント（ログイン済み）
  const languageSwitcherAuth = (
    <View
      style={styles.languageSwitcherHeader}
      nativeID="language-switcher-auth"
    >
      <TouchableOpacity
        style={[
          styles.langButtonHeader,
          language === "en" && styles.langButtonActiveHeader,
        ]}
        onPress={() => setLanguage("en")}
        nativeID="lang-btn-en-auth"
      >
        <Text
          style={[
            styles.langButtonTextHeader,
            language === "en" && styles.langButtonTextActiveHeader,
          ]}
          nativeID="lang-text-en-auth"
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
        nativeID="lang-btn-ja-auth"
      >
        <Text
          style={[
            styles.langButtonTextHeader,
            language === "ja" && styles.langButtonTextActiveHeader,
          ]}
          nativeID="lang-text-ja-auth"
        >
          日本語
        </Text>
      </TouchableOpacity>
    </View>
  );

  const headerMyPageLink = (
    <TouchableOpacity
      style={styles.headerCornerButton}
      onPress={() => router.push("/(app)/mypage")}
      testID="header-btn-mypage"
    >
      <Text
        style={[
          styles.headerCornerButtonText,
          { fontSize: isSmallScreen ? 14 : 16 },
        ]}
        nativeID="header-mypage-text"
      >
        {t("My Profile", "マイページ")}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper} nativeID="dashboard-wrapper">
      <Header
        leftComponent={headerMyPageLink}
        rightComponent={languageSwitcherAuth}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        nativeID="dashboard-scroll"
      >
        <View
          style={[styles.container, { padding: isSmallScreen ? 16 : 20 }]}
          nativeID="dashboard-container"
        >
          <Text style={styles.title} nativeID="welcome-title">
            {t("Welcome", "ようこそ")}, {user?.full_name}!
          </Text>
          <Text style={styles.email} nativeID="user-email">
            {user?.email}
          </Text>

          <View style={styles.menuContainer} nativeID="menu-container">
            <TouchableOpacity
              style={[styles.menuButton, styles.recordsButton]}
              onPress={() => router.push("/(app)/study-records")}
              nativeID="menu-btn-study-records"
            >
              <Text
                style={styles.menuButtonText}
                nativeID="menu-text-study-records"
              >
                {t("Study Records", "学習記録")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuButton, styles.learningPlanButton]}
              onPress={() => router.push("/(app)/learning-plan")}
              nativeID="menu-btn-learning-plan"
            >
              <Text
                style={styles.menuButtonText}
                nativeID="menu-text-learning-plan"
              >
                {t("AI Learning Plan", "AI学習プラン")}
              </Text>
            </TouchableOpacity>

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
              style={[styles.menuButton, styles.storeButton]}
              onPress={() => router.push("/(app)/store")}
              nativeID="menu-btn-store"
            >
              <Text style={styles.menuButtonText} nativeID="menu-text-store">
                {t("Question Set Store", "問題集ストア")}
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
              style={[styles.menuButton, styles.profileButton]}
              onPress={() => router.push("/(app)/mypage")}
              nativeID="menu-btn-mypage"
            >
              <Text style={styles.menuButtonText} nativeID="menu-text-mypage">
                {t("My Profile", "マイページ")}
              </Text>
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

            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <TouchableOpacity
                style={[styles.menuButton, styles.adminButton]}
                onPress={() => router.push("/(app)/admin/index")}
                nativeID="menu-btn-admin"
              >
                <Text style={styles.menuButtonText} nativeID="menu-text-admin">
                  {t("Admin Panel", "管理者パネル")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.logoutButton,
              {
                maxWidth: isSmallScreen ? "100%" : isMediumScreen ? 350 : 400,
                padding: isSmallScreen ? 14 : 16,
              },
            ]}
            onPress={logout}
            nativeID="btn-logout"
          >
            <Text
              style={[styles.buttonText, { fontSize: isSmallScreen ? 14 : 16 }]}
              nativeID="btn-logout-text"
            >
              {t("Logout", "ログアウト")}
            </Text>
          </TouchableOpacity>
          <AdBanner />
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
  langButtonHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  langButtonActiveHeader: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  langButtonTextHeader: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
  storeButton: {
    backgroundColor: "#FF9500",
  },
  sellerButton: {
    backgroundColor: "#34C759",
  },
  profileButton: {
    backgroundColor: "#9C27B0",
  },
  recordsButton: {
    backgroundColor: "#2ECC71",
  },
  learningPlanButton: {
    backgroundColor: "#8E44AD",
  },
  settingsButton: {
    backgroundColor: "#FF9500",
  },
  adminButton: {
    backgroundColor: "#5856D6",
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
  },
});

