import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { platformShadow } from "@/src/styles/platformShadow";
import { useLanguage } from "../contexts/LanguageContext";
import { questionsApi, type MediaItem } from "../api/questions";
import { getTextbookApiOrigin } from "../services/textbookService";
import MediaAttachment from "./MediaAttachment";

type QuestionType = "multiple_choice" | "true_false" | "text_input";

const OPTION_PATTERN = /^([A-Ha-h])[)）]\s*(.+)$/;
const ANSWER_PREFIX_PATTERN = /^(?:答え|answer|ans|正解|correct)[：:\s]\s*(.+)$/i;

interface ParsedQuestion {
  question_text: string;
  correct_answer: string;
  question_type: QuestionType;
  options?: string[];
}

function parseBulkText(text: string): ParsedQuestion[] {
  const blocks = text.split(/\n---\n|\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
  const results: ParsedQuestion[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) continue;
    const optionLines: { label: string; text: string }[] = [];
    let answerLine: string | null = null;
    for (let i = 1; i < lines.length; i++) {
      const optMatch = lines[i].match(OPTION_PATTERN);
      const ansMatch = lines[i].match(ANSWER_PREFIX_PATTERN);
      if (ansMatch) { answerLine = ansMatch[1].trim(); }
      else if (optMatch) { optionLines.push({ label: optMatch[1].toUpperCase(), text: optMatch[2].trim() }); }
    }
    if (optionLines.length >= 2 && answerLine) {
      const options = optionLines.map(o => o.text);
      const answerByLabel = optionLines.find(o => o.label === answerLine!.toUpperCase());
      const answerIndex = answerByLabel
        ? optionLines.findIndex((o) => o.label === answerByLabel.label)
        : -1;
      results.push({
        question_text: lines[0],
        correct_answer: answerIndex >= 0 ? String(answerIndex + 1) : answerLine,
        question_type: "multiple_choice",
        options,
      });
    } else if (answerLine && /^(true|false)$/i.test(answerLine)) {
      results.push({ question_text: lines[0], correct_answer: answerLine.toLowerCase(), question_type: "true_false" });
    } else {
      results.push({ question_text: lines[0], correct_answer: answerLine || lines[1], question_type: "text_input" });
    }
  }
  return results;
}

interface AddQuestionInlineProps {
  questionSetId: string;
  onQuestionAdded?: () => void;
}

type InlineTab = "single" | "bulk";

