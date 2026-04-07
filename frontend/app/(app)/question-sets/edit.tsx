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
import {
  questionSetsApi,
  ContentLanguageMask,
  languagesFromMask,
  maskFromLanguages,
  toggleMaskLang,
} from "../../../src/api/questionSets";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useLanguage } from "../../../src/contexts/LanguageContext";
import Header from "../../../src/components/Header";
import {
  copyrightApi,
  CopyrightCheckResult,
} from "../../../src/api/reports";

export default function EditQuestionSetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("0");
  const [isPublished, setIsPublished] = useState(false);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [latestCopyright, setLatestCopyright] =
    useState<CopyrightCheckResult | null>(null);
  const [contentLangMask, setContentLangMask] = useState<ContentLanguageMask>({
    ja: true,
    en: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    loadQuestionSet();
  }, [id, user?.id]);

  const loadQuestionSet = async () => {
    try {
      const questionSet = await questionSetsApi.getById(id);
      setTitle(questionSet.title);
      setDescription(questionSet.description || "");
      setCategory(questionSet.category);
      setTags(questionSet.tags ? questionSet.tags.join(", ") : "");
      setPrice(questionSet.price.toString());
      setIsPublished(questionSet.is_published);
      setCreatorId(questionSet.creator_id);
      setContentLangMask(
        maskFromLanguages(questionSet.content_languages, questionSet.content_language)
      );

      if (user?.id === questionSet.creator_id) {
        try {
          const latest = await copyrightApi.getLatest(id);
          setLatestCopyright(latest);
        } catch {
          setLatestCopyright(null);
        }
      } else {
        setLatestCopyright(null);
      }
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

      const langs = languagesFromMask(contentLangMask);
      const questionSetData = {
        title,
        description: description || undefined,
        category,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        price: isPublished ? parseInt(price) || 0 : 0,
        is_published: isPublished,
        content_languages: langs,
        content_language: langs[0],
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

  const isOwner = Boolean(user?.id && creatorId && user.id === creatorId);
  const canPublishByCopyright =
    latestCopyright != null &&
    (latestCopyright.risk_level === "low" ||
      latestCopyright.risk_level === "medium");

  const onPublishToggle = (next: boolean) => {
    if (next && !isPublished && !canPublishByCopyright) {
      Alert.alert(
        t("Copyright check required", "著作権チェックが必要です"),
        t(
          "Run the copyright check on the question set detail screen. Publishing is allowed only when risk is low or medium.",
          "問題集詳細画面で著作権チェックを実行してください。リスクが「低」または「中」のときのみ公開できます。"
        )
      );
      return;
    }
    setIsPublished(next);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <Header title={t("Edit Question Set", "問題集を編集")} />
      <ScrollView style={styles.container}>
        <View style={styles.formContainer}>

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

        <Text style={styles.label}>
          {t("Content language (select one or both)", "問題の言語（複数選択可）")}
        </Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[
              styles.langChip,
              contentLangMask.ja && styles.langChipActive,
            ]}
            onPress={() => setContentLangMask((m) => toggleMaskLang(m, "ja"))}
            disabled={isSaving}
          >
            <Text
              style={[
                styles.langChipText,
                contentLangMask.ja && styles.langChipTextActive,
              ]}
            >
              {t("Japanese", "日本語")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.langChip,
              contentLangMask.en && styles.langChipActive,
            ]}
            onPress={() => setContentLangMask((m) => toggleMaskLang(m, "en"))}
            disabled={isSaving}
          >
            <Text
              style={[
                styles.langChipText,
                contentLangMask.en && styles.langChipTextActive,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

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
            onValueChange={onPublishToggle}
            disabled={isSaving}
          />
        </View>
        {isOwner && !isPublished && !canPublishByCopyright && (
          <Text style={styles.copyrightHint}>
            {t(
              "Turn on publishing after running a copyright check (low or medium risk) on the detail screen.",
              "公開するには、問題集詳細で著作権チェックを実行し、リスクが「低」または「中」である必要があります。"
            )}
          </Text>
        )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
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
  langRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  langChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginRight: 12,
  },
  langChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  langChipText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  langChipTextActive: {
    color: "#fff",
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
  copyrightHint: {
    fontSize: 13,
    color: "#856404",
    backgroundColor: "#fff3cd",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    lineHeight: 20,
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
