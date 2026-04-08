import React, { useState, useEffect } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import Header from "../../src/components/Header";
import AppModal from "../../src/components/Modal";
import { getApiErrorMessage } from "../../src/utils/apiError";
// 2FA UI は現状非表示（Google OAuth 前提のため）

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <Header title={t("Security Settings", "セキュリティ設定")} />
      <ScrollView style={styles.container}>

      {/* マイページへのリンク */}
      <View
        style={[
          styles.section,
          {
            margin: isSmallScreen ? 12 : 15,
            padding: isSmallScreen ? 16 : 20,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/(app)/mypage")}
          testID="settings-to-mypage-button"
        >
          <Text style={styles.linkButtonText}>
            {t("Go to My Profile", "マイページへ")} →
          </Text>
        </TouchableOpacity>
      </View>

      {/* 結果表示モーダル */}
      <AppModal
        visible={resultModal.visible}
        title={resultModal.title}
        message={resultModal.message}
        onClose={() => setResultModal({ visible: false, title: "", message: "" })}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 20,
    borderRadius: 10,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    lineHeight: 20,
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    backgroundColor: "#9C27B0",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  linkButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
