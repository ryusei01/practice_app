/**
 * Native (iOS / Android) 専用 AdBanner
 * - react-native-google-mobile-ads のバナー広告を表示
 * - Expo Go には AdMob ネイティブモジュールが無いため、モジュールを読み込まず非表示
 * - is_premium が true のユーザーには何も表示しない
 */
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useAuth } from "../contexts/AuthContext";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const adsModule = (() => {
  if (isExpoGo) return null;
  try {
    return require("react-native-google-mobile-ads") as typeof import("react-native-google-mobile-ads");
  } catch {
    return null;
  }
})();

const MOBILE_BANNER_ID_ANDROID =
  process.env.EXPO_PUBLIC_AD_UNIT_ANDROID ||
  "ca-app-pub-3940256099942544/6300978111";
const MOBILE_BANNER_ID_IOS =
  process.env.EXPO_PUBLIC_AD_UNIT_IOS || "ca-app-pub-3940256099942544/2934735716";

export default function AdBanner() {
  const { user } = useAuth();
  if (user?.is_premium) return null;
  if (!adsModule) return null;

  const { BannerAd, BannerAdSize } = adsModule;
  const unitId = Platform.OS === "ios" ? MOBILE_BANNER_ID_IOS : MOBILE_BANNER_ID_ANDROID;
  return (
    <View style={styles.mobileContainer}>
      <BannerAd unitId={unitId} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
});
