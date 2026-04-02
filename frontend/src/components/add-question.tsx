import React, { useState, useCallback } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";
import { questionsApi } from "../api/questions";

type QuestionType = "multiple_choice" | "true_false" | "text_input";
type Difficulty = "easy" | "medium" | "hard";
type TabMode = "single" | "bulk";

const DIFFICULTY_MAP: Record<Difficulty, number> = {
  easy: 0.2,
  medium: 0.5,
  hard: 0.8,
};

interface ParsedQuestion {
  question_text: string;
  correct_answer: string;
}

function parseBulkText(text: string): ParsedQuestion[] {
  const blocks = text
    .split(/\n---\n|\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const results: ParsedQuestion[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length >= 2) {
      results.push({
        question_text: lines[0],
        correct_answer: lines[1],
      });
    }
  }
  return results;
}

export default function AddQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabMode>("single");

  // --- 1問ずつモードの状態 ---
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctAnswerText, setCorrectAnswerText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- まとめて入力モードの状態 ---
  const [bulkText, setBulkText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[] | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // ----- 1問ずつモード: ハンドラ -----

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
    if (correctIndex === index) {
      setCorrectIndex(null);
    } else if (correctIndex !== null && correctIndex > index) {
      setCorrectIndex(correctIndex - 1);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const resetSingleForm = useCallback(() => {
    setQuestionText("");
    setOptions(["", ""]);
    setCorrectIndex(null);
    setCorrectAnswerText("");
    setExplanation("");
    setDifficulty("medium");
    setCategory("");
  }, []);

  const buildSinglePayload = () => {
    if (questionType === "multiple_choice") {
      const validOptions = options.filter((o) => o.trim().length > 0);
      if (!questionText.trim()) {
        Alert.alert(t("Error", "エラー"), t("Please enter a question", "問題文を入力してください"));
        return null;
      }
      if (validOptions.length < 2) {
        Alert.alert(t("Error", "エラー"), t("Please add at least 2 options", "選択肢を2つ以上入力してください"));
        return null;
      }
      if (correctIndex === null || !options[correctIndex]?.trim()) {
        Alert.alert(t("Error", "エラー"), t("Please select the correct answer", "正解を選択してください"));
        return null;
      }
      return {
        question_set_id: id,
        question_text: questionText.trim(),
        question_type: questionType,
        options: validOptions,
        correct_answer: options[correctIndex].trim(),
        explanation: explanation.trim() || undefined,
        difficulty: DIFFICULTY_MAP[difficulty],
        category: category.trim() || undefined,
      };
    }

    if (questionType === "true_false") {
      if (!questionText.trim()) {
        Alert.alert(t("Error", "エラー"), t("Please enter a question", "問題文を入力してください"));
        return null;
      }
      if (!correctAnswerText.trim()) {
        Alert.alert(t("Error", "エラー"), t("Please select the correct answer", "正解を選択してください"));
        return null;
      }
      return {
        question_set_id: id,
        question_text: questionText.trim(),
        question_type: questionType,
        options: [t("True", "正しい"), t("False", "誤り")],
        correct_answer: correctAnswerText.trim(),
        explanation: explanation.trim() || undefined,
        difficulty: DIFFICULTY_MAP[difficulty],
        category: category.trim() || undefined,
      };
    }

    // text_input
    if (!questionText.trim()) {
      Alert.alert(t("Error", "エラー"), t("Please enter a question", "問題文を入力してください"));
      return null;
    }
    if (!correctAnswerText.trim()) {
      Alert.alert(t("Error", "エラー"), t("Please select the correct answer", "正解を選択してください"));
      return null;
    }
    return {
      question_set_id: id,
      question_text: questionText.trim(),
      question_type: questionType,
      options: undefined,
      correct_answer: correctAnswerText.trim(),
      explanation: explanation.trim() || undefined,
      difficulty: DIFFICULTY_MAP[difficulty],
      category: category.trim() || undefined,
    };
  };

  const handleSaveAndBack = async () => {
    const payload = buildSinglePayload();
    if (!payload) return;
    setIsLoading(true);
    try {
      await questionsApi.create(payload as any);
      router.back();
    } catch (error: any) {
      Alert.alert(
        t("Error", "エラー"),
        error.response?.data?.detail || t("Failed to save question", "保存に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNext = async () => {
    const payload = buildSinglePayload();
    if (!payload) return;
    setIsLoading(true);
    try {
      await questionsApi.create(payload as any);
      resetSingleForm();
      Alert.alert(t("Success", "成功"), t("Saved! Enter the next question.", "保存しました。次の問題を入力してください。"));
    } catch (error: any) {
      Alert.alert(
        t("Error", "エラー"),
        error.response?.data?.detail || t("Failed to save question", "保存に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ----- まとめて入力モード: ハンドラ -----

  const handleInsertTemplate = () => {
    setBulkText(t(
      "Enter question here\nEnter answer here\n\nNext question\nNext answer",
      "問題文をここに入力\n答えをここに入力\n\n次の問題文\n次の答え"
    ));
    setParsedQuestions(null);
  };

  const handlePreview = () => {
    if (!bulkText.trim()) {
      Alert.alert(t("Error", "エラー"), t("Please enter some questions", "問題を入力してください"));
      return;
    }
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      Alert.alert(t("Error", "エラー"), t("Format error: each question needs at least 2 lines (question + answer)", "フォーマットエラー: 各問題に問題文と答えが必要です（2行以上）"));
      return;
    }
    setParsedQuestions(parsed);
  };

  const handleBulkSave = async () => {
    if (!parsedQuestions || parsedQuestions.length === 0) return;
    setIsBulkLoading(true);
    setBulkProgress(0);
    let successCount = 0;
    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i];
      try {
        await questionsApi.create({
          question_set_id: id,
          question_text: q.question_text,
          question_type: "text_input",
          correct_answer: q.correct_answer,
          difficulty: 0.5,
        });
        successCount++;
      } catch {
        // 失敗した問題はスキップして続行
      }
      setBulkProgress(i + 1);
    }
    setIsBulkLoading(false);
    Alert.alert(
      t("Success", "成功"),
      t(`Added ${successCount} question(s)`, `${successCount}問を追加しました`),
      [{ text: t("OK", "OK"), onPress: () => router.back() }]
    );
  };

  // ----- レンダリング -----

  const renderTypeButton = (type: QuestionType, label: string) => (
    <TouchableOpacity
      key={type}
      style={[styles.typeButton, questionType === type && styles.typeButtonActive]}
      onPress={() => {
        setQuestionType(type);
        setCorrectIndex(null);
        setCorrectAnswerText("");
        setOptions(["", ""]);
      }}
    >
      <Text
        style={[
          styles.typeButtonText,
          questionType === type && styles.typeButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDifficultyButton = (level: Difficulty, label: string) => (
    <TouchableOpacity
      key={level}
      style={[
        styles.difficultyButton,
        difficulty === level && styles.difficultyButtonActive,
        level === "easy" && difficulty === level && styles.difficultyEasy,
        level === "hard" && difficulty === level && styles.difficultyHard,
      ]}
      onPress={() => setDifficulty(level)}
    >
      <Text
        style={[
          styles.difficultyButtonText,
          difficulty === level && styles.difficultyButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderSingleForm = () => (
    <View>
      {/* 問題タイプ */}
      <Text style={styles.label}>{t("Question Type", "問題タイプ")}</Text>
      <View style={styles.typeSelector}>
        {renderTypeButton("multiple_choice", t("Multiple Choice", "多肢選択"))}
        {renderTypeButton("true_false", t("True / False", "正誤問題"))}
        {renderTypeButton("text_input", t("Text Input", "記述式"))}
      </View>

      {/* 問題文 */}
      <Text style={styles.label}>
        {t("Question Text", "問題文")} <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={questionText}
        onChangeText={setQuestionText}
        placeholder={t("Enter your question", "問題文を入力してください")}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isLoading}
      />

      {/* 多肢選択: 選択肢リスト */}
      {questionType === "multiple_choice" && (
        <>
          <Text style={styles.label}>
            {t("Options", "選択肢")} <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.hint}>{t("Tap the button on the left of the correct option", "正解にする選択肢の左のボタンをタップしてください")}</Text>
          {options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  correctIndex === index && styles.radioButtonActive,
                ]}
                onPress={() => setCorrectIndex(index)}
              >
                <Text style={styles.radioLabel}>
                  {String.fromCharCode(65 + index)}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.optionInput,
                  correctIndex === index && styles.optionInputCorrect,
                ]}
                value={option}
                onChangeText={(v) => handleOptionChange(index, v)}
                placeholder={`${t("Option", "選択肢")} ${String.fromCharCode(65 + index)}`}
                editable={!isLoading}
              />
              {options.length > 2 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveOption(index)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {options.length < 8 && (
            <TouchableOpacity style={styles.addOptionButton} onPress={handleAddOption}>
              <Text style={styles.addOptionText}>{t("+ Add Option", "+ 選択肢を追加")}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* 正誤問題: 正解ボタン */}
      {questionType === "true_false" && (
        <>
          <Text style={styles.label}>
            {t("Correct Answer", "正解")} <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.trueFalseRow}>
            <TouchableOpacity
              style={[
                styles.trueFalseButton,
                correctAnswerText === t("True", "正しい") &&
                  styles.trueFalseButtonActive,
              ]}
              onPress={() => setCorrectAnswerText(t("True", "正しい"))}
            >
              <Text
                style={[
                  styles.trueFalseText,
                  correctAnswerText === t("True", "正しい") &&
                    styles.trueFalseTextActive,
                ]}
              >
                {t("True", "正しい")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.trueFalseButton,
                correctAnswerText === t("False", "誤り") &&
                  styles.trueFalseButtonActive,
              ]}
              onPress={() => setCorrectAnswerText(t("False", "誤り"))}
            >
              <Text
                style={[
                  styles.trueFalseText,
                  correctAnswerText === t("False", "誤り") &&
                    styles.trueFalseTextActive,
                ]}
              >
                {t("False", "誤り")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* 記述式: 正解テキスト入力 */}
      {questionType === "text_input" && (
        <>
          <Text style={styles.label}>
            {t("Correct Answer", "正解")} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={correctAnswerText}
            onChangeText={setCorrectAnswerText}
            placeholder={t("Enter the correct answer", "正解を入力してください")}
            editable={!isLoading}
          />
        </>
      )}

      {/* 解説 */}
      <Text style={styles.label}>{t("Explanation (optional)", "解説（任意）")}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={explanation}
        onChangeText={setExplanation}
        placeholder={t("Explain why this is the correct answer", "なぜこれが正解なのかを説明してください")}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!isLoading}
      />

      {/* 難易度 */}
      <Text style={styles.label}>{t("Difficulty", "難易度")}</Text>
      <View style={styles.difficultyRow}>
        {renderDifficultyButton("easy", t("Easy", "易"))}
        {renderDifficultyButton("medium", t("Medium", "普通"))}
        {renderDifficultyButton("hard", t("Hard", "難"))}
      </View>

      {/* カテゴリ */}
      <Text style={styles.label}>{t("Category (optional)", "カテゴリ（任意）")}</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder={t("e.g., Math, Grammar", "例: 数学、英語")}
        editable={!isLoading}
      />

      {/* ボタン */}
      <TouchableOpacity
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={handleSaveAndNext}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t("Save & Add Next", "保存して次の問題へ")}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
        onPress={handleSaveAndBack}
        disabled={isLoading}
      >
        <Text style={styles.secondaryButtonText}>{t("Save & Go Back", "保存して戻る")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={isLoading}
      >
        <Text style={styles.cancelButtonText}>{t("Cancel", "キャンセル")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBulkForm = () => (
    <View>
      <Text style={styles.bulkDescription}>{t("Separate questions with a blank line or \"---\" to add multiple questions at once.", "空行または「---」で問題を区切って、複数の問題をまとめて入力できます。")}</Text>

      {/* フォーマット例 */}
      <View style={styles.formatBox}>
        <Text style={styles.formatBoxTitle}>{t("Input Format", "入力フォーマット")}</Text>
        <Text style={styles.formatBoxText}>{t("Question 1\nAnswer 1\n\nQuestion 2\nAnswer 2\n\n---\nQuestion 3\nAnswer 3", "問題文1\n答え1\n\n問題文2\n答え2\n\n---\n問題文3\n答え3")}</Text>
      </View>

      <TouchableOpacity style={styles.templateButton} onPress={handleInsertTemplate}>
        <Text style={styles.templateButtonText}>{t("Insert Template", "テンプレートを挿入")}</Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, styles.bulkTextArea]}
        value={bulkText}
        onChangeText={(v) => {
          setBulkText(v);
          setParsedQuestions(null);
        }}
        placeholder={t("Question\nAnswer\n\nQuestion 2\nAnswer 2\n...", "問題文\n答え\n\n問題文2\n答え2\n...")}
        multiline
        textAlignVertical="top"
        editable={!isBulkLoading}
      />

      {/* プレビューボタン */}
      {!parsedQuestions && (
        <TouchableOpacity style={styles.primaryButton} onPress={handlePreview}>
          <Text style={styles.primaryButtonText}>{t("Preview", "プレビュー確認")}</Text>
        </TouchableOpacity>
      )}

      {/* プレビューリスト */}
      {parsedQuestions && (
        <View>
          <Text style={styles.previewTitle}>
            {t(`${parsedQuestions.length} question(s) recognized`, `${parsedQuestions.length}問が認識されました`)}
          </Text>
          {parsedQuestions.map((q, i) => (
            <View key={i} style={styles.previewItem}>
              <Text style={styles.previewNumber}>{i + 1}</Text>
              <View style={styles.previewContent}>
                <Text style={styles.previewQuestion} numberOfLines={2}>
                  {q.question_text}
                </Text>
                <Text style={styles.previewAnswer}>
                  {t("Correct Answer", "正解")}: {q.correct_answer}
                </Text>
              </View>
            </View>
          ))}

          {/* 進捗 */}
          {isBulkLoading && (
            <View style={styles.progressBox}>
              <ActivityIndicator color="#007AFF" />
              <Text style={styles.progressText}>
                {bulkProgress} / {parsedQuestions.length}
              </Text>
            </View>
          )}

          {/* 一括追加ボタン */}
          <TouchableOpacity
            style={[styles.primaryButton, isBulkLoading && styles.buttonDisabled]}
            onPress={handleBulkSave}
            disabled={isBulkLoading}
          >
            <Text style={styles.primaryButtonText}>
              {t(`Add ${parsedQuestions.length} Question(s)`, `${parsedQuestions.length}問を一括追加`)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setParsedQuestions(null)}
            disabled={isBulkLoading}
          >
            <Text style={styles.cancelButtonText}>{t("Edit Again", "入力に戻る")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
        disabled={isBulkLoading}
      >
        <Text style={styles.cancelButtonText}>{t("Cancel", "キャンセル")}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        {/* タブ */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "single" && styles.tabActive]}
            onPress={() => setActiveTab("single")}
          >
            <Text style={[styles.tabText, activeTab === "single" && styles.tabTextActive]}>
              {t("One by One", "1問ずつ")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "bulk" && styles.tabActive]}
            onPress={() => setActiveTab("bulk")}
          >
            <Text style={[styles.tabText, activeTab === "bulk" && styles.tabTextActive]}>
              {t("Bulk Input", "まとめて入力")}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "single" ? renderSingleForm() : renderBulkForm()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  inner: {
    padding: 16,
  },
  // タブ
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#e8e8e8",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#fff",
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#007AFF",
    fontWeight: "700",
  },
  // ラベル
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 14,
  },
  required: {
    color: "#FF3B30",
  },
  hint: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
    marginTop: -4,
  },
  // 問題タイプ選択
  typeSelector: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  typeButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  typeButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  typeButtonText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  // 入力フィールド
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
  },
  bulkTextArea: {
    minHeight: 200,
  },
  // 選択肢行
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  radioButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonActive: {
    borderColor: "#34C759",
    backgroundColor: "#34C759",
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
  },
  optionInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  optionInputCorrect: {
    borderColor: "#34C759",
    backgroundColor: "#f0fff4",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    fontSize: 12,
    color: "#FF3B30",
  },
  addOptionButton: {
    borderWidth: 1.5,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  addOptionText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  // 正誤問題
  trueFalseRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  trueFalseButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d0d0d0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  trueFalseButtonActive: {
    borderColor: "#34C759",
    backgroundColor: "#34C759",
  },
  trueFalseText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  trueFalseTextActive: {
    color: "#fff",
  },
  // 難易度
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#d0d0d0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  difficultyButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF",
  },
  difficultyEasy: {
    borderColor: "#34C759",
    backgroundColor: "#34C759",
  },
  difficultyHard: {
    borderColor: "#FF3B30",
    backgroundColor: "#FF3B30",
  },
  difficultyButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  difficultyButtonTextActive: {
    color: "#fff",
  },
  // ボタン
  primaryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  secondaryButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // まとめて入力
  bulkDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },
  formatBox: {
    backgroundColor: "#EFF3FB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  formatBoxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  formatBoxText: {
    fontSize: 13,
    color: "#555",
    fontFamily: "monospace",
    lineHeight: 20,
  },
  templateButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  templateButtonText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  // プレビュー
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 16,
    marginBottom: 10,
  },
  previewItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    gap: 10,
  },
  previewNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
  },
  previewContent: {
    flex: 1,
  },
  previewQuestion: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    marginBottom: 4,
  },
  previewAnswer: {
    fontSize: 13,
    color: "#34C759",
  },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 15,
    color: "#555",
    fontWeight: "600",
  },
});
