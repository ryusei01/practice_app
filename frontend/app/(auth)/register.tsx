import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions,
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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

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
      agreedToTerms,
    });

    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert(
        t("Error", "エラー"),
        t("Please fill in all fields", "すべてのフィールドを入力してください")
      );
      return;
    }

    if (!agreedToTerms) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Please agree to the Terms and Privacy Policy",
          "利用規約とプライバシーポリシーに同意してください"
        )
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
      const response = await register(email, password, fullName);
      console.log(
        "[Register] Registration successful, redirecting to OTP verification"
      );

      // OTP入力画面に遷移
      router.push({
        pathname: "/(auth)/verify-otp",
        params: {
          userId: response.user_id,
          email: response.email,
        },
      });
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
      <View
        style={[
          styles.formContainer,
          {
            width: isSmallScreen ? "100%" : isMediumScreen ? "85%" : 500,
            maxWidth: 600,
            padding: isSmallScreen ? 20 : 24,
          },
        ]}
      >
        <Text style={[styles.title, { fontSize: isSmallScreen ? 24 : 28 }]}>
          {t("Create Account", "アカウント作成")}
        </Text>
        <Text style={[styles.subtitle, { fontSize: isSmallScreen ? 14 : 16 }]}>
          {t("Sign up to get started", "登録して始めましょう")}
        </Text>

        {/* Under Preparation Overlay */}
        {/* <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {t("Under Preparation", "準備中")}
          </Text>
        </View> */}

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
          style={[
            styles.input,
            {
              padding: isSmallScreen ? 14 : 16,
              fontSize: isSmallScreen ? 15 : 16,
            },
          ]}
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

        {/* Terms and Privacy Policy Agreement */}
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            disabled={isLoading}
          >
            <View
              style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}
            >
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              {t("I agree to the ", "私は")}
              <Text
                style={styles.linkText}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowTermsModal(true);
                }}
              >
                {t("Terms of Service", "利用規約")}
              </Text>
              {t(" and ", "と")}
              <Text
                style={styles.linkText}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowPrivacyModal(true);
                }}
              >
                {t("Privacy Policy", "プライバシーポリシー")}
              </Text>
              {t("", "に同意します")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms Modal */}
        <Modal
          visible={showTermsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTermsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t("Terms of Service", "利用規約")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTermsModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalText}>
                  {t(
                    "Please read the following terms before using this service.\nBy registering, you agree to these terms.",
                    "本サービスをご利用いただく前に、以下の利用規約を必ずお読みください。\n登録を行った時点で、本規約に同意したものとみなします。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("1. Service Overview", "1. サービス概要")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "This service provides online features and content for users.",
                    "本サービスは、ユーザーに提供されるオンライン機能・コンテンツを利用するためのものです。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("2. User Information", "2. ユーザー情報")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "Users must provide accurate and up-to-date information during registration.",
                    "ユーザーは、登録時に正確かつ最新の情報を入力するものとします。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("3. Prohibited Activities", "3. 禁止行為")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "Fraudulent activities, harassment, and infringement of third-party rights are prohibited.",
                    "本サービス上での不正行為、迷惑行為、第三者の権利を侵害する行為は禁止します。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("4. Copyright", "4. 著作権")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "Uploading, sharing, or posting copyrighted materials without permission is prohibited. Unauthorized reproduction or redistribution of educational materials or paid content is also prohibited.",
                    "著作権を侵害する問題集・テキスト・画像・音声等のアップロード、共有、投稿は禁止します。\nまた、他者が権利を有する教材・有料コンテンツの無断複製・転載も禁止します。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("5. Account Restrictions", "5. アカウント制限")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "The operator may restrict, suspend, or delete accounts without prior notice in the following cases:\n• Violation of these terms\n• Copyright infringement or fraudulent use\n• Other cases deemed necessary for service maintenance and security",
                    "運営は、以下に該当する場合、事前通知なしにアカウントの利用制限・停止・削除を行うことがあります。\n・本規約に違反した場合\n・著作権侵害行為や不正利用が確認された場合\n・その他、運営がサービスの維持・安全管理上必要と判断した場合"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("6. Service Changes", "6. サービスの変更")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "This service may be changed, interrupted, or terminated as needed.",
                    "本サービスは、必要に応じて機能の変更、中断、終了を行う可能性があります。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("7. Disclaimer", "7. 免責事項")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "The operator is not responsible for any damages resulting from the use of this service.",
                    "本サービスの利用により生じたいかなる損害についても、運営側は責任を負いません。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("8. Changes to Terms", "8. 規約の変更")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "These terms may be changed without notice. Continued use after changes constitutes agreement to the revised terms.",
                    "当規約は予告なく変更されることがあります。変更後も継続利用した場合、変更に同意したものとみなします。"
                  )}
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowTermsModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {t("Close", "閉じる")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal
          visible={showPrivacyModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPrivacyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t("Privacy Policy", "プライバシーポリシー")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPrivacyModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalText}>
                  {t(
                    "This service collects and uses the following information for user registration and service provision.",
                    "本サービスでは、ユーザー登録およびサービス提供のため、以下の情報を収集し利用します。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("Information Collected", "【収集する情報】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "• Registration information such as email address and password\n• Operation and access information during service use",
                    "・メールアドレス、パスワードなどの登録情報\n・サービス利用中の操作情報、アクセス情報"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("Purpose of Use", "【利用目的】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "• User authentication and account management\n• Analysis for service quality improvement\n• Necessary notifications and communications",
                    "・ユーザー認証およびアカウント管理\n・サービス品質向上のための分析\n・必要な通知・連絡のため"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("Third-Party Disclosure", "【第三者提供について】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "We will not provide information to third parties without user consent, except as required by law.",
                    "法律に基づく場合を除き、ユーザーの同意なく第三者に提供することはありません。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("Information Management", "【情報の管理】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "Collected information will be properly managed, and measures will be taken to prevent unauthorized access, leakage, and tampering.",
                    "取得した情報は適切に管理し、不正アクセス・漏洩・改ざんを防ぐための対策を行います。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("User Rights", "【ユーザーの権利】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "Users can request confirmation, correction, or deletion of their own information.",
                    "ユーザーは、自身の情報の確認・修正・削除を求めることができます。"
                  )}
                </Text>

                <Text style={styles.modalSectionTitle}>
                  {t("Policy Changes", "【ポリシーの変更】")}
                </Text>
                <Text style={styles.modalText}>
                  {t(
                    "The content may be changed as necessary. Continued use of the service after changes constitutes agreement to the revised policy.",
                    "必要に応じて内容を変更することがあります。変更後のサービス利用をもって、変更に同意したものとします。"
                  )}
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowPrivacyModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {t("Close", "閉じる")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={[
            styles.button,
            (isLoading ||
              !isPasswordValid ||
              (confirmPassword.length > 0 && password !== confirmPassword)) &&
              styles.buttonDisabled,
            { padding: isSmallScreen ? 14 : 16 },
          ]}
          onPress={handleRegister}
          disabled={
            isLoading ||
            !isPasswordValid ||
            (confirmPassword.length > 0 && password !== confirmPassword) ||
            !agreedToTerms
          }
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={[styles.buttonText, { fontSize: isSmallScreen ? 15 : 16 }]}
            >
              {t("Sign Up", "新規登録")}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text
            style={[styles.loginText, { fontSize: isSmallScreen ? 13 : 14 }]}
          >
            {t("Already have an account? ", "既にアカウントをお持ちの方 ")}
          </Text>
          <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
            <Text
              style={[styles.loginLink, { fontSize: isSmallScreen ? 13 : 14 }]}
            >
              {t("Sign In", "ログイン")}
            </Text>
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
    alignItems: "center",
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
    width: "100%",
    maxWidth: 600,
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#007AFF",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  linkText: {
    color: "#007AFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  termsContainer: {
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#666",
    fontWeight: "bold",
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
    marginTop: 8,
    marginBottom: 8,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    margin: 20,
    marginTop: 0,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
