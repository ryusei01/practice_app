export default {
  expo: {
    name: "QuizMarketplace",
    slug: "quiz-marketplace",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "quizmarketplace",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    platforms: ["ios", "android", "web"],
    ios: {
      supportsTablet: true,
      bundleIdentifier:
        process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.aipracticebook.app",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package:
        process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "com.aipracticebook.app",
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      output: "static",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511",
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8003/api/v1",
    },
  },
};
