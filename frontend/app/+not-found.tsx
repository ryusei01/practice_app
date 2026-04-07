import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * 未定義ルート（Web では HTTP 404 として扱われる）
 */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.code}>404</Text>
          <Text style={styles.title}>ページが見つかりません</Text>
          <Text style={styles.subtitle}>Page not found</Text>
          <Text style={styles.hint}>
            URL が間違っているか、移動・削除された可能性があります。
          </Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>ホームに戻る / Back to home</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  code: {
    fontSize: 48,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 360,
  },
  link: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  linkText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
