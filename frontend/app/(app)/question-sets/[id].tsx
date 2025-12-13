import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  TextInput,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { questionSetsApi, QuestionSet } from "../../../src/api/questionSets";
import { questionsApi, Question } from "../../../src/api/questions";
import Modal from "../../../src/components/Modal";

// 問題ごとの回答統計
interface QuestionStats {
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  lastAnsweredAt: string | null;
}

export default function QuestionSetDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { t } = useTranslation();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [setupMode, setSetupMode] = useState(mode === "setup");
  const [setupStep, setSetupStep] = useState(1);
  const router = useRouter();
  const [questionStats, setQuestionStats] = useState<Map<string, QuestionStats>>(new Map());

  // 問題選択モーダル用のstate
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"all" | "ai" | "range">("all");
  const [questionCount, setQuestionCount] = useState(10); // 初期値10問
  const [rangeStart, setRangeStart] = useState(0);

  // モーダル用のstate
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>;
  }>({
    title: "",
    message: "",
    buttons: [],
  });

  useEffect(() => {
    loadData();
  }, [id]);

  // モーダルを表示するヘルパー関数
  const showModal = (
    title: string,
    message: string,
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>
  ) => {
    setModalConfig({ title, message, buttons });
    setModalVisible(true);
  };

  const loadData = async () => {
    try {
      const [setData, questionsData] = await Promise.all([
        questionSetsApi.getById(id),
        questionsApi.getAll({ question_set_id: id }),
      ]);
      setQuestionSet(setData);
      setQuestions(questionsData);

      // 回答データを読み込み
      await loadAnswerStats();
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load question set");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadAnswerStats = async () => {
    try {
      const storageKey = `@flashcard_answers_${id}`;
      const answersData = await AsyncStorage.getItem(storageKey);

      if (!answersData) {
        return;
      }

      const answers = JSON.parse(answersData);
      const statsMap = new Map<string, QuestionStats>();

      // 各問題の統計を計算
      answers.forEach((answer: any) => {
        const questionId = answer.question_id;
        const existing = statsMap.get(questionId) || {
          totalAttempts: 0,
          correctCount: 0,
          accuracy: 0,
          lastAnsweredAt: null,
        };

        existing.totalAttempts += 1;
        if (answer.is_correct) {
          existing.correctCount += 1;
        }
        existing.accuracy = (existing.correctCount / existing.totalAttempts) * 100;

        // 最新の回答日時を更新
        if (!existing.lastAnsweredAt || answer.answered_at > existing.lastAnsweredAt) {
          existing.lastAnsweredAt = answer.answered_at;
        }

        statsMap.set(questionId, existing);
      });

      setQuestionStats(statsMap);
    } catch (error) {
      console.error("Failed to load answer stats:", error);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleAddQuestion = () => {
    router.push(`/(app)/question-sets/${id}/add-question`);
  };

  const handleEditQuestionSet = () => {
    router.push(`/(app)/question-sets/edit?id=${id}`);
    if (setupMode && setupStep === 2) {
      setSetupStep(3);
    }
  };

  const handleStartQuiz = () => {
    if (questions.length === 0) {
      Alert.alert(
        "No Questions",
        "Please add questions before starting the quiz"
      );
      return;
    }
    setSelectionModalVisible(true);
  };

  const handleStartQuizWithSelection = async () => {
    try {
      setSelectionModalVisible(false);
      setIsLoading(true);

      let selectedQuestions: Question[];

      if (selectionMode === "all") {
        selectedQuestions = questions;
      } else if (selectionMode === "ai") {
        selectedQuestions = await questionsApi.selectQuestionsByAI(id, questionCount);
      } else {
        selectedQuestions = await questionsApi.selectQuestionsByRange(id, rangeStart, questionCount);
      }

      if (selectedQuestions.length === 0) {
        Alert.alert(
          t("common.error"),
          t("No questions match your selection", "選択条件に一致する問題がありません")
        );
        setIsLoading(false);
        return;
      }

      // 選択した問題IDをクエリパラメータで渡す
      const questionIds = selectedQuestions.map(q => q.id).join(',');
      router.push(`/(app)/quiz/${id}?questionIds=${questionIds}`);
    } catch (error) {
      console.error("Failed to select questions:", error);
      Alert.alert(
        t("common.error"),
        t("Failed to select questions", "問題の選択に失敗しました")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFlashcard = () => {
    if (questions.length === 0) {
      Alert.alert(
        t("No Questions", "問題がありません"),
        t(
          "Please add questions before starting flashcard mode",
          "フラッシュカードモードを開始する前に問題を追加してください"
        )
      );
      return;
    }
    router.push(`/(app)/flashcard/${id}`);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert(
      "Delete Question",
      "Are you sure you want to delete this question?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await questionsApi.delete(questionId);
              setQuestions(questions.filter((q) => q.id !== questionId));
              Alert.alert("Success", "Question deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete question");
            }
          },
        },
      ]
    );
  };

  const handleDeleteSet = async () => {
    Alert.alert(
      "Delete Question Set",
      "Are you sure? This will delete all questions in this set.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await questionSetsApi.delete(id);
              Alert.alert("Success", "Question set deleted", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert("Error", "Failed to delete question set");
            }
          },
        },
      ]
    );
  };

  const handleShowCSVHelp = () => {
    const helpMessage = `${t("csv.formatHelp")}:

${t("csv.requiredFields")}:
• ${t("csv.questionText")}
• ${t("csv.correctAnswer")}

${t("csv.optionalFields")}:
• ${t("csv.questionType")}
  ${t("csv.questionTypeOptions")}
• ${t("csv.options")}
• ${t("csv.explanation")}
• ${t("csv.difficulty")}
• ${t("csv.category")}
• subcategory1 (${t("csv.subcategory1")})
• subcategory2 (${t("csv.subcategory2")})

${t("csv.exampleCSV")}:
question_text,question_type,options,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
"What is 2+2?",multiple_choice,"2,3,4,5",4,"Basic addition",0.2,math,arithmetic,addition
"The sky is blue",true_false,,true,"Common knowledge",0.1,general,nature,sky
"Capital of France?",text_input,,Paris,"Paris is the capital",0.3,geography,europe,capitals

${t("csv.importantNotes")}:
• ${t("csv.note1")}
• ${t("csv.note2")}
• ${t("csv.note3")}`;

    showModal(t("csv.formatHelp"), helpMessage, [{ text: t("common.ok") }]);
  };

  const handleUploadCSV = async () => {
    try {
      console.log("Opening document picker...");
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true,
      });

      console.log("Document picker result:", result);

      if (result.canceled) {
        console.log("Document picker was canceled");
        return;
      }

      const file = result.assets[0];
      console.log("Selected file:", file);

      // カスタムモーダルで確認
      showModal(
        t("questionSets.uploadCSV"),
        t("csv.uploadConfirm", { fileName: file.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.upload"),
            onPress: async () => {
              try {
                setIsLoading(true);
                const response = await questionsApi.bulkUploadCSV(id, {
                  uri: file.uri,
                  name: file.name,
                  type: file.mimeType || "text/csv",
                });

                if (response.total_errors > 0) {
                  // エラーメッセージを安全に文字列化
                  const errorMessages = response.errors
                    ? response.errors
                        .slice(0, 3)
                        .map((err) =>
                          typeof err === "string" ? err : JSON.stringify(err)
                        )
                        .join("\n")
                    : "Unknown errors occurred";

                  showModal(
                    t("csv.uploadWithErrors"),
                    `${t("csv.createdQuestions", {
                      count: response.total_created,
                    })}\n${t("csv.errors", {
                      count: response.total_errors,
                    })}\n\n${errorMessages}`,
                    [{ text: t("common.ok"), onPress: () => loadData() }]
                  );
                } else {
                  showModal(
                    t("common.success"),
                    t("csv.uploadSuccess", { count: response.total_created }),
                    [
                      {
                        text: t("common.ok"),
                        onPress: () => {
                          loadData();
                          if (setupMode && setupStep === 1) {
                            setSetupStep(2);
                          }
                        },
                      },
                    ]
                  );
                }
              } catch (error: any) {
                console.error("Failed to upload CSV:", error);

                // エラーメッセージを安全に取得
                let errorMessage = t("csv.uploadError");
                if (error.response?.data?.detail) {
                  if (typeof error.response.data.detail === "string") {
                    errorMessage = error.response.data.detail;
                  } else if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail
                      .map((err: any) => err.msg || JSON.stringify(err))
                      .join("\n");
                  } else {
                    errorMessage = JSON.stringify(error.response.data.detail);
                  }
                }

                showModal(t("common.error"), errorMessage, [
                  { text: t("common.ok") },
                ]);
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Failed to pick document:", error);
      Alert.alert("Error", "Failed to select file");
    }
  };

  const renderQuestion = ({
    item,
    index,
  }: {
    item: Question;
    index: number;
  }) => {
    const stats = questionStats.get(item.id);

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>Q{index + 1}</Text>
          <TouchableOpacity onPress={() => handleDeleteQuestion(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.questionText}>{item.question_text}</Text>
        <View style={styles.questionFooter}>
          <Text style={styles.questionType}>{item.question_type}</Text>
          <Text style={styles.difficulty}>
            Difficulty: {(item.difficulty * 100).toFixed(0)}%
          </Text>
        </View>

        {/* 回答統計を表示 */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("Accuracy", "正解率")}:</Text>
              <Text
                style={[
                  styles.statValue,
                  stats.accuracy >= 80
                    ? styles.statGood
                    : stats.accuracy >= 50
                    ? styles.statMedium
                    : styles.statPoor,
                ]}
              >
                {stats.accuracy.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t("Attempts", "回答数")}:</Text>
              <Text style={styles.statValue}>
                {stats.correctCount}/{stats.totalAttempts}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!questionSet) {
    return (
      <View style={styles.centerContainer}>
        <Text>Question set not found</Text>
      </View>
    );
  }

  const downloadCSVSample = () => {
    console.log("downloadCSVSample called");

    const csvSample = `question_text,question_type,options,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
What is 2 + 2?,multiple_choice,"2,3,4,5",4,Basic addition,0.1,math,arithmetic,addition
Is the sky blue?,true_false,,true,The sky appears blue due to Rayleigh scattering,0.1,science,physics,light
What is the capital of Japan?,text_input,,Tokyo,Japan's capital is Tokyo,0.3,geography,asia,capitals
What is the largest planet in our solar system?,text_input,,Jupiter,Jupiter is the largest planet,0.4,science,astronomy,planets`;

    const title = t("CSV Sample Format", "CSVサンプル形式");
    const message = `CSV format:
question_text,correct_answer,category,difficulty`;
    if (Platform.OS === "web") {
      // Web はブラウザダウンロード
      const blob = new Blob([csvSample], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample.csv";
      a.click();
      URL.revokeObjectURL(url);
      return;
    } else {
      const path = FileSystem.documentDirectory + "words.csv";
      FileSystem.writeAsStringAsync(path + "csv_sample.csv", csvSample, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return path;
    }
  };

  return (
    <View style={styles.container}>
      {setupMode && (
        <View style={styles.setupGuide}>
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>
              {t("Setup Guide", "セットアップガイド")}
            </Text>
            <TouchableOpacity
              onPress={() => setSetupMode(false)}
              style={styles.closeSetupButton}
            >
              <Text style={styles.closeSetupText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.setupSteps}>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 1 && styles.setupStepActive,
                setupStep > 1 && styles.setupStepCompleted,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>
                  {setupStep > 1 ? "✓" : "1"}
                </Text>
              </View>
              <Text style={styles.setupStepText}>
                {t(
                  "Make questions or Upload questions via CSV",
                  "自分で問題を追加するか、CSVで問題をアップロード"
                )}
              </Text>
            </View>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 2 && styles.setupStepActive,
                setupStep > 2 && styles.setupStepCompleted,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>
                  {setupStep > 2 ? "✓" : "2"}
                </Text>
              </View>
              <Text style={styles.setupStepText}>
                {t("Edit title and category", "タイトルとカテゴリを編集")}
              </Text>
            </View>
            <View
              style={[
                styles.setupStepItem,
                setupStep >= 3 && styles.setupStepActive,
              ]}
            >
              <View style={styles.setupStepNumber}>
                <Text style={styles.setupStepNumberText}>3</Text>
              </View>
              <Text style={styles.setupStepText}>
                {t("Add description and details", "説明と詳細を追加")}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>{questionSet.title}</Text>
        {questionSet.description && (
          <Text style={styles.description}>{questionSet.description}</Text>
        )}
        <View style={styles.metadata}>
          <Text style={styles.category}>{questionSet.category}</Text>
          {questionSet.is_published && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Published</Text>
            </View>
          )}
        </View>
        {questionSet.tags && questionSet.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {questionSet.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{questions.length}</Text>
          <Text style={styles.statLabel}>Questions</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>¥{questionSet.price}</Text>
          <Text style={styles.statLabel}>Price</Text>
        </View>
      </View>

      <FlatList
        data={questions}
        renderItem={renderQuestion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No questions yet</Text>
            <Text style={styles.emptySubtext}>Add your first question</Text>
          </View>
        }
      />

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.startQuizButton,
              questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartQuiz}
            disabled={questions.length === 0}
          >
            <Text style={styles.startQuizButtonText}>
              {t("questionSets.startQuiz")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.flashcardButton,
              questions.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleStartFlashcard}
            disabled={questions.length === 0}
          >
            <Text style={styles.flashcardButtonText}>
              📇 {t("Flashcard", "赤シート機能")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddQuestion}
          >
            <Text style={styles.addButtonText}>
              {t("questionSets.addQuestion")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadCSVButton}
            onPress={handleUploadCSV}
          >
            <Text style={styles.uploadCSVButtonText}>
              {t("questionSets.uploadCSV")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={handleShowCSVHelp}
          >
            <Text style={styles.helpButtonText}>
              {t("questionSets.csvHelp")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.csvSampleButton}
            onPress={() => {
              console.log("CSV Sample button pressed");
              downloadCSVSample();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.csvSampleButtonText}>
              📄 {t("CSV Sample", "CSVサンプル")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditQuestionSet}
          >
            <Text style={styles.editButtonText}>
              {t("Edit Details", "詳細を編集")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteSet}
          >
            <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={modalConfig.buttons}
        onClose={() => setModalVisible(false)}
      />

      <Modal
        visible={selectionModalVisible}
        title={t("Select Questions", "問題選択")}
        onClose={() => setSelectionModalVisible(false)}
      >
        <View style={styles.selectionModalContent}>
          <Text style={styles.selectionLabel}>
            {t("Selection Mode", "選択モード")}
          </Text>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "all" && styles.selectionOptionActive,
            ]}
            onPress={() => setSelectionMode("all")}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "all" && styles.selectionOptionTitleActive,
                ]}
              >
                {t("All Questions", "全ての問題")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "Practice all questions in order",
                "全ての問題を順番通りに解く"
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "ai" && styles.selectionOptionActive,
            ]}
            onPress={() => setSelectionMode("ai")}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "ai" && styles.selectionOptionTitleActive,
                ]}
              >
                🤖 {t("AI Selection", "AI選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "AI selects questions based on wrong answers, attempt count, and answer time (default: 10 questions)",
                "AIが間違えた数、出題回数、回答時間から問題を選出（初期値：10問）"
              )}
            </Text>
            {selectionMode === "ai" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {t("Number of questions", "問題数")}:
                </Text>
                <TextInput
                  style={styles.input}
                  value={questionCount.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 10;
                    setQuestionCount(Math.min(Math.max(num, 1), questions.length));
                  }}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionOption,
              selectionMode === "range" && styles.selectionOptionActive,
            ]}
            onPress={() => setSelectionMode("range")}
          >
            <View style={styles.selectionOptionHeader}>
              <Text
                style={[
                  styles.selectionOptionTitle,
                  selectionMode === "range" && styles.selectionOptionTitleActive,
                ]}
              >
                📊 {t("Range Selection", "範囲選出")}
              </Text>
            </View>
            <Text style={styles.selectionOptionDesc}>
              {t(
                "Select questions from a specific range",
                "指定した範囲の問題を選出"
              )}
            </Text>
            {selectionMode === "range" && (
              <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {t("Start from question", "開始問題番号")}:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={rangeStart.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setRangeStart(Math.min(Math.max(num, 0), questions.length - 1));
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {t("Number of questions", "問題数")}:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={questionCount.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 1;
                      setQuestionCount(Math.min(Math.max(num, 1), questions.length - rangeStart));
                    }}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartQuizWithSelection}
          >
            <Text style={styles.startButtonText}>
              {t("Start Quiz", "クイズ開始")}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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
  },
  setupGuide: {
    backgroundColor: "#FFF8E1",
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#FFB300",
  },
  setupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F57C00",
  },
  closeSetupButton: {
    padding: 4,
  },
  closeSetupText: {
    fontSize: 20,
    color: "#F57C00",
    fontWeight: "bold",
  },
  setupSteps: {
    gap: 12,
  },
  setupStepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    opacity: 0.5,
  },
  setupStepActive: {
    opacity: 1,
  },
  setupStepCompleted: {
    opacity: 0.7,
  },
  setupStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE082",
    justifyContent: "center",
    alignItems: "center",
  },
  setupStepNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F57C00",
  },
  setupStepText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  category: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
  },
  deleteText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
  },
  questionText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statGood: {
    color: "#4CAF50",
  },
  statMedium: {
    color: "#FF9800",
  },
  statPoor: {
    color: "#F44336",
  },
  questionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  questionType: {
    fontSize: 14,
    color: "#666",
  },
  difficulty: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  startQuizButton: {
    flex: 1,
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  startQuizButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  flashcardButton: {
    flex: 1,
    backgroundColor: "#ff1d69ff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  flashcardButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  addButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  uploadCSVButton: {
    flex: 2,
    backgroundColor: "#FF9500",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  uploadCSVButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  helpButton: {
    flex: 1,
    backgroundColor: "#5856D6",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  helpButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  csvSampleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  csvSampleButton: {
    backgroundColor: "#d4d229ff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editButton: {
    flex: 2,
    backgroundColor: "#5AC8FA",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  selectionModalContent: {
    paddingVertical: 16,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  selectionOption: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectionOptionActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#007AFF",
  },
  selectionOptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  selectionOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  selectionOptionTitleActive: {
    color: "#007AFF",
  },
  selectionOptionDesc: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  inputContainer: {
    marginTop: 12,
    gap: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  startButton: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
