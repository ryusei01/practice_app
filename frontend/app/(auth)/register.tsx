import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // パスワード要件のチェック
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  const handleRegister = async () => {
    console.log("[Register] handleRegister called");
    console.log("[Register] Form values:", {
      fullName,
      email,
      password: "***",
      confirmPassword: "***",
    });

    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert(
        t("Error", "エラー"),
        t("Please fill in all fields", "すべてのフィールドを入力してください")
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        t("Error", "エラー"),
        t("Passwords do not match", "パスワードが一致しません")
      );
      return;
    }

    // バックエンドのパスワード強度要件に合わせる
    if (password.length < 8) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Password must be at least 8 characters",
          "パスワードは8文字以上である必要があります"
        )
      );
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Password must contain at least one uppercase letter",
          "パスワードには大文字を含める必要があります"
        )
      );
      return;
    }

    if (!/[a-z]/.test(password)) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Password must contain at least one lowercase letter",
          "パスワードには小文字を含める必要があります"
        )
      );
      return;
    }

    if (!/[0-9]/.test(password)) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Password must contain at least one number",
          "パスワードには数字を含める必要があります"
        )
      );
      return;
    }

    console.log("[Register] Validation passed, calling register API...");
    setIsLoading(true);
    try {
      await register(email, password, fullName);
      console.log("[Register] Registration successful");
      router.replace("/");
    } catch (error: any) {
      console.error("[Register] Registration failed:", error);
      console.error("[Register] Error details:", error.response?.data);

      // エラー詳細を取得
      let errorMessage = t(
        "Unable to create account",
        "アカウントを作成できませんでした"
      );

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;

        // 配列の場合（バリデーションエラー）
        if (Array.isArray(detail)) {
          console.error("[Register] Validation errors:", detail);
          errorMessage = detail
            .map((err: any) => {
              if (err.msg) return err.msg;
              if (err.message) return err.message;
              return JSON.stringify(err);
            })
            .join("\n");
        }
        // 文字列の場合
        else if (typeof detail === "string") {
          errorMessage = detail;
        }
        // オブジェクトの場合
        else {
          errorMessage = JSON.stringify(detail);
        }
      }

      Alert.alert(t("Registration Failed", "登録失敗"), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>
          {t("Create Account", "アカウント作成")}
        </Text>
        <Text style={styles.subtitle}>
          {t("Sign up to get started", "登録して始めましょう")}
        </Text>

        {/* Under Preparation Overlay */}
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {t("Under Preparation", "準備中")}
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t("Full Name", "名前")}
          placeholderTextColor="#999"
          value={fullName}
          onChangeText={setFullName}
          editable={!isLoading}
        />

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
          onChangeText={(text) => {
            setPassword(text);
            setShowPasswordRequirements(true);
          }}
          secureTextEntry
          editable={!isLoading}
        />

        {showPasswordRequirements && password.length > 0 && (
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>
              {t("Password Requirements:", "パスワード要件:")}
            </Text>
            <View style={styles.requirementItem}>
              <Text
                style={
                  passwordRequirements.minLength
                    ? styles.requirementMet
                    : styles.requirementUnmet
                }
              >
                {passwordRequirements.minLength ? "✓" : "✗"}
              </Text>
              <Text
                style={
                  passwordRequirements.minLength
                    ? styles.requirementTextMet
                    : styles.requirementTextUnmet
                }
              >
                {t("At least 8 characters", "8文字以上")}
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Text
                style={
                  passwordRequirements.hasUpperCase
                    ? styles.requirementMet
                    : styles.requirementUnmet
                }
              >
                {passwordRequirements.hasUpperCase ? "✓" : "✗"}
              </Text>
              <Text
                style={
                  passwordRequirements.hasUpperCase
                    ? styles.requirementTextMet
                    : styles.requirementTextUnmet
                }
              >
                {t("One uppercase letter (A-Z)", "大文字1文字以上 (A-Z)")}
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Text
                style={
                  passwordRequirements.hasLowerCase
                    ? styles.requirementMet
                    : styles.requirementUnmet
                }
              >
                {passwordRequirements.hasLowerCase ? "✓" : "✗"}
              </Text>
              <Text
                style={
                  passwordRequirements.hasLowerCase
                    ? styles.requirementTextMet
                    : styles.requirementTextUnmet
                }
              >
                {t("One lowercase letter (a-z)", "小文字1文字以上 (a-z)")}
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Text
                style={
                  passwordRequirements.hasNumber
                    ? styles.requirementMet
                    : styles.requirementUnmet
                }
              >
                {passwordRequirements.hasNumber ? "✓" : "✗"}
              </Text>
              <Text
                style={
                  passwordRequirements.hasNumber
                    ? styles.requirementTextMet
                    : styles.requirementTextUnmet
                }
              >
                {t("One number (0-9)", "数字1文字以上 (0-9)")}
              </Text>
            </View>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={t("Confirm Password", "パスワード確認")}
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading}
        />

        {confirmPassword.length > 0 && password !== confirmPassword && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              ✗ {t("Passwords do not match", "パスワードが一致しません")}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (isLoading ||
              !isPasswordValid ||
              (confirmPassword.length > 0 && password !== confirmPassword)) &&
              styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={
            true
            //isLoading || !isPasswordValid || (confirmPassword.length > 0 && password !== confirmPassword)
          }
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("Sign Up", "新規登録")}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>
            {t("Already have an account? ", "既にアカウントをお持ちの方 ")}
          </Text>
          <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
            <Text style={styles.loginLink}>{t("Sign In", "ログイン")}</Text>
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
    marginBottom: 16,
    textAlign: "center",
  },
  passwordRequirements: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 18,
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
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: "#666",
  },
  loginLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  requirementsContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  requirementMet: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "bold",
    marginRight: 8,
    width: 20,
  },
  requirementUnmet: {
    fontSize: 16,
    color: "#F44336",
    fontWeight: "bold",
    marginRight: 8,
    width: 20,
  },
  requirementTextMet: {
    fontSize: 13,
    color: "#4CAF50",
    flex: 1,
  },
  requirementTextUnmet: {
    fontSize: 13,
    color: "#F44336",
    flex: 1,
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F44336",
  },
  errorText: {
    fontSize: 13,
    color: "#D32F2F",
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    zIndex: 1000,
  },
  overlayText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
});
