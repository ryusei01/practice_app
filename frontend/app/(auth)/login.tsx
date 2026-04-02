import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Platform,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";

/** Web 同一タブ OAuth 用。リロード後も state を照合する */
const GOOGLE_OAUTH_STATE_KEY = "quizmarketplace_google_oauth_state";

/** 未設定・プレースホルダーは web 用 ID にフォールバック（ネイティブでも Web クライアント ID で開発可能） */
function resolveGoogleClientId(
  platformSpecific: string | undefined,
  webClientId: string | undefined
): string | undefined {
  const raw = platformSpecific?.trim();
  if (!raw || raw.includes("xxxx")) {
    return webClientId;
  }
  return raw;
}

export default function LoginScreen() {
  const { loginWithGoogle, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  // Web は同一タブで /login に戻す（ポップアップ不要）。GCP の「承認済みリダイレクト URI」に https://あなたのドメイン/login を追加すること。
  const redirectUri =
    Platform.OS === "web"
      ? makeRedirectUri({ path: "login" })
      : makeRedirectUri({ native: "quizmarketplace://redirect" });

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    iosClientId: resolveGoogleClientId(
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId
    ),
    androidClientId: resolveGoogleClientId(
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      webClientId
    ),
    redirectUri,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  /** Strict Mode で useEffect が二重に走るのを同期で防ぐ */
  const webOAuthReturnHandledRef = useRef(false);

  const handleGoogleLogin = useCallback(
    async (accessToken: string) => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        await loginWithGoogle(accessToken);
      } catch (error: any) {
        console.error("[Login] Google login error:", error);
        setErrorMessage(
          error.response?.data?.detail ||
            error.message ||
            t("Sign-in failed", "サインインに失敗しました")
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loginWithGoogle, t]
  );

  // Web: Google から同一タブで戻ったとき（#access_token=...）
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    if (webOAuthReturnHandledRef.current) {
      return;
    }
    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    if (!hash) {
      return;
    }
    const params = new URLSearchParams(hash);
    const oauthError = params.get("error");
    if (oauthError) {
      webOAuthReturnHandledRef.current = true;
      const desc = params.get("error_description") ?? oauthError;
      setErrorMessage(desc);
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );
      return;
    }
    const accessToken = params.get("access_token");
    const returnedState = params.get("state");
    const savedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
    if (!accessToken || !returnedState || !savedState || returnedState !== savedState) {
      return;
    }
    webOAuthReturnHandledRef.current = true;
    sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.search
    );
    void handleGoogleLogin(accessToken);
  }, [handleGoogleLogin]);

  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        void handleGoogleLogin(accessToken);
      } else {
        setErrorMessage(
          t(
            "Failed to get Google token",
            "Googleトークンの取得に失敗しました"
          )
        );
      }
    } else if (response?.type === "error") {
      setErrorMessage(
        t("Google sign-in failed", "Googleサインインに失敗しました")
      );
    }
  }, [response, handleGoogleLogin, t]);

  const startGoogleAuth = () => {
    setErrorMessage("");
    if (!request?.url) {
      return;
    }
    if (Platform.OS === "web") {
      if (!request.state) {
        setErrorMessage(
          t("Sign-in is not ready yet", "ログインの準備ができていません。しばらく待って再度お試しください。")
        );
        return;
      }
      try {
        sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, request.state);
        window.location.assign(request.url);
      } catch (e) {
        console.error("[Login] Web redirect failed:", e);
        setErrorMessage(
          t("Could not start sign-in", "サインインを開始できませんでした")
        );
      }
      return;
    }
    void promptAsync();
  };

  const loading = isLoading || authLoading;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            width: isSmallScreen ? "100%" : 400,
            padding: isSmallScreen ? 28 : 36,
          },
        ]}
      >
        <Text style={[styles.title, { fontSize: isSmallScreen ? 24 : 28 }]}>
          {t("Welcome to AI Practice Book", "AI Practice Bookへようこそ")}
        </Text>
        <Text style={[styles.subtitle, { fontSize: isSmallScreen ? 14 : 15 }]}>
          {t(
            "Sign in with your Google account to continue",
            "Googleアカウントでログインして続ける"
          )}
        </Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={startGoogleAuth}
          disabled={!request || loading}
        >
          {loading ? (
            <ActivityIndicator color="#444" />
          ) : (
            <>
              <Image
                source={{
                  uri: "https://www.google.com/favicon.ico",
                }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonText}>
                {t("Sign in with Google", "Googleでサインイン")}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.consentText}>
          {t(
            "By signing in, you agree to our ",
            "ログインすることで、"
          )}
          <Text
            style={styles.linkInline}
            onPress={() => router.push("/(public)/terms-of-service")}
          >
            {t("Terms of Service", "利用規約")}
          </Text>
          {t(" and ", "と")}
          <Text
            style={styles.linkInline}
            onPress={() => router.push("/(public)/privacy-policy")}
          >
            {t("Privacy Policy", "プライバシーポリシー")}
          </Text>
          {t(
            ". You agree not to post content that infringes third-party copyrights, as further described in the Terms.",
            "に同意したものとみなします。第三者の著作権を侵害するコンテンツの投稿は禁止です（詳細は利用規約）。"
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
    width: "100%",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#dadce0",
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#3c4043",
    fontSize: 16,
    fontWeight: "600",
  },
  consentText: {
    marginTop: 20,
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  linkInline: {
    color: "#4A90E2",
    textDecorationLine: "underline",
  },
});
