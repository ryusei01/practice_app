import { Stack } from "expo-router";
import Head from "expo-router/head";
import { Platform } from "react-native";
import { AuthProvider } from "../src/contexts/AuthContext";
import { LanguageProvider } from "../src/contexts/LanguageContext";

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
            <Stack.Screen name="(app)/seller-dashboard" />
            <Stack.Screen name="(app)/admin/index" />
            <Stack.Screen name="(app)/settings" />
            <Stack.Screen name="(app)/mypage" />
            <Stack.Screen name="(app)/verify-otp" />
            <Stack.Screen name="(trial)" />
            <Stack.Screen name="(app)/flashcard/[id]" />
            <Stack.Screen name="(public)/privacy-policy" />
            <Stack.Screen name="(public)/terms-of-service" />
            <Stack.Screen name="premium-success" />
            <Stack.Screen name="premium-cancel" />
          </Stack>
        </AuthProvider>
      </LanguageProvider>
    </>
  );
}
