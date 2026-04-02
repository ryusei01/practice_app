import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { router } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLanguage } from "../../src/contexts/LanguageContext";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { loginWithGoogle, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const redirectUri = makeRedirectUri({ native: "quizmarketplace://redirect" });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
  });

  React.useEffect(() => {
    if (request) {
      console.log("[OAuth] redirect_uri:", request.redirectUri);
    }
  }, [request]);


  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        handleGoogleLogin(accessToken);
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
  }, [response]);

  const handleGoogleLogin = async (accessToken: string) => {
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
          onPress={() => {
            setErrorMessage("");
            promptAsync();
          }}
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
        <TouchableOpacity
          onPress={() => router.push("/(public)/privacy-policy")}
          style={styles.privacyLink}
        >
          <Text style={styles.privacyLinkText}>
            {t("Privacy Policy", "プライバシーポリシー")}
          </Text>
        </TouchableOpacity>
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
  privacyLink: {
    marginTop: 20,
    padding: 4,
  },
  privacyLinkText: {
    color: "#888",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
