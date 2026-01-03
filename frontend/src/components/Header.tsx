import React, { ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

interface HeaderProps {
  title?: string;
  rightComponent?: ReactNode;
  // 既存画面との互換性のため（現状はHeader内部で未使用）
  showLanguageSwitcher?: boolean;
}

export default function Header({ title, rightComponent }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  // ホームページかどうかを判定（戻るボタンを非表示にする）
  const isHomePage = pathname === "/" || pathname === "/index";
  
  // マイページかどうかを判定
  const isMyPage = pathname === "/mypage" || pathname.includes("/mypage");
  
  // 認証済みでマイページ以外の場合、マイページリンクを表示
  const shouldShowMyPageLink = isAuthenticated && !isMyPage && !isHomePage && rightComponent == null;

  return (
    <View style={styles.header} nativeID="app-header">
      <View style={styles.headerContent}>
        {!isHomePage && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="header-back-btn"
          >
            <Text style={styles.backButtonText} nativeID="header-back-text">
              ←
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.appName} nativeID="app-name">
            AI Practice Book{" "}
            <Text style={styles.beta} nativeID="app-version">
              Ver.β
            </Text>
          </Text>
          {title && (
            <Text style={styles.pageTitle} nativeID="page-title">
              {title}
            </Text>
          )}
        </View>
        {(rightComponent || shouldShowMyPageLink) && (
          <View
            style={styles.rightComponent}
            testID="header-right-component"
            nativeID="header-right-component"
          >
            {rightComponent || (
              <TouchableOpacity
                style={styles.myPageLink}
                onPress={() => router.push("/(app)/mypage")}
                testID="header-mypage-link"
              >
                <Text
                  style={[styles.myPageLinkText, { fontSize: isSmallScreen ? 14 : 16 }]}
                  nativeID="header-mypage-text"
                >
                  {t("My Profile", "マイページ")}
                </Text>
              </TouchableOpacity>
            )}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 0,
    padding: 8,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
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
  myPageLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  myPageLinkText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
