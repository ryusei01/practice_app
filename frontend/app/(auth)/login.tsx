import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  // Web版の場合、動的にメタタグを設定
  useEffect(() => {
    if (Platform.OS === "web") {
      // タイトル設定
      const pageTitle =
        language === "ja"
          ? "ログイン - AI Practice Book"
          : "Sign In - AI Practice Book";
      document.title = pageTitle;

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

      const description =
        language === "ja"
          ? "AI Practice Bookにログインして、パーソナライズされた学習、AI推奨問題、進捗管理にアクセス。"
          : "Sign in to AI Practice Book to access personalized learning, AI-powered question recommendations, and track your progress.";

      const ogTitle =
        language === "ja"
          ? "ログイン - AI Practice Book"
          : "Sign In - AI Practice Book";

      const ogDescription =
        language === "ja"
          ? "パーソナライズされたAI学習にアクセスして進捗を管理。"
          : "Sign in to access personalized AI-powered learning and track your progress.";

      setMetaTag("description", description);
      setMetaTag(
        "keywords",
        "login,sign in,AI Practice Book,learning platform,account,ログイン,サインイン,AI学習,アカウント"
      );
      setMetaTag("og:title", ogTitle, true);
      setMetaTag("og:description", ogDescription, true);
      setMetaTag("og:type", "website", true);
      setMetaTag("robots", "noindex, nofollow"); // ログインページは検索エンジンにインデックスしない
    }
  }, [language]);

  const handleLogin = async () => {
    setErrorMessage(""); // エラーメッセージをクリア

    if (!email || !password) {
      setErrorMessage(
        t("Please fill in all fields", "すべてのフィールドを入力してください")
      );
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (error: any) {
      console.error("[Login] Error:", error);
      const message = error.response?.data?.detail ||
        error.message ||
        t("Invalid email or password", "メールアドレスまたはパスワードが無効です");

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToRegister = () => {
    router.push("/(auth)/register");
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>{t("Welcome Back", "おかえりなさい")}</Text>
        <Text style={styles.subtitle}>
          {t("Sign in to continue", "ログインして続ける")}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t("Email", "メールアドレス")}
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder={t("Password", "パスワード")}
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("Sign In", "ログイン")}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>
            {t("Don't have an account? ", "アカウントをお持ちでない方 ")}
          </Text>
          <TouchableOpacity onPress={navigateToRegister} disabled={isLoading}>
            <Text style={styles.registerLink}>{t("Sign Up", "新規登録")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    padding: 20,
  },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
    color: "#666",
  },
  registerLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
});
