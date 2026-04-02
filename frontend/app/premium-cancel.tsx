import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useLanguage } from "../src/contexts/LanguageContext";

export default function PremiumCancelScreen() {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t("Checkout cancelled", "お支払いはキャンセルされました")}
      </Text>
      <Text style={styles.note}>
        {t(
          "No charge was made. You can upgrade anytime from My Page.",
          "課金は行われていません。マイページからいつでもアップグレードできます。"
        )}
      </Text>
      <TouchableOpacity
        style={styles.primary}
        onPress={() => router.replace("/(app)/premium-upgrade")}
      >
        <Text style={styles.primaryText}>
          {t("Back to Premium plan", "プレミアムプランへ戻る")}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondary}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.secondaryText}>{t("Home", "ホーム")}</Text>
      </TouchableOpacity>
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
  },
  secondaryText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
  },
});
