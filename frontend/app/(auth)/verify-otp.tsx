import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function VerifyOTPScreen() {
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(600); // 10分 = 600秒
  const { t } = useLanguage();
  const router = useRouter();
  const { userId, email } = useLocalSearchParams();

  // タイマー
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert(
        t("Error", "エラー"),
        t("Please enter a 6-digit code", "6桁のコードを入力してください")
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        user_id: userId,
        otp_code: otpCode,
      });

      // トークンを保存
      await AsyncStorage.setItem("access_token", response.data.access_token);
      await AsyncStorage.setItem("refresh_token", response.data.refresh_token);

      Alert.alert(
        t("Success", "成功"),
        t("Account verified successfully!", "アカウントが認証されました！"),
        [
          {
            text: "OK",
            onPress: () => router.replace("/"),
          },
        ]
      );
    } catch (error: any) {
      console.error("[VerifyOTP] Verification failed:", error);

      let errorMessage = t(
        "Unable to verify code",
        "コードを確認できませんでした"
      );

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        }
      }

      Alert.alert(t("Verification Failed", "認証失敗"), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/resend-otp`, {
        user_id: userId,
      });

      // タイマーをリセット
      setTimer(600);
      setOtpCode("");

      Alert.alert(
        t("Success", "成功"),
        t("A new code has been sent to your email", "新しいコードをメールに送信しました")
      );
    } catch (error: any) {
      console.error("[VerifyOTP] Resend failed:", error);

      let errorMessage = t(
        "Unable to resend code",
        "コードを再送信できませんでした"
      );

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        }
      }

      Alert.alert(t("Error", "エラー"), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>
          {t("Verify Your Email", "メール認証")}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            "We've sent a 6-digit code to",
            "6桁の認証コードを送信しました"
          )}
        </Text>
        <Text style={styles.email}>{email}</Text>

        <TextInput
          style={styles.input}
          placeholder={t("Enter 6-digit code", "6桁のコードを入力")}
          placeholderTextColor="#999"
          value={otpCode}
          onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!isLoading}
          autoFocus
        />

        <View style={styles.timerContainer}>
          <Text
            style={[
              styles.timerText,
              timer === 0 && styles.timerExpired,
            ]}
          >
            {timer > 0
              ? t(`Time remaining: ${formatTime(timer)}`, `残り時間: ${formatTime(timer)}`)
              : t("Code expired", "コードが期限切れです")}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (isLoading || otpCode.length !== 6) && styles.buttonDisabled,
          ]}
          onPress={handleVerifyOTP}
          disabled={isLoading || otpCode.length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("Verify", "認証する")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={isLoading || timer > 540} // 最初の1分間は再送信不可
        >
          <Text
            style={[
              styles.resendButtonText,
              (isLoading || timer > 540) && styles.resendButtonDisabled,
            ]}
          >
            {t("Resend code", "コードを再送信")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>
            {t("Back to registration", "登録画面に戻る")}
          </Text>
        </TouchableOpacity>
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
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    textAlign: "center",
  },
  email: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 8,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  timerContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  timerText: {
    fontSize: 14,
    color: "#666",
  },
  timerExpired: {
    color: "#F44336",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  resendButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  resendButtonDisabled: {
    color: "#B0B0B0",
  },
  backButton: {
    padding: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#666",
    fontSize: 14,
  },
});
