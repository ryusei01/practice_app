/**
 * 20問ごとに表示するインタースティシャル風広告モーダル
 * - カウントダウン後に閉じるボタンが有効化
 * - プレミアムユーザーには表示しない（即 onClose）
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

/* ── platform-resolved ad component ── */
import AdBanner from "./AdBanner";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CLOSE_DELAY_SEC = 5;

export default function InterstitialAdModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState(CLOSE_DELAY_SEC);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCountdown(CLOSE_DELAY_SEC);
      setCanClose(false);
      return;
    }

    if (user?.is_premium) {
      onClose();
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (user?.is_premium) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => {
        if (canClose) onClose();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t("Sponsored", "広告")}</Text>

          <View style={styles.adArea}>
            <AdBanner />
          </View>

          {canClose ? (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>
                {t("Close", "閉じる")}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>
                {t(
                  `You can close in ${countdown}s`,
                  `${countdown}秒後に閉じられます`,
                )}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "90%",
    maxWidth: 420,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    color: "#999",
    marginBottom: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  adArea: {
    width: "100%",
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  countdownContainer: {
    paddingVertical: 12,
  },
  countdownText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
});
