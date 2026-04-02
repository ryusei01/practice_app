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
      bundleIdentifier: "com.yourcompany.quizmarketplace",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.yourcompany.quizmarketplace",
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      output: "static",
    },
    plugins: ["expo-router"],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8003/api/v1",
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
  },
};
