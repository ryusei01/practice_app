import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { questionSetsApi } from "../../../src/api/questionSets";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";

export default function EditQuestionSetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("0");
  const [isPublished, setIsPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    loadQuestionSet();
  }, [id]);

  const loadQuestionSet = async () => {
    try {
      const questionSet = await questionSetsApi.getById(id);
      setTitle(questionSet.title);
      setDescription(questionSet.description || "");
      setCategory(questionSet.category);
      setTags(questionSet.tags ? questionSet.tags.join(", ") : "");
      setPrice(questionSet.price.toString());
      setIsPublished(questionSet.is_published);
    } catch (error) {
      console.error("Failed to load question set:", error);
      Alert.alert(
        t("Error", "エラー"),
        t("Failed to load question set", "問題集の読み込みに失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    console.log("handleSave called");
    console.log("Title:", title);
    console.log("Category:", category);

    if (!title || !category) {
      Alert.alert(
        t("Error", "エラー"),
        t(
          "Please fill in title and category",
          "タイトルとカテゴリを入力してください"
        )
      );
      return;
    }

    if (!user) {
      Alert.alert(
        t("Error", "エラー"),
        t("User not authenticated", "ユーザー認証されていません")
      );
      return;
    }

    // 非公開の場合、値段は0に固定
    if (!isPublished && parseInt(price) > 0) {
      Alert.alert(
        t("Warning", "警告"),
        t(
          "Private question sets cannot have a price. Price will be set to 0.",
          "非公開の問題集には価格を設定できません。価格は0に設定されます。"
        )
      );
    }

    setIsSaving(true);
    try {
      const tagsArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const questionSetData = {
        title,
        description: description || undefined,
        category,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        price: isPublished ? parseInt(price) || 0 : 0,
        is_published: isPublished,
      };

      console.log("Updating question set data:", questionSetData);

      await questionSetsApi.update(id, questionSetData);

      Alert.alert(
        t("Success", "成功"),
        t("Question set updated", "問題集を更新しました"),
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error updating question set:", error);
      console.error("Error response:", error.response);
      console.error("Error message:", error.message);
      Alert.alert(
        t("Error", "エラー"),
        error.response?.data?.detail ||
          t("Failed to update question set", "問題集の更新に失敗しました")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>
            {t("Edit Question Set", "問題集を編集")}
          </Text>
        </View>

        <Text style={styles.label}>{t("Title", "タイトル")} *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t("Enter question set title", "問題集のタイトルを入力")}
          placeholderTextColor="#999"
          editable={!isSaving}
        />

        <Text style={styles.label}>{t("Category", "カテゴリ")} *</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder={t(
            "e.g., Math, English, Programming",
            "例: 数学、英語、プログラミング"
          )}
          placeholderTextColor="#999"
          editable={!isSaving}
        />

        <Text style={styles.label}>{t("Description", "説明")}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t("Describe your question set", "問題集の説明を入力")}
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isSaving}
        />

        <Text style={styles.label}>
          {t("Tags (comma separated)", "タグ（カンマ区切り）")}
        </Text>
        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder={t(
            "e.g., beginner, TOEIC, Python",
            "例: 初級、TOEIC、Python"
          )}
          placeholderTextColor="#999"
          editable={!isSaving}
        />

        <Text style={styles.label}>
          {t("Price", "価格")} (¥){" "}
          {!isPublished && t("(Private sets are free)", "（非公開は無料）")}
        </Text>
        <TextInput
          style={[styles.input, !isPublished && styles.inputDisabled]}
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          placeholderTextColor="#999"
          keyboardType="numeric"
          editable={!isSaving && isPublished}
        />

        <View style={styles.switchContainer}>
          <Text style={styles.label}>
            {t("Publish immediately", "公開する")}
          </Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            disabled={isSaving}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t("Save", "保存")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>
            {t("Cancel", "キャンセル")}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  formContainer: {
    padding: 20,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  textArea: {
    minHeight: 100,
  },
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    color: "#999",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
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
