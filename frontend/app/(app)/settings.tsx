import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getTwoFactorStatus,
  enableTwoFactor,
  disableTwoFactor,
  type Enable2FAResponse,
} from "../../src/api/twoFactor";

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);

  useEffect(() => {
    loadTwoFactorStatus();
  }, []);

  const loadTwoFactorStatus = async () => {
    try {
      const status = await getTwoFactorStatus();
      setTwoFactorEnabled(status.two_factor_enabled);
      setUserEmail(status.email);
    } catch (error) {
      console.error("Failed to load 2FA status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    Alert.alert(
      "2段階認証を有効化",
      "2段階認証を有効にすると、ログイン時にメールで送られるコードの入力が必要になります。続けますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "有効化",
          onPress: async () => {
            setLoading(true);
            try {
              const response: Enable2FAResponse = await enableTwoFactor();
              setTwoFactorEnabled(true);
              setBackupCodes(response.backup_codes);
              setShowBackupCodesModal(true);

              Alert.alert(
                "成功",
                "2段階認証が有効化されました。バックアップコードをメールで送信しました。"
              );
            } catch (error: any) {
              Alert.alert(
                "エラー",
                error.response?.data?.detail || "2FA有効化に失敗しました"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDisable2FA = async () => {
    if (!password) {
      Alert.alert("エラー", "パスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      await disableTwoFactor(password);
      setTwoFactorEnabled(false);
      setShowDisableModal(false);
      setPassword("");
      Alert.alert("成功", "2段階認証を無効化しました");
    } catch (error: any) {
      Alert.alert(
        "エラー",
        error.response?.data?.detail || "2FA無効化に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && !showDisableModal && !showBackupCodesModal) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>セキュリティ設定</Text>
      </View>

      {/* 2段階認証セクション */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2段階認証</Text>
          <View
            style={[
              styles.badge,
              twoFactorEnabled ? styles.badgeEnabled : styles.badgeDisabled,
            ]}
          >
            <Text style={styles.badgeText}>
              {twoFactorEnabled ? "有効" : "無効"}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>
          メールアドレス: <Text style={styles.email}>{userEmail}</Text>
        </Text>

        <Text style={styles.description}>
          2段階認証を有効にすると、ログイン時にメールで送られる確認コードの入力が必要になります。
        </Text>

        {twoFactorEnabled ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={() => setShowDisableModal(true)}
          >
            <Text style={styles.buttonText}>2段階認証を無効化</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleEnable2FA}
          >
            <Text style={styles.buttonText}>2段階認証を有効化</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* バックアップコード表示モーダル */}
      <Modal
        visible={showBackupCodesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBackupCodesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>バックアップコード</Text>
            <Text style={styles.modalDescription}>
              以下のバックアップコードを安全な場所に保管してください。
              メールにアクセスできない場合に使用できます。
            </Text>

            <ScrollView style={styles.codesContainer}>
              {backupCodes.map((code, index) => (
                <View key={index} style={styles.codeItem}>
                  <Text style={styles.codeText}>{code}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.warningText}>
              ⚠️ 各コードは1回のみ使用できます
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => setShowBackupCodesModal(false)}
            >
              <Text style={styles.buttonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 無効化確認モーダル */}
      <Modal
        visible={showDisableModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDisableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>2段階認証を無効化</Text>
            <Text style={styles.modalDescription}>
              パスワードを入力して確認してください
            </Text>

            <TextInput
              style={styles.input}
              placeholder="パスワード"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setShowDisableModal(false);
                  setPassword("");
                }}
              >
                <Text style={styles.buttonText}>キャンセル</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleDisable2FA}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>無効化</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  section: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  badgeEnabled: {
    backgroundColor: "#4CAF50",
  },
  badgeDisabled: {
    backgroundColor: "#999",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    lineHeight: 20,
  },
  email: {
    fontWeight: "600",
    color: "#4CAF50",
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  buttonPrimary: {
    backgroundColor: "#4CAF50",
  },
  buttonDanger: {
    backgroundColor: "#f44336",
  },
  buttonSecondary: {
    backgroundColor: "#757575",
    flex: 1,
    marginRight: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 25,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  modalDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codesContainer: {
    maxHeight: 300,
    marginBottom: 15,
  },
  codeItem: {
    backgroundColor: "#f4f4f4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    letterSpacing: 2,
  },
  warningText: {
    color: "#ff9800",
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
  },
});
