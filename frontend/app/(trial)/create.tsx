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
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";
import { ContentLanguage } from "../../src/api/questionSets";
import {
  localStorageService,
  LocalQuestion,
} from "../../src/services/localStorageService";
import Header from "../../src/components/Header";
import Modal from "../../src/components/Modal";
import { QUESTION_SET_CSV_PROMPT_MARKDOWN } from "../../src/data/questionSetCsvPromptMarkdown";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

type InputMode = "manual" | "csv";

export default function TrialCreateScreen() {
  const [inputMode, setInputMode] = useState<InputMode>("manual");
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
  const [csvQuestions, setCsvQuestions] = useState<LocalQuestion[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvParseError, setCsvParseError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCsvPromptModal, setShowCsvPromptModal] = useState(false);
  const { t, language } = useLanguage();
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>(
    () => (language === "ja" ? "ja" : "en")
  );
  const router = useRouter();

  const downloadCSVSample = async () => {
    const csvSample = [
      // ヘッダー（全列）
      "question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2",

      // ── 短答形式（correct_answer に答えを書くだけ）──
      "What is the capital of Japan?,,,,,,Tokyo,Japan's capital city is Tokyo,0.2,geography,asia,capitals",
      "日本の首都は？,,,,,,東京,日本の首都は東京都,0.2,地理,アジア,首都",
      "What is H2O?,,,,,,Water,H2O is the chemical formula for water,0.1,science,chemistry,compounds",
      "水の化学式は？,,,,,,H2O,水の化学式はH2Oです,0.1,理科,化学,化合物",
      "Who wrote Romeo and Juliet?,,,,,,William Shakespeare,Shakespeare wrote this famous play in the late 16th century,0.3,literature,english,drama",
      "「ロミオとジュリエット」の作者は？,,,,,,シェイクスピア,ウィリアム・シェイクスピアが16世紀末に執筆,0.3,文学,英語,演劇",
      "What is the speed of light?,,,,,,299792458 m/s,The speed of light in a vacuum is approximately 3×10⁸ m/s,0.6,science,physics,constants",
      "光の速さは？,,,,,,約30万km/s,真空中の光速は約2.998×10⁸ m/s,0.6,理科,物理,定数",

      // ── 四択形式（option_1〜4 を使う）──
      "What is 8 × 7?,multiple_choice,42,54,56,64,56,8 multiplied by 7 equals 56,0.2,math,arithmetic,multiplication",
      "8×7の答えは？,multiple_choice,42,54,56,64,56,8かける7は56,0.2,数学,算数,掛け算",
      "Which planet is closest to the Sun?,multiple_choice,Venus,Earth,Mercury,Mars,Mercury,Mercury is the innermost planet of the Solar System,0.3,science,astronomy,solar-system",
      "太陽に最も近い惑星は？,multiple_choice,金星,地球,水星,火星,水星,水星は太陽系で最も内側にある惑星,0.3,理科,天文,太陽系",
      "What does 'CPU' stand for?,multiple_choice,Central Processing Unit,Computer Power Unit,Core Processing Utility,Central Power Unit,Central Processing Unit,CPU is the main processor in a computer,0.3,IT,hardware,basics",
      "CPUとは何の略？,multiple_choice,中央処理装置,コンピュータ電源装置,コア処理ユーティリティ,中央電力装置,中央処理装置（Central Processing Unit）,コンピュータの主要な演算装置,0.3,IT,ハードウェア,基礎",
      "Which country invented the telephone?,multiple_choice,France,Germany,United States,United Kingdom,United States,Alexander Graham Bell patented the telephone in the US in 1876,0.5,history,technology,inventions",
      "電話を発明した国は？,multiple_choice,フランス,ドイツ,アメリカ,イギリス,アメリカ,グラハム・ベルが1876年にアメリカで特許を取得,0.5,歴史,テクノロジー,発明",

      // ── 正誤判定形式（true / false）──
      "The Great Wall of China is visible from space.,,,,,,false,This is a common myth. It is not visible with the naked eye from space.,0.4,general,myths,space",
      "万里の長城は宇宙から肉眼で見える。,,,,,,false,これはよくある誤解。実際には宇宙から肉眼では見えない。,0.4,一般常識,通説,宇宙",
      "Photosynthesis produces oxygen.,,,,,,true,Plants use CO2 and sunlight to produce glucose and release O2,0.3,science,biology,plants",
      "光合成によって酸素が生成される。,,,,,,true,植物はCO2と光を使ってグルコースを生成しO2を放出する,0.3,理科,生物,植物",
      "Python is a compiled language.,,,,,,false,Python is an interpreted language,0.4,IT,programming,python",
      "Pythonはコンパイル型言語である。,,,,,,false,Pythonはインタプリタ型言語,0.4,IT,プログラミング,Python",
    ].join("\n");

    if (Platform.OS === "web") {
      const blob = new Blob([csvSample], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "csv_sample.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const path = (FileSystem.documentDirectory ?? "") + "csv_sample.csv";
      await FileSystem.writeAsStringAsync(path, csvSample, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  };

  const handleCsvPick = async () => {
    setCsvParseError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/csv", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const text = await response.text();
      const parsed = localStorageService.parseCSVToQuestionSet(
        text,
        title || "untitled",
        description
      );
      if (parsed.questions.length === 0) {
        setCsvParseError(
          t(
            "No valid questions found in CSV. Check the format.",
            "CSVから有効な問題が見つかりませんでした。フォーマットを確認してください。"
          )
        );
        return;
      }
      setCsvQuestions(parsed.questions);
      setCsvFileName(asset.name || "questions.csv");
    } catch (err) {
      setCsvParseError(
        t("Failed to read CSV file", "CSVファイルの読み込みに失敗しました")
      );
    }
  };

  const handleCopyCsvPrompt = async () => {
    try {
      await Clipboard.setStringAsync(QUESTION_SET_CSV_PROMPT_MARKDOWN);
      Alert.alert(
        t("Copied", "コピーしました"),
        t(
          "Paste into your AI tool as the system or instruction prompt.",
          "AIツールのシステムプロンプトや指示として貼り付けられます。"
        )
      );
    } catch {
      Alert.alert(
        t("Copy failed", "コピーに失敗しました"),
        t(
          "Select the text in the preview and copy manually.",
          "表示テキストを長押しして手動でコピーしてください。"
        )
      );
    }
  };

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

    let finalQuestions: typeof questions;

    if (inputMode === "csv") {
      if (csvQuestions.length === 0) {
        setErrorMessage(
          t("Please select a CSV file", "CSVファイルを選択してください")
        );
        return;
      }
      finalQuestions = csvQuestions.map((q) => ({
        question: q.question,
        answer: q.answer,
        difficulty: q.difficulty,
        category: q.category,
      }));
    } else {
      finalQuestions = questions.filter(
        (q) => q.question.trim() && q.answer.trim()
      );
      if (finalQuestions.length === 0) {
        setErrorMessage(
          t("Please add at least one question", "最低1つの問題を追加してください")
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      await localStorageService.saveTrialQuestionSet({
        title,
        description,
        questions: finalQuestions,
        content_language: contentLanguage,
      });

      setSuccessMessage(
        t("Question set created!", "問題セットを作成しました！")
      );
      setTimeout(() => router.replace("/(trial)/trial-question-sets"), 1500);
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
      <Header title={t("Create Question Set", "問題セットを作成")} />
      <Modal
        visible={showCsvPromptModal}
        title={t(
          "CSV generation prompt (Markdown)",
          "問題集CSV生成プロンプト（Markdown）"
        )}
        onClose={() => setShowCsvPromptModal(false)}
      >
        <Text style={styles.csvPromptBody} selectable>
          {QUESTION_SET_CSV_PROMPT_MARKDOWN}
        </Text>
        <View style={styles.csvPromptActions}>
          <TouchableOpacity
            style={styles.csvPromptCopyBtn}
            onPress={handleCopyCsvPrompt}
          >
            <Text style={styles.csvPromptCopyBtnText}>
              {t("Copy all", "全文をコピー")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.csvPromptCloseBtn}
            onPress={() => setShowCsvPromptModal(false)}
          >
            <Text style={styles.csvPromptCloseBtnText}>
              {t("Close", "閉じる")}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>
          {t("Create Question Set", "問題セットを作成")}
        </Text>

        <View style={styles.trialNotice}>
          <Text style={styles.trialNoticeText}>
            {t(
              "Data is stored locally on your device",
              "データはこのデバイスにローカル保存されます"
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

        <Text style={styles.langLabel}>
          {t("Content language", "問題の言語")}
        </Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[
              styles.langChip,
              contentLanguage === "ja" && styles.langChipActive,
            ]}
            onPress={() => setContentLanguage("ja")}
          >
            <Text
              style={[
                styles.langChipText,
                contentLanguage === "ja" && styles.langChipTextActive,
              ]}
            >
              {t("Japanese", "日本語")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.langChip,
              contentLanguage === "en" && styles.langChipActive,
            ]}
            onPress={() => setContentLanguage("en")}
          >
            <Text
              style={[
                styles.langChipText,
                contentLanguage === "en" && styles.langChipTextActive,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

        {/* タブ切り替え */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, inputMode === "manual" && styles.tabActive]}
            onPress={() => setInputMode("manual")}
          >
            <Text
              style={[
                styles.tabText,
                inputMode === "manual" && styles.tabTextActive,
              ]}
            >
              {t("Manual Input", "手動入力")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, inputMode === "csv" && styles.tabActive]}
            onPress={() => setInputMode("csv")}
          >
            <Text
              style={[
                styles.tabText,
                inputMode === "csv" && styles.tabTextActive,
              ]}
            >
              {t("CSV Import", "CSVインポート")}
            </Text>
          </TouchableOpacity>
        </View>

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

        {inputMode === "csv" ? (
          <View>
            {/* CSV フォーマット説明 */}
            <View style={styles.csvFormatBox}>
              <View style={styles.csvFormatHeader}>
                <Text style={styles.csvFormatTitle}>
                  {t("CSV Format", "CSVフォーマット")}
                </Text>
                <View style={styles.csvFormatHeaderBtns}>
                  <TouchableOpacity
                    style={styles.csvPromptBtn}
                    onPress={() => setShowCsvPromptModal(true)}
                  >
                    <Text style={styles.csvPromptBtnText}>
                      {t("AI prompt", "プロンプト")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.csvDownloadBtn}
                    onPress={downloadCSVSample}
                  >
                    <Text style={styles.csvDownloadBtnText}>
                      ⬇ {t("Download Sample", "サンプルDL")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.csvFormatSubtitle}>
                {t("Required columns", "必須列")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_text, correct_answer"}
              </Text>

              <Text style={styles.csvFormatSubtitle}>
                {t("Optional columns", "任意列")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_type, option_1〜option_4,\nexplanation, difficulty, category,\nsubcategory1, subcategory2"}
              </Text>

              <Text style={styles.csvFormatSubtitle}>
                {t("Example", "例")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_text,correct_answer,difficulty,category\nWhat is 2+2?,4,0.1,math\n日本の首都は？,東京,0.3,地理"}
              </Text>

              <Text style={styles.csvFormatNote}>
                {t(
                  "difficulty: 0.0=easy / 0.5=medium / 1.0=hard  •  Save as UTF-8",
                  "difficulty: 0.0=易 / 0.5=中 / 1.0=難  •  UTF-8で保存"
                )}
              </Text>
            </View>

            {/* ファイル選択ボタン */}
            <TouchableOpacity
              style={styles.csvPickButton}
              onPress={handleCsvPick}
            >
              <Text style={styles.csvPickButtonText}>
                📂 {t("Select CSV File", "CSVファイルを選択")}
              </Text>
            </TouchableOpacity>

            {csvParseError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{csvParseError}</Text>
              </View>
            ) : null}

            {csvFileName ? (
              <View style={styles.csvPreview}>
                <Text style={styles.csvPreviewFile}>📄 {csvFileName}</Text>
                <Text style={styles.csvPreviewCount}>
                  {t("Questions loaded", "読み込んだ問題数")}: {csvQuestions.length}
                </Text>
                <TouchableOpacity
                  style={styles.csvClearButton}
                  onPress={() => {
                    setCsvQuestions([]);
                    setCsvFileName("");
                    setCsvParseError("");
                  }}
                >
                  <Text style={styles.csvClearButtonText}>
                    {t("Clear", "クリア")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
          <View>
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
          </View>
        )}

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
  langLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  langRow: {
    flexDirection: "row",
    marginBottom: 16,
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
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#007AFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  tabTextActive: {
    color: "#fff",
  },
  csvFormatBox: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  csvFormatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  csvFormatTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    flexShrink: 1,
  },
  csvFormatHeaderBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  csvPromptBtn: {
    backgroundColor: "#5856D6",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  csvPromptBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  csvDownloadBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  csvDownloadBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  csvFormatSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    marginTop: 6,
    marginBottom: 3,
  },
  csvFormatCode: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#555",
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  csvFormatNote: {
    fontSize: 11,
    color: "#888",
    lineHeight: 16,
    marginTop: 6,
  },
  csvPickButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
  },
  csvPickButtonText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  csvPreview: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
    gap: 4,
  },
  csvPreviewFile: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  csvPreviewCount: {
    fontSize: 13,
    color: "#2E7D32",
  },
  csvClearButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#34C759",
  },
  csvClearButtonText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "600",
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
  csvPromptBody: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 11,
    color: "#333",
    lineHeight: 16,
    marginBottom: 12,
  },
  csvPromptActions: {
    flexDirection: "row",
    gap: 10,
  },
  csvPromptCopyBtn: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  csvPromptCopyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  csvPromptCloseBtn: {
    flex: 1,
    backgroundColor: "#E8E8E8",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  csvPromptCloseBtnText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
  },
});
