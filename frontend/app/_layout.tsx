import { Stack } from "expo-router";
import { Platform } from "react-native";
import { WebThirdPartyScripts } from "../src/components/WebThirdPartyScripts";
import { AuthProvider } from "../src/contexts/AuthContext";
import { LanguageProvider } from "../src/contexts/LanguageContext";

export default function RootLayout() {
  return (
    <>
      {Platform.OS === "web" && <WebThirdPartyScripts />}

      <LanguageProvider>
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
          </Stack>
        </AuthProvider>
      </LanguageProvider>
    </>
  );
}
