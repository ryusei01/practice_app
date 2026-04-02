import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";

/**
 * 会員登録は Google ログインで行う。
 * 利用規約・著作権条項の重要箇所を登録導線で明示する（プラン: register での同意文脈）。
 */
export default function RegisterScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmall = width < 600;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { maxWidth: 560, alignSelf: "center", width: "100%" },
      ]}
    >
      <Text style={[styles.title, { fontSize: isSmall ? 20 : 22 }]}>
        {t("Before you sign up", "登録・ログインの前に")}
      </Text>
      <Text style={styles.lead}>
        {t(
          "Create an account by signing in with Google on the next screen. Please review the following regarding copyright.",
          "アカウントは次の画面で Google ログインして作成します。著作権に関する取り決めをご確認ください。"
        )}
      </Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>
          {t("User content and copyright", "投稿コンテンツと著作権")}
        </Text>
        <Bullet
          text={t(
            "Copyright in content you post remains with you as the poster.",
            "投稿したコンテンツの著作権は、投稿者であるあなたに帰属します。"
          )}
        />
        <Bullet
          text={t(
            "You may not post content that infringes third-party rights, including full copying of commercial question books, past exams, or paid course materials.",
            "市販の問題集の丸写し・過去問の全文転載・有料教材の無断複製など、第三者の著作権を侵害するコンテンツの投稿は禁止です。"
          )}
        />
        <Bullet
          text={t(
            "We may remove violating content or suspend accounts without prior notice.",
            "違反が判明した場合、事前の通知なくコンテンツを削除したり、アカウントを停止することがあります。"
          )}
        />
      </View>

      <TouchableOpacity
        style={styles.termsLink}
        onPress={() => router.push("/(public)/terms-of-service")}
        accessibilityRole="link"
      >
        <Text style={styles.termsLinkText}>
          {t("Read full Terms of Service", "利用規約全文を読む")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.replace("/(auth)/login")}
      >
        <Text style={styles.primaryButtonText}>
          {t("Continue to Google sign-in", "Googleでサインインに進む")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryButtonText}>
          {t("Back", "戻る")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 24, paddingTop: 48, paddingBottom: 40 },
  title: {
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  lead: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginBottom: 20,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    color: "#4A90E2",
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
  },
  termsLink: {
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  termsLinkText: {
    fontSize: 14,
    color: "#4A90E2",
    textDecorationLine: "underline",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    color: "#666",
  },
});
