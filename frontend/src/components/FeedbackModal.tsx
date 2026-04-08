import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useLanguage } from "../contexts/LanguageContext";
import { feedbackApi, FeedbackCategory } from "../api/feedback";
import AppModal from "./Modal";
import { getApiErrorMessage } from "../utils/apiError";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: { value: FeedbackCategory; labelEn: string; labelJa: string }[] = [
  { value: "app_review", labelEn: "App Review", labelJa: "アプリのレビュー" },
  { value: "feature_request", labelEn: "Feature Request", labelJa: "機能リクエスト" },
  { value: "question_set_feedback", labelEn: "Question Set Feedback", labelJa: "問題集フィードバック" },
  { value: "bug_report", labelEn: "Bug Report", labelJa: "不具合" },
  { value: "complaint", labelEn: "Complaint", labelJa: "不満" },
];

export default function FeedbackModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const [category, setCategory] = useState<FeedbackCategory>("app_review");
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [questionSetTitle, setQuestionSetTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({ visible: false, title: "", message: "" });

  const resetForm = () => {
    setCategory("app_review");
    setRating(0);
    setMessage("");
    setQuestionSetTitle("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setResultModal({
        visible: true,
        title: t("Error", "エラー"),
        message: t("Please enter a message", "メッセージを入力してください"),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await feedbackApi.submit({
        category,
        rating: rating > 0 ? rating : undefined,
        message: message.trim(),
        question_set_title: questionSetTitle.trim() || undefined,
      });
      setResultModal({
        visible: true,
        title: t("Thank you!", "ありがとうございます！"),
        message: t(
          "Your feedback has been sent. We appreciate your input!",
          "フィードバックを送信しました。ご意見ありがとうございます！"
        ),
        onOk: handleClose,
      });
    } catch (error: any) {
      const detail = getApiErrorMessage(
        error,
        "Failed to send feedback. Please try again later.",
        "フィードバックの送信に失敗しました。しばらくしてからお試しください。"
      );
      setResultModal({
        visible: true,
        title: t("Error", "エラー"),
        message: detail,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => setRating(star)}
          style={styles.starButton}
          testID={`feedback-star-${star}`}
        >
          <Text style={[styles.starText, star <= rating && styles.starFilled]}>
            {star <= rating ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={[styles.container, { maxWidth: isSmallScreen ? "100%" : 500 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {t("Review & Feedback", "レビュー・ご要望")}
            </Text>
            <Text style={styles.subtitle}>
              {t(
                "Your feedback helps us improve the app",
                "皆様のご意見がアプリ改善に繋がります"
              )}
            </Text>

            {/* カテゴリ選択 */}
            <Text style={styles.sectionLabel}>
              {t("Category", "カテゴリ")}
            </Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    category === cat.value && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat.value)}
                  testID={`feedback-category-${cat.value}`}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.value && styles.categoryChipTextActive,
                    ]}
                  >
                    {t(cat.labelEn, cat.labelJa)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 星評価（レビューの場合のみ） */}
            {category === "app_review" && (
              <View style={styles.ratingSection}>
                <Text style={styles.sectionLabel}>
                  {t("Rating (optional)", "評価（任意）")}
                </Text>
                {renderStars()}
              </View>
            )}

            {/* 問題集名（問題集フィードバックの場合のみ） */}
            {category === "question_set_feedback" && (
              <View>
                <Text style={styles.sectionLabel}>
                  {t("Question Set Name (optional)", "問題集名（任意）")}
                </Text>
                <TextInput
                  style={styles.textInputSingle}
                  placeholder={t("Enter question set name", "問題集名を入力")}
                  value={questionSetTitle}
                  onChangeText={setQuestionSetTitle}
                  maxLength={200}
                  testID="feedback-question-set-title"
                />
              </View>
            )}

            {/* メッセージ */}
            <Text style={styles.sectionLabel}>
              {t("Message", "メッセージ")} *
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={
                category === "feature_request"
                  ? t(
                      "Describe the feature you'd like to see",
                      "追加してほしい機能を教えてください"
                    )
                  : category === "bug_report"
                  ? t(
                      "Tell us what happened, how to reproduce, and your device/environment",
                      "発生したこと・再現手順・端末/環境などを教えてください"
                    )
                  : category === "complaint"
                  ? t(
                      "Tell us what's frustrating and what you'd like improved",
                      "不満点と、どう改善してほしいかを教えてください"
                    )
                  : category === "question_set_feedback"
                  ? t(
                      "Share your feedback about the question set",
                      "問題集についてのご意見をお聞かせください"
                    )
                  : t(
                      "Share your thoughts about the app",
                      "アプリについてのご感想をお聞かせください"
                    )
              }
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              testID="feedback-message"
            />
            <Text style={styles.charCount}>{message.length}/2000</Text>

            {/* ボタン */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isSubmitting}
                testID="feedback-cancel"
              >
                <Text style={styles.cancelText}>
                  {t("Cancel", "キャンセル")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (isSubmitting || !message.trim()) && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || !message.trim()}
                testID="feedback-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {t("Send", "送信")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AppModal
        visible={resultModal.visible}
        title={resultModal.title}
        message={resultModal.message}
        onClose={() => {
          const onOk = resultModal.onOk;
          setResultModal({ visible: false, title: "", message: "" });
          onOk?.();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "85%",
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  categoryChipActive: {
    backgroundColor: "#007AFF",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007AFF",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  ratingSection: {
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  starText: {
    fontSize: 32,
    color: "#ccc",
  },
  starFilled: {
    color: "#FFB800",
  },
  textInputSingle: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 4,
    backgroundColor: "#fafafa",
  },
  charCount: {
    fontSize: 11,
    color: "#999",
    textAlign: "right",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  submitText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
