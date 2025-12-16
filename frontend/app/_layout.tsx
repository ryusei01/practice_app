import { Stack } from "expo-router";
import Head from "expo-router/head";
import { Platform } from "react-native";
import { AuthProvider } from "../src/contexts/AuthContext";
import { LanguageProvider } from "../src/contexts/LanguageContext";
import { TrialModeProvider } from "../src/contexts/TrialModeContext";
import "../src/i18n";

export default function RootLayout() {
  return (
    <>
      {Platform.OS === "web" && (
        <Head>
          {/* Google tag (gtag.js) */}
          <script
            async
            src="https://www.googletagmanager.com/gtag/js?id=G-XT4CVC965E"
          ></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-XT4CVC965E');
              `,
            }}
          />
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9679910712332333"
            crossOrigin="anonymous"
          ></script>
        </Head>
      )}

      <LanguageProvider>
        <AuthProvider>
          <TrialModeProvider>
            <Stack
              screenOptions={{
                headerShown: false, // すべてのページでデフォルトヘッダーを非表示
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(app)/question-sets/index" />
              <Stack.Screen name="(app)/question-sets/create" />
              <Stack.Screen name="(app)/question-sets/[id]" />
              <Stack.Screen name="(app)/question-sets/[id]/add-question" />
              <Stack.Screen name="(app)/question-sets/[id]/textbook" />
              <Stack.Screen name="(app)/quiz/[id]" />
              <Stack.Screen name="(app)/ai-dashboard" />
              <Stack.Screen name="(app)/seller-dashboard" />
              <Stack.Screen name="(app)/settings" />
              <Stack.Screen name="(app)/verify-otp" />
              <Stack.Screen name="(trial)/trial-question-sets" />
              <Stack.Screen name="(trial)/set/[id]" />
              <Stack.Screen name="(trial)/set/[id]/question/[questionIndex]" />
              <Stack.Screen name="(trial)/set/[id]/textbook" />
              <Stack.Screen name="(trial)/textbook/[path]" />
              <Stack.Screen name="(trial)/quiz/[id]" />
              <Stack.Screen name="(trial)/create" />
              <Stack.Screen name="(app)/flashcard/[id]" />
            </Stack>
          </TrialModeProvider>
        </AuthProvider>
      </LanguageProvider>
    </>
  );
}