export default function AddQuestionInline({ questionSetId, onQuestionAdded }: AddQuestionInlineProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<InlineTab>("single");

  // Single mode
  const [qType, setQType] = useState<QuestionType>("text_input");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [correctAnswerText, setCorrectAnswerText] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk mode
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [lastSavedQuestionId, setLastSavedQuestionId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  const resetSingle = useCallback(() => {
    setQuestionText("");
    setOptions(["", ""]);
    setCorrectIndex(null);
    setCorrectAnswerText("");
  }, []);

  const handleSaveSingle = async () => {
    if (!questionText.trim()) return;
    let payload: any = { question_set_id: questionSetId, question_text: questionText.trim(), question_type: qType, difficulty: 0.5 };
    if (qType === "multiple_choice") {
      const validOpts = options.filter(o => o.trim());
      if (validOpts.length < 2 || correctIndex === null) return;
      payload.options = validOpts;
      payload.correct_answer = String(correctIndex + 1);
    } else if (qType === "true_false") {
      if (!correctAnswerText) return;
      payload.correct_answer = correctAnswerText;
      payload.options = [t("True", "正しい"), t("False", "誤り")];
    } else {
      if (!correctAnswerText.trim()) return;
      payload.correct_answer = correctAnswerText.trim();
    }
    setSaving(true);
    try {
      const created = await questionsApi.create(payload);
      setLastSavedQuestionId(created.id);
      setMediaItems(created.media_urls || []);
      resetSingle();
      onQuestionAdded?.();
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const handleMediaUpload = async (
    file: { uri: string; name: string; type: string },
    position: "question" | "answer"
  ) => {
    if (!lastSavedQuestionId) {
      Alert.alert(
        t("Info", "情報"),
        t("Save the question first, then attach media.", "先に問題を保存してからメディアを添付してください。")
      );
      return;
    }
    const result = await questionsApi.uploadMedia(lastSavedQuestionId, file, position);
    setMediaItems(result.media_urls);
  };

  const handleMediaDelete = async (index: number) => {
    if (!lastSavedQuestionId) return;
    const result = await questionsApi.deleteMedia(lastSavedQuestionId, index);
    setMediaItems(result.media_urls || []);
  };

  const handleBulkPreview = () => {
    const p = parseBulkText(bulkText);
    if (p.length === 0) { Alert.alert(t("Error", "エラー"), t("No questions found", "問題が見つかりません")); return; }
    setParsed(p);
  };

  const handleBulkSave = async () => {
    if (!parsed) return;
    setBulkSaving(true);
    setBulkProgress(0);
    let ok = 0;
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      try {
        await questionsApi.create({ question_set_id: questionSetId, question_text: q.question_text, question_type: q.question_type, correct_answer: q.correct_answer, options: q.options, difficulty: 0.5 });
        ok++;
      } catch { /* skip */ }
      setBulkProgress(i + 1);
    }
    setBulkSaving(false);
    setParsed(null);
    setBulkText("");
    onQuestionAdded?.();
    Alert.alert(t("Success", "成功"), `${ok}${t(" question(s) added", "問追加しました")}`);
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.addButton} onPress={() => setExpanded(true)}>
        <Text style={styles.addButtonText}>+ {t("Add Questions", "問題を追加")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t("Add Question", "問題を追加")}</Text>
        <TouchableOpacity
          onPress={() => {
            setExpanded(false);
            setParsed(null);
            setLastSavedQuestionId(null);
            setMediaItems([]);
          }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "single" && styles.tabActive]} onPress={() => setTab("single")}>
          <Text style={[styles.tabText, tab === "single" && styles.tabTextActive]}>{t("One by One", "1問ずつ")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "bulk" && styles.tabActive]} onPress={() => setTab("bulk")}>
          <Text style={[styles.tabText, tab === "bulk" && styles.tabTextActive]}>{t("Bulk", "まとめて")}</Text>
        </TouchableOpacity>
      </View>

      {tab === "single" ? (
        <View>
          {/* Type selector */}
          <View style={styles.typeRow}>
            {(["text_input", "multiple_choice", "true_false"] as const).map(type => (
              <TouchableOpacity key={type} style={[styles.typeBtn, qType === type && styles.typeBtnActive]} onPress={() => { setQType(type); resetSingle(); }}>
                <Text style={[styles.typeBtnText, qType === type && styles.typeBtnTextActive]}>
                  {type === "text_input" ? t("Text", "記述") : type === "multiple_choice" ? t("MC", "選択") : t("TF", "正誤")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={questionText} onChangeText={setQuestionText} placeholder={t("Question", "問題文")} multiline editable={!saving} />
          {qType === "multiple_choice" && (
            <>
              {options.map((o, i) => (
                <View key={i} style={styles.optRow}>
                  <TouchableOpacity style={[styles.radio, correctIndex === i && styles.radioActive]} onPress={() => setCorrectIndex(i)}>
                    <Text style={styles.radioText}>{String.fromCharCode(65 + i)}</Text>
                  </TouchableOpacity>
                  <TextInput style={styles.optInput} value={o} onChangeText={v => { const n = [...options]; n[i] = v; setOptions(n); }} placeholder={`${t("Option", "選択肢")} ${String.fromCharCode(65 + i)}`} editable={!saving} />
                </View>
              ))}
              {options.length < 6 && (
                <TouchableOpacity onPress={() => setOptions([...options, ""])} style={styles.addOptBtn}>
                  <Text style={styles.addOptText}>+ {t("Add Option", "選択肢追加")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {qType === "true_false" && (
            <View style={styles.tfRow}>
              {["true", "false"].map(v => (
                <TouchableOpacity key={v} style={[styles.tfBtn, correctAnswerText === v && styles.tfBtnActive]} onPress={() => setCorrectAnswerText(v)}>
                  <Text style={[styles.tfBtnText, correctAnswerText === v && styles.tfBtnTextActive]}>{v === "true" ? t("True", "正しい") : t("False", "誤り")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {qType === "text_input" && (
            <TextInput style={styles.input} value={correctAnswerText} onChangeText={setCorrectAnswerText} placeholder={t("Correct answer", "正解")} editable={!saving} />
          )}
          <Text style={styles.mediaLabel}>{t("Images & Audio (optional)", "画像・音声（任意）")}</Text>
          <Text style={styles.mediaHint}>
            {lastSavedQuestionId
              ? t(
                  "Attach images or audio to the question you just saved. You can add more questions below after attaching.",
                  "直前に保存した問題に画像・音声を添付できます。添付後、下のフォームから次の問題を追加できます。"
                )
              : t(
                  "Save a question first, then attach images, recordings, or audio files here.",
                  "まず「保存して次へ」で問題を保存すると、ここで画像・録音・音声を添付できます。"
                )}
          </Text>
          <Text style={styles.mediaSideLabel}>{t("Question side", "問題側")}</Text>
          <MediaAttachment
            position="question"
            existingMedia={mediaItems}
            onUpload={handleMediaUpload}
            onDelete={handleMediaDelete}
            apiBaseUrl={getTextbookApiOrigin()}
            disabled={!lastSavedQuestionId || saving}
          />
          <Text style={styles.mediaSideLabel}>{t("Answer side", "解答側")}</Text>
          <MediaAttachment
            position="answer"
            existingMedia={mediaItems}
            onUpload={handleMediaUpload}
            onDelete={handleMediaDelete}
            apiBaseUrl={getTextbookApiOrigin()}
            disabled={!lastSavedQuestionId || saving}
          />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSaveSingle} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t("Save & Add Next", "保存して次へ")}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {!parsed ? (
            <>
              <View style={styles.bulkFormatHint}>
                <Text style={styles.bulkFormatHintText}>{t(
                  "Separate with blank line or ---. Auto-detects MC (A/B/C), TF (true/false), and text.",
                  "空行 or --- で区切り。選択肢(A/B/C), 正誤(true/false), 記述を自動判定。"
                )}</Text>
              </View>
              <TextInput style={[styles.input, { minHeight: 120 }]} value={bulkText} onChangeText={v => { setBulkText(v); setParsed(null); }} placeholder={t(
                "What is the capital of Japan?\nA) Tokyo\nB) Osaka\nC) Kyoto\nAnswer: A\n---\nThe Earth revolves around the Sun\nAnswer: true\n---\nChemical formula for water?\nAnswer: H2O",
                "日本の首都は？\nA) 東京\nB) 大阪\nC) 京都\n答え: A\n---\n地球は太陽の周りを回る\n答え: true\n---\n水の化学式は？\n答え: H2O"
              )} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleBulkPreview}>
                <Text style={styles.saveBtnText}>{t("Preview", "プレビュー")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.previewTitle}>{parsed.length}{t(" question(s)", "問")}</Text>
              {parsed.map((q, i) => (
                <View key={i} style={styles.previewItem}>
                  <Text style={[styles.badge, q.question_type === "multiple_choice" ? styles.badgeMC : q.question_type === "true_false" ? styles.badgeTF : styles.badgeText]}>
                    {q.question_type === "multiple_choice" ? t("MC", "選択") : q.question_type === "true_false" ? t("TF", "正誤") : t("Text", "記述")}
                  </Text>
                  <Text style={styles.previewQ} numberOfLines={1}>{q.question_text}</Text>
                </View>
              ))}
              {bulkSaving && <Text style={styles.progressText}>{bulkProgress}/{parsed.length}</Text>}
              <TouchableOpacity style={[styles.saveBtn, bulkSaving && { opacity: 0.5 }]} onPress={handleBulkSave} disabled={bulkSaving}>
                {bulkSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t("Add All", "一括追加")}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setParsed(null)} style={styles.backBtn}>
                <Text style={styles.backBtnText}>{t("Edit", "編集に戻る")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    alignItems: "center",
  },
  addButtonText: { fontSize: 15, color: "#007AFF", fontWeight: "600" },
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    ...platformShadow({ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }),
    elevation: 3,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  closeText: { fontSize: 18, color: "#888", fontWeight: "700", padding: 4 },
  tabRow: { flexDirection: "row", backgroundColor: "#f0f0f0", borderRadius: 8, padding: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, color: "#888", fontWeight: "500" },
  tabTextActive: { color: "#007AFF", fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: "#ddd", alignItems: "center", backgroundColor: "#fff" },
  typeBtnActive: { borderColor: "#007AFF", backgroundColor: "#007AFF" },
  typeBtnText: { fontSize: 12, color: "#666", fontWeight: "500" },
  typeBtnTextActive: { color: "#fff" },
  input: { backgroundColor: "#f8f8f8", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 8 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#ccc", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: "#34C759", backgroundColor: "#34C759" },
  radioText: { fontSize: 12, fontWeight: "700", color: "#555" },
  optInput: { flex: 1, backgroundColor: "#f8f8f8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: "#e0e0e0" },
  addOptBtn: { alignSelf: "flex-start", marginBottom: 8 },
  addOptText: { fontSize: 13, color: "#007AFF", fontWeight: "500" },
  tfRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tfBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: "#ddd", alignItems: "center", backgroundColor: "#fff" },
  tfBtnActive: { borderColor: "#34C759", backgroundColor: "#34C759" },
  tfBtnText: { fontSize: 14, fontWeight: "600", color: "#555" },
  tfBtnTextActive: { color: "#fff" },
  saveBtn: { backgroundColor: "#007AFF", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  previewTitle: { fontSize: 14, fontWeight: "700", color: "#333", marginBottom: 8 },
  previewItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  badge: { fontSize: 10, fontWeight: "700", color: "#fff", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  badgeMC: { backgroundColor: "#007AFF" },
  badgeTF: { backgroundColor: "#FF9500" },
  badgeText: { backgroundColor: "#8E8E93" },
  previewQ: { flex: 1, fontSize: 13, color: "#333" },
  progressText: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 6 },
  backBtn: { paddingVertical: 10, alignItems: "center" },
  backBtnText: { fontSize: 14, color: "#888" },
  bulkFormatHint: { backgroundColor: "#F0F5FF", borderRadius: 8, padding: 10, marginBottom: 8 },
  bulkFormatHintText: { fontSize: 12, color: "#555", lineHeight: 18 },
  mediaLabel: { fontSize: 14, fontWeight: "700", color: "#333", marginTop: 10, marginBottom: 4 },
  mediaHint: { fontSize: 12, color: "#666", lineHeight: 17, marginBottom: 6 },
  mediaSideLabel: { fontSize: 12, fontWeight: "600", color: "#555", marginTop: 4, marginBottom: 2 },
});
