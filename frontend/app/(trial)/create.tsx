import React, { useState } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
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
import { ContentLanguage, questionSetsApi } from "../../src/api/questionSets";
import { aiApi } from "../../src/api/ai";
import {
  localStorageService,
  LocalQuestion,
} from "../../src/services/localStorageService";
import { getMultipleChoiceAnswerText } from "../../src/utils/multipleChoice";
import Header from "../../src/components/Header";
import Modal from "../../src/components/Modal";
import { QUESTION_SET_CSV_PROMPT_MARKDOWN } from "../../src/data/questionSetCsvPromptMarkdown";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try { ImagePicker = require("expo-image-picker"); } catch {}

type InputMode = "manual" | "csv" | "image" | "anki" | "ai_text";

type ManualQuestionDraft = {
  question: string;
  answer: string;
  explanation?: string;
  difficulty?: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  question_type?: LocalQuestion["question_type"];
  options?: string[];
  correctOptionIndex?: number | null;
};

export default function TrialCreateScreen() {
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<ManualQuestionDraft[]>([
    {
      question: "",
      answer: "",
      explanation: "",
      difficulty: "medium",
      category: "",
      subcategory1: "",
      subcategory2: "",
      question_type: "text_input",
      options: ["", "", "", ""],
      correctOptionIndex: null,
    },
  ]);
  const [csvQuestions, setCsvQuestions] = useState<LocalQuestion[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvParseError, setCsvParseError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCsvPromptModal, setShowCsvPromptModal] = useState(false);

  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Image OCR state
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageQuestions, setImageQuestions] = useState<LocalQuestion[] | null>(null);

  // Anki import state
  const [ankiParsing, setAnkiParsing] = useState(false);
  const [ankiQuestions, setAnkiQuestions] = useState<LocalQuestion[] | null>(null);
  const [ankiDeckTitle, setAnkiDeckTitle] = useState("");

  // AI text generation state
  const [aiTextInput, setAiTextInput] = useState("");
  const [aiTextGenerating, setAiTextGenerating] = useState(false);
  const [aiTextQuestions, setAiTextQuestions] = useState<LocalQuestion[] | null>(null);

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
      "What is the capital of Japan?,text_input,,,,,Tokyo,Japan's capital city is Tokyo,0.2,geography,asia,capitals",
      "日本の首都は？,text_input,,,,,東京,日本の首都は東京都,0.2,地理,アジア,首都",
      "What is H2O?,text_input,,,,,Water,H2O is the chemical formula for water,0.1,science,chemistry,compounds",
      "水の化学式は？,text_input,,,,,H2O,水の化学式はH2Oです,0.1,理科,化学,化合物",
      "Who wrote Romeo and Juliet?,text_input,,,,,William Shakespeare,Shakespeare wrote this famous play in the late 16th century,0.3,literature,english,drama",
      "「ロミオとジュリエット」の作者は？,text_input,,,,,シェイクスピア,ウィリアム・シェイクスピアが16世紀末に執筆,0.3,文学,英語,演劇",
      "What is the speed of light?,text_input,,,,,299792458 m/s,The speed of light in a vacuum is approximately 3×10⁸ m/s,0.6,science,physics,constants",
      "光の速さは？,text_input,,,,,約30万km/s,真空中の光速は約2.998×10⁸ m/s,0.6,理科,物理,定数",

      // ── 四択形式（option_1〜4 を使う）──
      "What is 8 × 7?,multiple_choice,42,54,56,64,3,8 multiplied by 7 equals 56,0.2,math,arithmetic,multiplication",
      "8×7の答えは？,multiple_choice,42,54,56,64,3,8かける7は56,0.2,数学,算数,掛け算",
      "Which planet is closest to the Sun?,multiple_choice,Venus,Earth,Mercury,Mars,3,Mercury is the innermost planet of the Solar System,0.3,science,astronomy,solar-system",
      "太陽に最も近い惑星は？,multiple_choice,金星,地球,水星,火星,3,水星は太陽系で最も内側にある惑星,0.3,理科,天文,太陽系",
      "What does 'CPU' stand for?,multiple_choice,Central Processing Unit,Computer Power Unit,Core Processing Utility,Central Power Unit,1,CPU is the main processor in a computer,0.3,IT,hardware,basics",
      "CPUとは何の略？,multiple_choice,中央処理装置,コンピュータ電源装置,コア処理ユーティリティ,中央電力装置,1,中央処理装置（Central Processing Unit）,コンピュータの主要な演算装置,0.3,IT,ハードウェア,基礎",
      "Which country invented the telephone?,multiple_choice,France,Germany,United States,United Kingdom,3,Alexander Graham Bell patented the telephone in the US in 1876,0.5,history,technology,inventions",
      "電話を発明した国は？,multiple_choice,フランス,ドイツ,アメリカ,イギリス,3,グラハム・ベルが1876年にアメリカで特許を取得,0.5,歴史,テクノロジー,発明",

      // ── 正誤判定形式（true / false）──
      "The Great Wall of China is visible from space.,true_false,,,,,false,This is a common myth. It is not visible with the naked eye from space.,0.4,general,myths,space",
      "万里の長城は宇宙から肉眼で見える。,true_false,,,,,false,これはよくある誤解。実際には宇宙から肉眼では見えない。,0.4,一般常識,通説,宇宙",
      "Photosynthesis produces oxygen.,true_false,,,,,true,Plants use CO2 and sunlight to produce glucose and release O2,0.3,science,biology,plants",
      "光合成によって酸素が生成される。,true_false,,,,,true,植物はCO2と光を使ってグルコースを生成しO2を放出する,0.3,理科,生物,植物",
      "Python is a compiled language.,true_false,,,,,false,Python is an interpreted language,0.4,IT,programming,python",
      "Pythonはコンパイル型言語である。,true_false,,,,,false,Pythonはインタプリタ型言語,0.4,IT,プログラミング,Python",
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
    setQuestions([
      ...questions,
      {
        question: "",
        answer: "",
        explanation: "",
        difficulty: "medium",
        category: "",
        subcategory1: "",
        subcategory2: "",
        question_type: "text_input",
        options: ["", "", "", ""],
        correctOptionIndex: null,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const updateQuestion = (
    index: number,
    field:
      | "question"
      | "answer"
      | "explanation"
      | "difficulty"
      | "category"
      | "subcategory1"
      | "subcategory2",
    value: string
  ) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateQuestionType = (
    index: number,
    value: LocalQuestion["question_type"]
  ) => {
    const newQuestions = [...questions];
    const prev = newQuestions[index];
    newQuestions[index] = {
      ...prev,
      question_type: value,
      options:
        value === "multiple_choice"
          ? prev.options && prev.options.length > 0
            ? prev.options
            : ["", "", "", ""]
          : undefined,
      correctOptionIndex: value === "multiple_choice" ? prev.correctOptionIndex ?? null : null,
      answer:
        value === "true_false"
          ? prev.answer === "true" || prev.answer === "false"
            ? prev.answer
            : ""
          : value === "multiple_choice"
            ? ""
            : prev.answer,
    };
    setQuestions(newQuestions);
  };

  const updateQuestionOption = (index: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    const options = [...(newQuestions[index].options || ["", "", "", ""])];
    options[optionIndex] = value;
    newQuestions[index].options = options;
    setQuestions(newQuestions);
  };

  const updateQuestionCorrectOption = (index: number, optionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[index].correctOptionIndex = optionIndex;
    setQuestions(newQuestions);
  };

  // --- Image OCR handlers ---
  const handlePickImageForGeneration = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t("Permission required", "権限が必要です")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await generateFromImage(result.assets[0].uri);
  };

  const handleCameraForGeneration = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t("Permission required", "権限が必要です")); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await generateFromImage(result.assets[0].uri);
  };

  const generateFromImage = async (uri: string) => {
    const ext = uri.split(".").pop() || "jpg";
    setImageGenerating(true);
    setImageQuestions(null);
    try {
      const res = await aiApi.generateFromImage(
        { uri, name: `photo.${ext}`, type: `image/${ext}` }, 5
      );
      setImageQuestions(res.questions.map((q, i) => ({
        id: `img_${Date.now()}_${i}`,
        question: q.question_text,
        answer: q.correct_answer,
        explanation: q.explanation || undefined,
        question_type: (q.question_type as LocalQuestion["question_type"]) || "text_input",
        options: q.options || undefined,
        category: q.category || undefined,
      })));
    } catch (error: any) {
      Alert.alert(t("Error", "エラー"), error.response?.data?.detail || t("Failed to generate questions from image", "画像からの問題生成に失敗しました"));
    } finally {
      setImageGenerating(false);
    }
  };

  // --- Anki import handlers ---
  const handlePickAnkiFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.name?.toLowerCase().endsWith(".apkg")) {
        Alert.alert(t("Error", "エラー"), t("Please select an .apkg file", ".apkgファイルを選択してください"));
        return;
      }

      setAnkiParsing(true);
      setAnkiQuestions(null);
      try {
        const res = await questionSetsApi.parseAnki({
          uri: asset.uri,
          name: asset.name || "deck.apkg",
          type: asset.mimeType || "application/octet-stream",
        });
        setAnkiDeckTitle(res.title);
        if (!title.trim()) setTitle(res.title);
        setAnkiQuestions(res.questions.map((q, i) => ({
          id: `anki_${Date.now()}_${i}`,
          question: q.question_text,
          answer: q.correct_answer,
          question_type: (q.question_type as LocalQuestion["question_type"]) || "text_input",
          options: q.options || undefined,
          media_urls: q.media_urls?.map(m => ({ ...m, position: m.position as "question" | "answer", type: m.type as "image" | "audio" })) || undefined,
        })));
      } catch (error: any) {
        Alert.alert(t("Error", "エラー"), error.response?.data?.detail || t("Failed to parse Anki file", "Ankiファイルの解析に失敗しました"));
      } finally {
        setAnkiParsing(false);
      }
    } catch {}
  };

  // --- AI text generation handler ---
  const handleGenerateFromText = async () => {
    if (aiTextInput.trim().length < 10) {
      Alert.alert(t("Error", "エラー"), t("Please enter at least 10 characters of text.", "10文字以上のテキストを入力してください。"));
      return;
    }
    setAiTextGenerating(true);
    setAiTextQuestions(null);
    try {
      const res = await aiApi.generateFromText(aiTextInput, undefined, contentLanguage);
      setAiTextQuestions(res.questions.map((q, i) => ({
        id: `aitxt_${Date.now()}_${i}`,
        question: q.question_text,
        answer: q.correct_answer,
        explanation: q.explanation || undefined,
        question_type: (q.question_type as LocalQuestion["question_type"]) || "text_input",
        options: q.options || undefined,
        category: q.category || undefined,
      })));
    } catch (error: any) {
      Alert.alert(
        t("Error", "エラー"),
        error.response?.data?.detail || t("Failed to generate questions from text.", "テキストからの問題生成に失敗しました。"),
      );
    } finally {
      setAiTextGenerating(false);
    }
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

    let finalQuestions: LocalQuestion[];

    if (inputMode === "csv") {
      if (csvQuestions.length === 0) {
        setErrorMessage(t("Please select a CSV file", "CSVファイルを選択してください"));
        return;
      }
      finalQuestions = csvQuestions;
    } else if (inputMode === "image") {
      if (!imageQuestions || imageQuestions.length === 0) {
        setErrorMessage(t("Generate questions from an image first", "まず画像から問題を生成してください"));
        return;
      }
      finalQuestions = imageQuestions;
    } else if (inputMode === "anki") {
      if (!ankiQuestions || ankiQuestions.length === 0) {
        setErrorMessage(t("Import an Anki deck first", "まずAnkiデッキをインポートしてください"));
        return;
      }
      finalQuestions = ankiQuestions;
    } else if (inputMode === "ai_text") {
      if (!aiTextQuestions || aiTextQuestions.length === 0) {
        setErrorMessage(t("Generate questions from text first", "まずテキストから問題を生成してください"));
        return;
      }
      finalQuestions = aiTextQuestions;
    } else {
      const valid = questions.filter((q) => {
        if (!q.question.trim()) return false;
        const questionType = q.question_type || "text_input";
        if (questionType === "multiple_choice") {
          const options = (q.options || []).map((option) => option.trim()).filter(Boolean);
          return options.length >= 2 && q.correctOptionIndex !== null && q.correctOptionIndex !== undefined;
        }
        if (questionType === "true_false") {
          return q.answer === "true" || q.answer === "false";
        }
        return q.answer.trim().length > 0;
      });
      if (valid.length === 0) {
        setErrorMessage(t("Please add at least one question", "最低1つの問題を追加してください"));
        return;
      }
      finalQuestions = valid.map((q, i) => {
        const questionType = q.question_type || "text_input";
        const options = (q.options || []).map((option) => option.trim()).filter(Boolean);
        const multipleChoiceAnswer =
          q.correctOptionIndex !== null &&
          q.correctOptionIndex !== undefined &&
          options[q.correctOptionIndex]
            ? options[q.correctOptionIndex]
            : "";

        return {
          id: `q_${Date.now()}_${i}`,
          question: q.question,
          answer: questionType === "multiple_choice" ? multipleChoiceAnswer : q.answer,
          explanation: q.explanation?.trim() || undefined,
          difficulty: q.difficulty as LocalQuestion["difficulty"],
          category: q.category,
          subcategory1: q.subcategory1,
          subcategory2: q.subcategory2,
          question_type: questionType,
          options: questionType === "multiple_choice" ? options : undefined,
        };
      });
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

        <View style={styles.featureBanner}>
          <Text style={styles.featureBannerTitle}>{t("What you can do", "できること")}</Text>
          <Text style={styles.featureBannerSub}>{t("Tap any item to see how to use it", "タップすると使い方を表示")}</Text>
          <View style={styles.featureChips}>
            {([
              {
                id: "mc",
                label: t("Multiple Choice", "多肢選択"),
                color: "#007AFF",
                bg: "#E8F0FE",
                desc: t(
                  "Only on the AI Text tab: paste text and run AI generation to get multiple-choice items (with options). The Manual tab has no option fields; CSV uses option_1–4 columns on the CSV tab instead.",
                  "多肢選択（選択肢付き）は「AIテキスト」タブでテキストを貼り付けてAI生成するときに利用します。「手動」タブに選択肢用の欄はありません。CSVで多肢にする場合は「CSV」タブの option_1〜4 列のルールになります。"
                ),
              },
              {
                id: "tf",
                label: t("True / False", "正誤問題"),
                color: "#FF9500",
                bg: "#FFF3E0",
                desc: t(
                  "On the AI Text or Image tab, AI-generated quizzes may include true/false questions. On the Manual tab, enter a statement as the question and \"true\" or \"false\" as the answer if you want TF-style cards.",
                  "「AIテキスト」または「画像」タブでAIが生成する問題に、正誤形式が含まれることがあります。「手動」タブでは、問題文に命題を書き、答えに true / false と入力する形でも作成できます。"
                ),
              },
              {
                id: "text",
                label: t("Text Input", "記述式"),
                color: "#8E8E93",
                bg: "#F2F2F7",
                desc: t(
                  "On the Manual tab, type each question and answer. AI Text and Image generation may also include short free-text answer items. For CSV, see the CSV tab format (auto-detection or explicit question_type).",
                  "「手動」タブでは、問題と答えをそのまま入力します。「AIテキスト」「画像」タブのAI生成でも記述式が含まれることがあります。CSVでの扱いは「CSV」タブのフォーマット（自動判定または question_type 列）を参照してください。"
                ),
              },
              {
                id: "media",
                label: t("Images & Audio", "画像・音声"),
                color: "#34C759",
                bg: "#E8F5E9",
                desc: t(
                  "After saving a question (in Server mode), you can attach images and audio to both the question and answer sides. Supports camera capture, photo library, audio recording, and file upload.",
                  "問題を保存後（サーバーモード）、問題側・解答側の両方に画像や音声を添付できます。カメラ撮影、写真ライブラリ、録音、ファイルアップロードに対応しています。"
                ),
              },
              {
                id: "latex",
                label: t("Math ($LaTeX$)", "数式 ($LaTeX$)"),
                color: "#5856D6",
                bg: "#EDE7F6",
                desc: t(
                  "Use $...$ for inline math and $$...$$ for block math in any question or answer text.\n\nExamples:\n• Inline: The area is $\\pi r^2$\n• Block: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
                  "問題文や解答に $...$ でインライン数式、$$...$$ でブロック数式を記述できます。\n\n例:\n• インライン: 面積は $\\pi r^2$\n• ブロック: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$"
                ),
              },
              {
                id: "csv",
                label: t("CSV auto-detect", "CSV自動判定"),
                color: "#FF6B35",
                bg: "#FFF3E0",
                desc: t(
                  "Only on the CSV tab: when you upload a CSV file, question_type is auto-detected:\n• Has option_1~option_4 → Multiple Choice\n• Answer is \"true\" or \"false\" → True/False\n• Otherwise → Text Input\n\nYou can also set question_type explicitly in the CSV column.",
                  "「CSV」タブでCSVファイルをアップロードしたときだけ、question_typeを次のように自動判定します:\n• option_1〜option_4がある → 多肢選択\n• 答えが「true」または「false」→ 正誤問題\n• それ以外 → 記述式\n\n列で question_type を明示指定することも可能です。"
                ),
              },
            ] as const).map((feature) => (
              <View key={feature.id} style={{ width: "100%" }}>
                <TouchableOpacity
                  style={[
                    styles.featureChipBtn,
                    { backgroundColor: feature.bg, borderColor: feature.color },
                    expandedFeature === feature.id && { borderWidth: 1.5 },
                  ]}
                  onPress={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.featureChipDot, { backgroundColor: feature.color }]} />
                  <Text style={[styles.featureChipLabel, { color: feature.color }]}>{feature.label}</Text>
                  {feature.desc ? (
                    <View style={[styles.featureHelpBadge, { backgroundColor: feature.color }]}>
                      <Text style={styles.featureHelpBadgeText}>?</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
                {expandedFeature === feature.id && (
                  <View style={[styles.featureDetail, { borderLeftColor: feature.color }]}>
                    <Text style={styles.featureDetailText}>{feature.desc}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
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
              {t("English", "英語")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* タブ切り替え */}
        <View style={styles.tabRow}>
          {([
            { key: "manual" as InputMode, label: t("Manual", "手動") },
            { key: "ai_text" as InputMode, label: t("AI Text", "AIテキスト") },
            { key: "csv" as InputMode, label: "CSV" },
            { key: "image" as InputMode, label: t("Image", "画像") },
            { key: "anki" as InputMode, label: "Anki" },
          ] as const).map((tab, index, tabs) => (
            <React.Fragment key={tab.key}>
              <TouchableOpacity
                style={[styles.tab, inputMode === tab.key && styles.tabActive]}
                onPress={() => setInputMode(tab.key)}
              >
                <Text style={[styles.tabText, inputMode === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
              {index < tabs.length - 1 ? <View style={styles.tabDivider} /> : null}
            </React.Fragment>
          ))}
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

        {inputMode === "csv" && (
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
                    <Text style={styles.csvPromptBtnText} numberOfLines={2}>
                      {t("AI CSV creation prompt", "AI向けCSV作成プロンプト")}
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
                {t("What each column means", "各列の意味")}
              </Text>
              <Text style={styles.csvFormatText}>
                {t(
                  "question_text: the question sentence shown to the learner\ncorrect_answer: the answer itself for text_input / true_false, or 1-4 for multiple_choice\nquestion_type: optional; use text_input / multiple_choice / true_false\noption_1-4: choices for multiple_choice only\nexplanation: explanation shown after answering\ndifficulty: number from 0.0 to 1.0; smaller = easier\ncategory: broad group such as math or geography\nsubcategory1: narrower group inside category\nsubcategory2: even more specific tag or subtopic",
                  "question_text: 学習者に表示される問題文\ncorrect_answer: 記述式・正誤問題では答えそのもの、多肢選択では正しい選択肢番号 1〜4\nquestion_type: 任意列。text_input / multiple_choice / true_false を指定\noption_1〜4: 多肢選択問題の選択肢。記述式・正誤問題では空欄でOK\nexplanation: 解答後に表示する解説\ndifficulty: 0.0〜1.0 の数値。小さいほどやさしい\ncategory: 数学・地理などの大きな分類\nsubcategory1: category の中をもう少し細かく分ける分類\nsubcategory2: さらに細かいタグやテーマ"
                )}
              </Text>

              <Text style={styles.csvFormatSubtitle}>
                {t("Example", "例")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_text,correct_answer,difficulty,category\nWhat is 2+2?,4,0.1,math\n日本の首都は？,東京,0.3,地理\nThe chemical symbol for water is?,H2O,0.2,science\n富士山がある都道府県は？,山梨県,0.4,地理"}
              </Text>
              <Text style={styles.csvFormatSubtitle}>
                {t("Multiple choice example", "多肢選択の例")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_text,question_type,option_1,option_2,option_3,option_4,correct_answer\nWhich planet is closest to the Sun?,multiple_choice,Venus,Earth,Mercury,Mars,3\n日本で一番大きい島は？,multiple_choice,北海道,本州,四国,九州,2"}
              </Text>
              <Text style={styles.csvFormatSubtitle}>
                {t("True/false example", "正誤問題の例")}
              </Text>
              <Text style={styles.csvFormatCode}>
                {"question_text,question_type,correct_answer\nThe Earth revolves around the Sun.,true_false,true\nペンギンは哺乳類である。,true_false,false"}
              </Text>
              <Text style={styles.csvFormatSubtitle}>
                {t("Multiple choice note", "多肢選択の注意")}
              </Text>
              <Text style={styles.csvFormatText}>
                {t(
                  "For multiple-choice questions, put 1, 2, 3, or 4 in correct_answer to indicate which option column is correct.",
                  "多肢選択問題の correct_answer には、正しい選択肢の番号として 1 / 2 / 3 / 4 を入れてください。"
                )}
              </Text>

              <Text style={styles.csvFormatNote}>
                {t(
                  "difficulty: 0.0=easy / 0.5=medium / 1.0=hard  •  Save as UTF-8\n\nquestion_type auto-detection: options → MC, true/false answer → TF, otherwise → text input",
                  "difficulty: 0.0=易 / 0.5=中 / 1.0=難  •  UTF-8で保存\n\nquestion_type 自動判定: 選択肢あり→多肢選択、答えがtrue/false→正誤、それ以外→記述式"
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
        )}

        {inputMode === "manual" && (
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

                <Text style={styles.manualFieldLabel}>
                  {t("Question Type", "問題形式")}
                </Text>
                <View style={styles.manualChipRow}>
                  {([
                    { key: "text_input" as const, label: t("Text Input", "記述式") },
                    { key: "multiple_choice" as const, label: t("Multiple Choice", "多肢選択") },
                    { key: "true_false" as const, label: t("True / False", "正誤問題") },
                  ]).map((typeOption) => (
                    <TouchableOpacity
                      key={typeOption.key}
                      style={[
                        styles.manualChip,
                        (q.question_type || "text_input") === typeOption.key &&
                          styles.manualChipActive,
                      ]}
                      onPress={() => updateQuestionType(index, typeOption.key)}
                    >
                      <Text
                        style={[
                          styles.manualChipText,
                          (q.question_type || "text_input") === typeOption.key &&
                            styles.manualChipTextActive,
                        ]}
                      >
                        {typeOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(q.question_type || "text_input") === "multiple_choice" ? (
                  <View style={styles.manualGroup}>
                    <Text style={styles.manualFieldLabel}>
                      {t("Options", "選択肢")}
                    </Text>
                    {(q.options || ["", "", "", ""]).map((option, optionIndex) => (
                      <View key={optionIndex} style={styles.manualOptionRow}>
                        <TouchableOpacity
                          style={[
                            styles.manualAnswerPicker,
                            q.correctOptionIndex === optionIndex &&
                              styles.manualAnswerPickerActive,
                          ]}
                          onPress={() => updateQuestionCorrectOption(index, optionIndex)}
                        >
                          <Text
                            style={[
                              styles.manualAnswerPickerText,
                              q.correctOptionIndex === optionIndex &&
                                styles.manualAnswerPickerTextActive,
                            ]}
                          >
                            {optionIndex + 1}
                          </Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.input, styles.manualOptionInput]}
                          placeholder={t(
                            `Option ${optionIndex + 1}`,
                            `選択肢${optionIndex + 1}`
                          )}
                          placeholderTextColor="#999"
                          value={option}
                          onChangeText={(text) =>
                            updateQuestionOption(index, optionIndex, text)
                          }
                        />
                      </View>
                    ))}
                    <Text style={styles.manualHint}>
                      {t(
                        "Tap 1-4 to choose the correct option.",
                        "1〜4をタップして正解の選択肢を選びます。"
                      )}
                    </Text>
                  </View>
                ) : (q.question_type || "text_input") === "true_false" ? (
                  <View style={styles.manualGroup}>
                    <Text style={styles.manualFieldLabel}>
                      {t("Correct Answer", "正解")}
                    </Text>
                    <View style={styles.manualChipRow}>
                      {([
                        { key: "true", label: "True" },
                        { key: "false", label: "False" },
                      ] as const).map((answerOption) => (
                        <TouchableOpacity
                          key={answerOption.key}
                          style={[
                            styles.manualChip,
                            q.answer === answerOption.key && styles.manualChipActive,
                          ]}
                          onPress={() => updateQuestion(index, "answer", answerOption.key)}
                        >
                          <Text
                            style={[
                              styles.manualChipText,
                              q.answer === answerOption.key &&
                                styles.manualChipTextActive,
                            ]}
                          >
                            {answerOption.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={t("Answer", "答え")}
                    placeholderTextColor="#999"
                    value={q.answer}
                    onChangeText={(text) => updateQuestion(index, "answer", text)}
                    multiline
                  />
                )}

                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t("Explanation (optional)", "解説 (任意)")}
                  placeholderTextColor="#999"
                  value={q.explanation || ""}
                  onChangeText={(text) => updateQuestion(index, "explanation", text)}
                  multiline
                />

                <View style={styles.categoryHelpBox}>
                  <Text style={styles.categoryHelpText}>
                    {t(
                      "Category = broad subject. Subcategory 1 = chapter or unit. Subcategory 2 = narrower topic, pattern, or viewpoint.",
                      "カテゴリ = 大きな分野。サブカテゴリ1 = 単元や章。サブカテゴリ2 = さらに細かい論点・出題パターン・観点です。"
                    )}
                  </Text>
                </View>

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

        {/* ----- Image OCR ----- */}
        {inputMode === "image" && (
          <View>
            <Text style={styles.sectionDesc}>
              {t(
                "AI reads your image and automatically generates quiz questions.",
                "AIが画像を読み取り、クイズ問題を自動生成します。"
              )}
            </Text>

            {!imageQuestions && !imageGenerating && (
              <View style={{ gap: 10 }}>
                <TouchableOpacity style={styles.createButton} onPress={handlePickImageForGeneration}>
                  <Text style={styles.createButtonText}>{t("Select Image from Library", "ライブラリから画像を選択")}</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && ImagePicker && (
                  <TouchableOpacity style={[styles.createButton, { backgroundColor: "#34C759" }]} onPress={handleCameraForGeneration}>
                    <Text style={styles.createButtonText}>{t("Take Photo with Camera", "カメラで撮影")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {imageGenerating && (
              <View style={styles.progressBox}>
                <ActivityIndicator color="#007AFF" size="large" />
                <Text style={styles.progressText}>{t("Analyzing image and generating questions...", "画像を分析して問題を生成中...")}</Text>
              </View>
            )}

            {imageQuestions && (
              <View>
                <Text style={styles.previewTitle}>
                  {t(`${imageQuestions.length} question(s) generated`, `${imageQuestions.length}問が生成されました`)}
                </Text>
                {imageQuestions.map((q, i) => (
                  <View key={i} style={styles.previewItem}>
                    <Text style={styles.previewBadge}>
                      {q.question_type === "multiple_choice" ? t("MC", "選択") : q.question_type === "true_false" ? t("TF", "正誤") : t("Text", "記述")}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={styles.previewQ}>{q.question}</Text>
                      <Text style={styles.previewA}>
                        {t("Answer", "答え")}: {getMultipleChoiceAnswerText(q.answer, q.options)}
                      </Text>
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={() => setImageQuestions(null)}>
                  <Text style={styles.addButtonText}>{t("Try Again", "やり直す")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ----- Anki Import ----- */}
        {inputMode === "anki" && (
          <View>
            <Text style={styles.sectionDesc}>
              {t(
                "Import an Anki .apkg file. All cards including media will be converted to local questions.",
                "Ankiの.apkgファイルをインポートします。メディアを含む全カードがローカル問題に変換されます。"
              )}
            </Text>

            {!ankiQuestions && !ankiParsing && (
              <TouchableOpacity style={styles.createButton} onPress={handlePickAnkiFile}>
                <Text style={styles.createButtonText}>{t("Select .apkg File", ".apkgファイルを選択")}</Text>
              </TouchableOpacity>
            )}

            {ankiParsing && (
              <View style={styles.progressBox}>
                <ActivityIndicator color="#8E44AD" size="large" />
                <Text style={styles.progressText}>{t("Parsing Anki deck...", "Ankiデッキを解析中...")}</Text>
              </View>
            )}

            {ankiQuestions && (
              <View>
                <Text style={styles.previewTitle}>
                  {ankiDeckTitle} — {t(`${ankiQuestions.length} card(s)`, `${ankiQuestions.length}枚のカード`)}
                </Text>
                {ankiQuestions.slice(0, 10).map((q, i) => (
                  <View key={i} style={styles.previewItem}>
                    <Text style={styles.previewBadge}>
                      {q.question_type === "multiple_choice" ? t("MC", "選択") : q.question_type === "true_false" ? t("TF", "正誤") : t("Text", "記述")}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.previewQ}>{q.question}</Text>
                      <Text numberOfLines={1} style={styles.previewA}>
                        {getMultipleChoiceAnswerText(q.answer, q.options)}
                      </Text>
                    </View>
                  </View>
                ))}
                {ankiQuestions.length > 10 && (
                  <Text style={styles.moreText}>
                    {t(`... and ${ankiQuestions.length - 10} more`, `... 他${ankiQuestions.length - 10}枚`)}
                  </Text>
                )}
                <TouchableOpacity style={styles.addButton} onPress={() => { setAnkiQuestions(null); setAnkiDeckTitle(""); }}>
                  <Text style={styles.addButtonText}>{t("Select Different File", "別のファイルを選択")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ----- AI Text Generation ----- */}
        {inputMode === "ai_text" && (
          <View>
            <Text style={styles.sectionDesc}>
              {t(
                "Paste text from a textbook, notes, or article. AI will automatically generate quiz questions including multiple-choice.",
                "教科書・ノート・記事などのテキストを貼り付けてください。AIが多肢選択を含む問題を一括自動生成します。"
              )}
            </Text>

            <TextInput
              style={[styles.input, { height: 200, textAlignVertical: "top" }]}
              placeholder={t(
                "Paste your text here...",
                "テキストをここに貼り付け..."
              )}
              placeholderTextColor="#999"
              value={aiTextInput}
              onChangeText={setAiTextInput}
              multiline
            />

            {!aiTextQuestions && !aiTextGenerating && (
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: "#5856D6" }]}
                onPress={handleGenerateFromText}
                disabled={aiTextInput.trim().length < 10}
              >
                <Text style={styles.createButtonText}>
                  {t("Generate Questions with AI", "AIで問題を生成")}
                </Text>
              </TouchableOpacity>
            )}

            {aiTextGenerating && (
              <View style={styles.progressBox}>
                <ActivityIndicator color="#5856D6" size="large" />
                <Text style={styles.progressText}>
                  {t("Analyzing text and generating questions...", "テキストを分析して問題を生成中...")}
                </Text>
              </View>
            )}

            {aiTextQuestions && (
              <View>
                <Text style={styles.previewTitle}>
                  {t(`${aiTextQuestions.length} question(s) generated`, `${aiTextQuestions.length}問が生成されました`)}
                </Text>
                {aiTextQuestions.map((q, i) => (
                  <View key={i} style={styles.previewItem}>
                    <Text style={styles.previewBadge}>
                      {q.question_type === "multiple_choice"
                        ? t("MC", "選択")
                        : q.question_type === "true_false"
                        ? t("TF", "正誤")
                        : t("Text", "記述")}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={styles.previewQ}>{q.question}</Text>
                      <Text style={styles.previewA}>
                        {t("Answer", "答え")}: {getMultipleChoiceAnswerText(q.answer, q.options)}
                      </Text>
                      {q.options && q.options.length > 0 && (
                        <Text style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                          {q.options.join(" / ")}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addButton} onPress={() => setAiTextQuestions(null)}>
                  <Text style={styles.addButtonText}>{t("Try Again", "やり直す")}</Text>
                </TouchableOpacity>
              </View>
            )}
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
  featureBanner: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E0E6ED",
    ...platformShadow({ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }),
    elevation: 2,
  },
  featureBannerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  featureBannerSub: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  featureChips: {
    gap: 8,
  },
  featureChipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  featureChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  featureChipLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  featureHelpBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureHelpBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  featureDetail: {
    marginTop: 2,
    marginBottom: 4,
    marginLeft: 18,
    paddingLeft: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
  },
  featureDetailText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
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
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
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
  manualFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  manualChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  manualChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D6DDE6",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  manualChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  manualChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  manualChipTextActive: {
    color: "#fff",
  },
  manualGroup: {
    marginBottom: 12,
  },
  manualOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manualAnswerPicker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6DDE6",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  manualAnswerPickerActive: {
    backgroundColor: "#34C759",
    borderColor: "#34C759",
  },
  manualAnswerPickerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  manualAnswerPickerTextActive: {
    color: "#fff",
  },
  manualOptionInput: {
    flex: 1,
    marginBottom: 8,
  },
  manualHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    marginTop: -2,
  },
  categoryHelpBox: {
    backgroundColor: "#F4F7FB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E6ED",
    padding: 10,
    marginBottom: 12,
  },
  categoryHelpText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#5A6472",
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
  tabDivider: {
    width: 1,
    backgroundColor: "#007AFF",
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
    paddingVertical: 6,
    maxWidth: 200,
  },
  csvPromptBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
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
  csvFormatText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 18,
    marginBottom: 4,
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
  sectionDesc: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 14,
  },
  progressBox: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: "#666",
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  previewBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "#007AFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  previewQ: {
    fontSize: 13,
    color: "#333",
  },
  previewA: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  moreText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    paddingVertical: 10,
    fontStyle: "italic",
  },
});
