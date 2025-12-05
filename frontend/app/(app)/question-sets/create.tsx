import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { questionSetsApi } from "../../../src/api/questionSets";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";

export default function CreateQuestionSetScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleCreate = async () => {
    console.log("handleCreate called");
    console.log("User:", user);

    if (!user) {
      Alert.alert(
        t("Error", "エラー"),
        t("User not authenticated", "ユーザー認証されていません")
      );
      return;
    }

    setIsLoading(true);
    console.log("Loading state set to true");
    try {
      // 最小限の情報で問題集を作成（仮のタイトルとカテゴリ）
      const questionSetData = {
        title: t("New Question Set", "新しい問題集"),
        category: t("Uncategorized", "未分類"),
        description: undefined,
        tags: undefined,
        price: 0,
        is_published: false,
      };

      console.log("Question set data:", questionSetData);

      // クラウドに保存（プレミアムユーザー or デフォルト動作）
      console.log("Calling questionSetsApi.create...");
      const result = await questionSetsApi.create(questionSetData);
      console.log("API call result:", result);
      console.log("Result type:", typeof result);
      console.log("Result keys:", Object.keys(result));

      const createdQuestionSetId = result.id;
      console.log("Created question set ID:", createdQuestionSetId);

      if (!createdQuestionSetId) {
        console.error("No ID returned from API!");
        Alert.alert(
          t("Error", "エラー"),
          t(
            "Failed to get question set ID from server",
            "サーバーから問題集IDを取得できませんでした"
          )
        );
        return;
      }

      // 問題集作成成功、詳細画面に遷移（編集モードのパラメータ付き）
      router.push(`/(app)/question-sets/${createdQuestionSetId}?mode=setup`);
    } catch (error: any) {
      console.error("Error creating question set:", error);
      console.error("Error response:", error.response);
      console.error("Error message:", error.message);
      Alert.alert(
        t("Error", "エラー"),
        error.response?.data?.detail ||
          t("Failed to create question set", "問題集の作成に失敗しました")
      );
    } finally {
      console.log("Setting loading to false");
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>
            {t("Create New Question Set", "新しい問題集を作成")}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              "Create a question set and then add questions via CSV",
              "問題集を作成後、CSVで問題を追加できます"
            )}
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>
            {t("Setup Steps:", "セットアップ手順:")}
          </Text>
          <Text style={styles.infoStep}>
            1️⃣ {t("Create question set", "問題集を作成")}
          </Text>
          <Text style={styles.infoStep}>
            2️⃣{" "}
            {t(
              "Make questions or Upload questions via CSV",
              "自分で問題を追加するか、CSVで問題をアップロード"
            )}
          </Text>
          <Text style={styles.infoStep}>
            3️⃣ {t("Edit title and category", "タイトルとカテゴリを編集")}
          </Text>
          <Text style={styles.infoStep}>
            4️⃣ {t("Add description, tags, and price", "説明、タグ、価格を追加")}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {t("Create Question Set", "問題集を作成")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>
            {t("Cancel", "キャンセル")}
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
  },
  formContainer: {
    padding: 20,
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  infoStep: {
    fontSize: 15,
    color: "#666",
    marginBottom: 12,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#007AFF",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#007AFF",
  },
});
