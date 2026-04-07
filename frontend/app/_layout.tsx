import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { Platform, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebThirdPartyScripts } from "../src/components/WebThirdPartyScripts";
import { AuthProvider } from "../src/contexts/AuthContext";
import { LanguageProvider } from "../src/contexts/LanguageContext";
import { GlobalApiErrorModalProvider } from "../src/contexts/GlobalApiErrorModalContext";

/** レンダリング例外を捕捉し、再試行・ホームへ導線を表示する */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={errorStyles.safe}>
      <View style={errorStyles.container}>
        <Text style={errorStyles.title}>エラーが発生しました</Text>
        <Text style={errorStyles.subtitle}>Something went wrong</Text>
        <Text style={errorStyles.message} selectable>
          {error.message}
        </Text>
        <TouchableOpacity style={errorStyles.primary} onPress={retry}>
          <Text style={errorStyles.primaryText}>再試行 / Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={errorStyles.secondary}
          onPress={() => router.replace("/")}
        >
          <Text style={errorStyles.secondaryText}>ホームへ / Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const errorStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f5f5" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: { fontSize: 15, color: "#666", marginBottom: 16 },
  message: {
    fontSize: 14,
    color: "#444",
    marginBottom: 24,
    lineHeight: 20,
  },
  primary: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  secondaryText: { color: "#007AFF", fontSize: 16, fontWeight: "600" },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {Platform.OS === "web" && <WebThirdPartyScripts />}

      <LanguageProvider>
        <GlobalApiErrorModalProvider>
          <AuthProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(app)/question-sets/index" />
              <Stack.Screen name="(app)/my-question-sets/index" />
              <Stack.Screen name="(app)/question-sets/create" />
              <Stack.Screen name="(app)/question-sets/[id]" />
              <Stack.Screen name="(app)/question-sets/[id]/add-question" />
              <Stack.Screen name="(app)/question-sets/[id]/textbook" />
              <Stack.Screen
                name="(app)/question-sets/[id]/edit-textbook"
                options={{ headerShown: true, title: "教科書を編集" }}
              />
              <Stack.Screen name="(app)/quiz/[id]" />
              <Stack.Screen name="(app)/ai-dashboard" />
              <Stack.Screen name="(app)/store" />
              <Stack.Screen name="(app)/seller-dashboard" />
              <Stack.Screen name="(app)/admin/index" />
              <Stack.Screen name="(app)/settings" />
              <Stack.Screen name="(app)/mypage" />
              <Stack.Screen name="(app)/verify-otp" />
              <Stack.Screen name="(trial)" />
              <Stack.Screen name="(app)/flashcard/[id]" />
              <Stack.Screen name="(public)/privacy-policy" />
              <Stack.Screen name="(public)/terms-of-service" />
              <Stack.Screen name="(public)/tokusho" />
              <Stack.Screen name="premium-success" />
              <Stack.Screen name="premium-cancel" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AuthProvider>
        </GlobalApiErrorModalProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
