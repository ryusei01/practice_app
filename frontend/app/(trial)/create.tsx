import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import { localStorageService } from "../../src/services/localStorageService";
import Header from "../../src/components/Header";
import * as DocumentPicker from 'expo-document-picker';

export default function TrialCreateScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<
    Array<{
      question: string;
      answer: string;
      difficulty?: string;
      category?: string;
      subcategory1?: string;
      subcategory2?: string;
    }>
  >([{ question: "", answer: "", difficulty: "medium", category: "", subcategory1: "", subcategory2: "" }]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { t } = useLanguage();
  const router = useRouter();

  const addQuestion = () => {
    setQuestions([...questions, { question: "", answer: "", difficulty: "medium", category: "", subcategory1: "", subcategory2: "" }]);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const updateQuestion = (
    index: number,
    field: "question" | "answer" | "difficulty" | "category" | "subcategory1" | "subcategory2",
    value: string
  ) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleCreate = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!title.trim()) {
      setErrorMessage(
        t("Please enter a title", "タイトルを入力してください")
      );
      return;
    }

    const validQuestions = questions.filter(
      (q) => q.question.trim() && q.answer.trim()
    );

    if (validQuestions.length === 0) {
      setErrorMessage(
        t("Please add at least one question", "最低1つの問題を追加してください")
      );
      return;
    }

    setIsLoading(true);
    try {
      await localStorageService.saveTrialQuestionSet({
        title,
        description,
        questions: validQuestions,
      });

      setSuccessMessage(
        t("Question set created!", "問題セットを作成しました！")
      );
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      console.error("Error creating trial question set:", error);
      setErrorMessage(
        t("Failed to create question set", "問題セットの作成に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>
          {t("Create Question Set (Trial)", "問題セットを作成 (お試し)")}
        </Text>

        <View style={styles.trialNotice}>
          <Text style={styles.trialNoticeText}>
            {t(
              "Trial mode: Data is stored locally on your device",
              "お試しモード: データは端末にローカル保存されます"
            )}
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t("Question Set Title", "問題セットのタイトル")}
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t("Description (optional)", "説明 (任意)")}
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionTitle}>{t("Questions", "問題")}</Text>

        {/* エラー・成功メッセージ */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {questions.map((q, index) => (
          <View key={index} style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionNumber}>
                {t("Question", "問題")} {index + 1}
              </Text>
              {questions.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeQuestion(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>
                    {t("Remove", "削除")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder={t("Question", "問題")}
              placeholderTextColor="#999"
              value={q.question}
              onChangeText={(text) => updateQuestion(index, "question", text)}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder={t("Answer", "答え")}
              placeholderTextColor="#999"
              value={q.answer}
              onChangeText={(text) => updateQuestion(index, "answer", text)}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder={t("Category (optional)", "カテゴリ (任意)")}
              placeholderTextColor="#999"
              value={q.category || ""}
              onChangeText={(text) => updateQuestion(index, "category", text)}
            />

            <TextInput
              style={styles.input}
              placeholder={t("Subcategory 1 (optional)", "サブカテゴリ1 (任意)")}
              placeholderTextColor="#999"
              value={q.subcategory1 || ""}
              onChangeText={(text) => updateQuestion(index, "subcategory1", text)}
            />

            <TextInput
              style={styles.input}
              placeholder={t("Subcategory 2 (optional)", "サブカテゴリ2 (任意)")}
              placeholderTextColor="#999"
              value={q.subcategory2 || ""}
              onChangeText={(text) => updateQuestion(index, "subcategory2", text)}
            />
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={addQuestion}>
          <Text style={styles.addButtonText}>
            + {t("Add Question", "問題を追加")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>
              {t("Create Question Set", "問題セットを作成")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>{t("Cancel", "キャンセル")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  trialNotice: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
  },
  trialNoticeText: {
    fontSize: 14,
    color: "#2E7D32",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  removeButton: {
    backgroundColor: "#FF3B30",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
  },
  addButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
  },
  successText: {
    color: "#2E7D32",
    fontSize: 14,
    lineHeight: 20,
  },
});
