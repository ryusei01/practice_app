import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useLanguage } from "../src/contexts/LanguageContext";

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        {/* Language Switcher */}
        <View style={styles.languageSwitcher}>
          <TouchableOpacity
            style={[
              styles.langButton,
              language === "en" && styles.langButtonActive,
            ]}
            onPress={() => setLanguage("en")}
          >
            <Text
              style={[
                styles.langButtonText,
                language === "en" && styles.langButtonTextActive,
              ]}
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
          >
            <Text
              style={[
                styles.langButtonText,
                language === "ja" && styles.langButtonTextActive,
              ]}
            >
              日本語
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {t("Quiz Marketplace", "クイズマーケットプレイス")}
        </Text>
        <Text style={styles.subtitle}>
          {t("AI-Powered Learning Platform", "AI搭載学習プラットフォーム")}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.buttonText}>{t("Sign In", "ログイン")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOutline]}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={[styles.buttonText, styles.buttonOutlineText]}>
            {t("Sign Up", "新規登録")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Language Switcher */}
      <View style={styles.languageSwitcher}>
        <TouchableOpacity
          style={[
            styles.langButton,
            language === "en" && styles.langButtonActive,
          ]}
          onPress={() => setLanguage("en")}
        >
          <Text
            style={[
              styles.langButtonText,
              language === "en" && styles.langButtonTextActive,
            ]}
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
        >
          <Text
            style={[
              styles.langButtonText,
              language === "ja" && styles.langButtonTextActive,
            ]}
          >
            日本語
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>
        {t("Welcome", "ようこそ")}, {user?.full_name}!
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(app)/ai-dashboard")}
        >
          <Text style={styles.menuButtonText}>
            {t("AI Dashboard", "AIダッシュボード")}
          </Text>
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {t("Under Preparation", "準備中")}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(app)/question-sets")}
        >
          <Text style={styles.menuButtonText}>
            {t("My Question Sets", "マイ問題集")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push("/(app)/question-sets/create")}
        >
          <Text style={styles.menuButtonText}>
            {t("Create Question Set", "問題集を作成")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.sellerButton]}
          onPress={() => router.push("/(app)/seller-dashboard")}
        >
          <Text style={styles.menuButtonText}>
            {t("Seller Dashboard", "販売者ダッシュボード")}
          </Text>
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {t("Under Preparation", "準備中")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.logoutButton]}
        onPress={logout}
      >
        <Text style={styles.buttonText}>{t("Logout", "ログアウト")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  languageSwitcher: {
    position: "absolute",
    top: 50,
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
});
