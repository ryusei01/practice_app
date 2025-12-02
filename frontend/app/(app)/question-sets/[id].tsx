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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { questionSetsApi, QuestionSet } from "../../../src/api/questionSets";
import { questionsApi, Question } from "../../../src/api/questions";
import Modal from "../../../src/components/Modal";

export default function QuestionSetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  // モーダル用のstate
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }>({
    title: '',
    message: '',
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
      style?: 'default' | 'cancel' | 'destructive';
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
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load question set");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleAddQuestion = () => {
    router.push(`/(app)/question-sets/${id}/add-question`);
  };

  const handleStartQuiz = () => {
    if (questions.length === 0) {
      Alert.alert(
        "No Questions",
        "Please add questions before starting the quiz"
      );
      return;
    }
    router.push(`/(app)/quiz/${id}`);
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
    const helpMessage = `CSV Format Guide:

Required Fields:
• question_text (required)
• correct_answer (required)

Optional Fields:
• question_type (default: text_input)
  Options: multiple_choice, true_false, text_input
• options (for multiple_choice, comma-separated)
• explanation
• difficulty (0.0 to 1.0, default: 0.5)
• category

Example CSV:
question_text,question_type,options,correct_answer,explanation,difficulty,category
"What is 2+2?",multiple_choice,"2,3,4,5",4,"Basic addition",0.2,math
"The sky is blue",true_false,,true,"Common knowledge",0.1,general
"Capital of France?",text_input,,Paris,"Paris is the capital",0.3,geography

Important Notes:
• Save file as UTF-8 encoding
• Use double quotes for fields containing commas
• First row must be the header row`;

    showModal("CSV Format Help", helpMessage, [{ text: "OK" }]);
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
        "Upload CSV",
        `Selected: ${file.name}\n\nUpload this file?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upload",
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
                        .map((err) => (typeof err === 'string' ? err : JSON.stringify(err)))
                        .join("\n")
                    : "Unknown errors occurred";

                  showModal(
                    "Upload Complete with Errors",
                    `Created: ${response.total_created} questions\nErrors: ${response.total_errors}\n\n${errorMessages}`,
                    [{ text: "OK", onPress: () => loadData() }]
                  );
                } else {
                  showModal(
                    "Success",
                    `Successfully imported ${response.total_created} questions`,
                    [{ text: "OK", onPress: () => loadData() }]
                  );
                }
              } catch (error: any) {
                console.error("Failed to upload CSV:", error);

                // エラーメッセージを安全に取得
                let errorMessage = "Failed to upload CSV";
                if (error.response?.data?.detail) {
                  if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                  } else if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail
                      .map((err: any) => err.msg || JSON.stringify(err))
                      .join("\n");
                  } else {
                    errorMessage = JSON.stringify(error.response.data.detail);
                  }
                }

                showModal(
                  "Error",
                  errorMessage,
                  [{ text: "OK" }]
                );
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
  }) => (
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
    </View>
  );

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

  return (
    <View style={styles.container}>
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
            <Text style={styles.startQuizButtonText}>Start Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddQuestion}>
            <Text style={styles.addButtonText}>Add Question</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.uploadCSVButton}
            onPress={handleUploadCSV}
          >
            <Text style={styles.uploadCSVButtonText}>Upload CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={handleShowCSVHelp}
          >
            <Text style={styles.helpButtonText}>CSV Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteSet}>
            <Text style={styles.deleteButtonText}>Delete</Text>
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
    marginBottom: 12,
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
});
