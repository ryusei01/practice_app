import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  sendOTPCode,
  verifyOTPCode,
  verifyBackupCode,
} from "../../src/api/twoFactor";

export default function VerifyOTPScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // 自動的にOTPを送信
    handleSendOTP();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async () => {
    if (countdown > 0) return;

    setSendingOTP(true);
    try {
      const response = await sendOTPCode();
      Alert.alert("成功", response.message);
      setCountdown(60); // 60秒間再送信不可
    } catch (error: any) {
      Alert.alert(
        "エラー",
        error.response?.data?.detail || "OTPコード送信に失敗しました"
      );
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length < 6) {
      Alert.alert("エラー", useBackupCode ? "バックアップコードを入力してください" : "6桁のコードを入力してください");
      return;
    }

    setLoading(true);
    try {
      if (useBackupCode) {
        await verifyBackupCode(code);
        Alert.alert("成功", "バックアップコードが正しく検証されました");
      } else {
        await verifyOTPCode(code);
        Alert.alert("成功", "OTPコードが正しく検証されました");
      }

      // 検証成功後、前の画面に戻る
      router.back();
    } catch (error: any) {
      Alert.alert(
        "エラー",
        error.response?.data?.detail || "コード検証に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {useBackupCode ? "バックアップコード入力" : "2段階認証"}
        </Text>

        {!useBackupCode && (
          <Text style={styles.description}>
            メールアドレスに送信された6桁のコードを入力してください
          </Text>
        )}

        {useBackupCode && (
          <Text style={styles.description}>
            バックアップコードを入力してください（各コードは1回のみ使用可能）
          </Text>
        )}

        <TextInput
          style={styles.input}
          placeholder={useBackupCode ? "A1B2C3D4" : "123456"}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          keyboardType={useBackupCode ? "default" : "number-pad"}
          maxLength={useBackupCode ? 8 : 6}
          autoCapitalize="characters"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleVerifyCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>確認</Text>
          )}
        </TouchableOpacity>

        {!useBackupCode && (
          <>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonSecondary,
                countdown > 0 && styles.buttonDisabled,
              ]}
              onPress={handleSendOTP}
              disabled={sendingOTP || countdown > 0}
            >
              {sendingOTP ? (
                <ActivityIndicator color="#4CAF50" />
              ) : (
                <Text style={[styles.buttonTextSecondary]}>
                  {countdown > 0
                    ? `再送信 (${countdown}秒)`
                    : "コードを再送信"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setUseBackupCode(!useBackupCode);
                setCode("");
              }}
            >
              <Text style={styles.linkText}>
                {useBackupCode
                  ? "メールコードを使用"
                  : "バックアップコードを使用"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {useBackupCode && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setUseBackupCode(false);
              setCode("");
            }}
          >
            <Text style={styles.linkText}>メールコードに戻る</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 18,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    fontFamily: "monospace",
    marginBottom: 20,
  },
  button: {
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonPrimary: {
    backgroundColor: "#4CAF50",
  },
  buttonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#4CAF50",
    fontSize: 18,
    fontWeight: "600",
  },
  linkButton: {
    padding: 10,
    alignItems: "center",
  },
  linkText: {
    color: "#4CAF50",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
