import React, { ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useRouter, usePathname, useSegments } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";

interface HeaderProps {
  title?: string;
  rightComponent?: ReactNode;
  showLanguageSwitcher?: boolean;
}

export default function Header({
  title,
  rightComponent,
  showLanguageSwitcher = false,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { language, setLanguage } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  // お試し版判定
  // - expo-routerのグループ名はURLには出ないが、環境によってsegmentsの出方が揺れることがあるため
  //   pathnameでもフォールバックして判定する
  const lastSegment = segments[segments.length - 1];
  const isTrialBySegments = segments.includes("(trial)");
  const isTrialByPath =
    pathname === "/trial-question-sets" ||
    pathname.startsWith("/set/") ||
    pathname.startsWith("/quiz/") ||
    pathname.startsWith("/textbook/") ||
    pathname === "/create";
  const isTrial = isTrialBySegments || isTrialByPath;

  const isTrialHome =
    pathname === "/trial-question-sets" ||
    lastSegment === "trial-question-sets";

  // ホームページかどうかを判定（戻る/ホームボタンを非表示にする）
  const isHomePage = pathname === "/" || pathname === "/index" || isTrialHome;

  const shouldRenderLanguageSwitcher =
    showLanguageSwitcher && rightComponent == null;

  const effectiveRightComponent =
    rightComponent ??
    (shouldRenderLanguageSwitcher ? (
      <View style={styles.languageSwitcher} nativeID="header-language-switcher">
        <TouchableOpacity
          style={[
            styles.langButton,
            language === "en" && styles.langButtonActive,
          ]}
          onPress={() => setLanguage("en")}
          testID="header-lang-btn-en"
        >
          <Text
            style={[
              styles.langButtonText,
              language === "en" && styles.langButtonTextActive,
            ]}
            nativeID="header-lang-text-en"
          >
            EN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.langButton,
            language === "ja" && styles.langButtonActive,
          ]}
          onPress={() => setLanguage("ja")}
          testID="header-lang-btn-ja"
        >
          <Text
            style={[
              styles.langButtonText,
              language === "ja" && styles.langButtonTextActive,
            ]}
            nativeID="header-lang-text-ja"
          >
            日本語
          </Text>
        </TouchableOpacity>
      </View>
    ) : null);

  // 🏠 の戻り先（お試し版はお試しトップへ）
  const homeHref = isTrial ? "/trial-question-sets" : "/";

  // 中央タイトルが左右のボタンと被らないように余白を確保
  const titlePaddingLeft = !isHomePage ? (isSmallScreen ? 96 : 120) : 0;
  const titlePaddingRight =
    effectiveRightComponent != null ? (isSmallScreen ? 90 : 120) : 0;

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: isSmallScreen ? 16 : 20,
          paddingVertical: isSmallScreen ? 12 : 16,
          paddingTop: isSmallScreen ? 8 : 10,
        },
      ]}
      nativeID="app-header"
    >
      <View style={styles.headerContent}>
        {!isHomePage && (
          <View style={styles.leftButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              testID="header-back-btn"
            >
              <Text
                style={[
                  styles.backButtonText,
                  { fontSize: isSmallScreen ? 24 : 28 },
                ]}
                nativeID="header-back-text"
              >
                ←
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.push(homeHref)}
              testID="header-home-btn"
            >
              <Text
                style={[
                  styles.homeButtonText,
                  { fontSize: isSmallScreen ? 20 : 24 },
                ]}
                nativeID="header-home-text"
              >
                🏠
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View
          style={[
            styles.titleContainer,
            { paddingLeft: titlePaddingLeft, paddingRight: titlePaddingRight },
          ]}
        >
          <Text
            style={[styles.appName, { fontSize: isSmallScreen ? 18 : 20 }]}
            nativeID="app-name"
          >
            AI Practice Book{" "}
            <Text
              style={[styles.beta, { fontSize: isSmallScreen ? 12 : 14 }]}
              nativeID="app-version"
            >
              Ver.β
            </Text>
          </Text>
          {title && (
            <Text
              style={[styles.pageTitle, { fontSize: isSmallScreen ? 12 : 14 }]}
              nativeID="page-title"
            >
              {title}
            </Text>
          )}
        </View>
        {effectiveRightComponent != null && (
          <View
            style={styles.rightComponent}
            testID="header-right-component"
            nativeID="header-right-component"
          >
            {effectiveRightComponent}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: 10, // ステータスバー分のスペース
    // React Native用のshadowプロパティ（iOS/Android用）
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // React Native Web用のboxShadow（非推奨警告を解消）
    // @ts-ignore - React Native WebでboxShadowをサポート
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  leftButtons: {
    position: "absolute",
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
  },
  homeButton: {
    padding: 8,
    marginLeft: 4,
  },
  homeButtonText: {
    fontSize: 24,
    color: "#fff",
  },
  titleContainer: {
    alignItems: "center",
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  beta: {
    fontSize: 14,
    fontWeight: "normal",
    fontStyle: "italic",
    color: "#E0E0E0",
  },
  pageTitle: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 4,
  },
  rightComponent: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    padding: 8,
    zIndex: 1,
    justifyContent: "center",
  },
  languageSwitcher: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  langButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  langButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  langButtonTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
});
