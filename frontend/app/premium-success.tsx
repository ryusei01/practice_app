import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useLanguage } from "../src/contexts/LanguageContext";

const MAX_ATTEMPTS = 8;
const RETRY_MS = 2000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function PremiumSuccessScreen() {
  const { refreshUser } = useAuth();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"loading" | "ok" | "pending" | "nologin">(
    "loading"
  );

  const pollPremium = useCallback(async () => {
    let u = await refreshUser();
    if (!u) {
      setPhase("nologin");
      return;
    }
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (u.is_premium) {
        setPhase("ok");
        return;
      }
      if (i === MAX_ATTEMPTS - 1) break;
      await sleep(RETRY_MS);
      const next = await refreshUser();
      if (next) u = next;
    }
    setPhase("pending");
  }, [refreshUser]);

  useEffect(() => {
    pollPremium();
  }, [pollPremium]);

  return (
    <View style={styles.container}>
      {phase === "loading" && (
        <>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.title}>
            {t("Confirming your purchase…", "購入を確認しています…")}
          </Text>
          <Text style={styles.note}>
            {t(
              "This may take a few seconds after payment.",
              "決済直後は数秒かかることがあります。"
            )}
          </Text>
        </>
      )}

      {phase === "ok" && (
        <>
          <Text style={styles.emoji}>✓</Text>
          <Text style={styles.title}>
            {t("Welcome to Premium!", "プレミアムへようこそ！")}
          </Text>
          <Text style={styles.note}>
            {t(
              "Cloud sync and other premium features are now available.",
              "クラウド同期などのプレミアム機能が利用できます。"
            )}
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.replace("/(app)/dashboard")}
          >
            <Text style={styles.primaryText}>
              {t("Go to dashboard", "ダッシュボードへ")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => router.replace("/(app)/premium-upgrade")}
          >
            <Text style={styles.secondaryText}>
              {t("Migrate local data", "ローカルデータをクラウドへ移行")}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {phase === "pending" && (
        <>
          <Text style={styles.title}>
            {t("Payment received — status updating", "お支払いを受け付けました")}
          </Text>
          <Text style={styles.note}>
            {t(
              "Premium may take a minute to activate. Open My Page and pull to refresh, or log in again.",
              "反映に1分ほどかかる場合があります。マイページを開き更新するか、一度ログインし直してください。"
            )}
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.replace("/(app)/mypage")}
          >
            <Text style={styles.primaryText}>{t("My page", "マイページ")}</Text>
          </TouchableOpacity>
        </>
      )}

      {phase === "nologin" && (
        <>
          <Text style={styles.title}>
            {t("Session not found", "ログイン状態を確認できません")}
          </Text>
          <Text style={styles.note}>
            {t(
              "Open this app in the same browser where you signed in, then try again.",
              "サインインしたのと同じブラウザでアプリを開き直してください。"
            )}
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.primaryText}>{t("Sign in", "ログイン")}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
    color: "#16a34a",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 12,
  },
  note: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 400,
  },
  primary: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondary: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryText: {
    color: "#6366f1",
    fontSize: 15,
    fontWeight: "600",
  },
});
