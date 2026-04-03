import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { platformShadow } from "@/src/styles/platformShadow";
import { useLanguage } from "../contexts/LanguageContext";
import { questionSetsApi } from "../api/questionSets";

interface InlineSetEditorProps {
  questionSetId: string;
  initialTitle: string;
  initialCategory: string;
  initialDescription?: string;
  onSaved?: (title: string, category: string, description: string) => void;
}

export default function InlineSetEditor({
  questionSetId,
  initialTitle,
  initialCategory,
  initialDescription = "",
  onSaved,
}: InlineSetEditorProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setCategory(initialCategory);
    setDescription(initialDescription);
  }, [initialTitle, initialCategory, initialDescription]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await questionSetsApi.update(questionSetId, {
        title: title.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
      });
      setIsEditing(false);
      onSaved?.(title.trim(), category.trim(), description.trim());
    } catch {
      // keep editing on failure
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(initialTitle);
    setCategory(initialCategory);
    setDescription(initialDescription);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <TouchableOpacity style={styles.displayContainer} onPress={() => {
        setIsEditing(true);
        setTimeout(() => titleRef.current?.focus(), 100);
      }}>
        <View style={styles.displayRow}>
          <Text style={styles.displayTitle} numberOfLines={2}>{title || t("Untitled", "無題")}</Text>
          <Text style={styles.editHint}>{t("Tap to edit", "タップで編集")}</Text>
        </View>
        {category ? <Text style={styles.displayCategory}>{category}</Text> : null}
        {description ? <Text style={styles.displayDescription} numberOfLines={2}>{description}</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.editContainer}>
      <Text style={styles.label}>{t("Title", "タイトル")}</Text>
      <TextInput
        ref={titleRef}
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t("Enter title", "タイトルを入力")}
        editable={!isSaving}
      />
      <Text style={styles.label}>{t("Category", "カテゴリ")}</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder={t("e.g., Math, Science", "例: 数学、理科")}
        editable={!isSaving}
      />
      <Text style={styles.label}>{t("Description", "説明")}</Text>
      <TextInput
        style={[styles.input, styles.descInput]}
        value={description}
        onChangeText={setDescription}
        placeholder={t("Optional description", "説明（任意）")}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        editable={!isSaving}
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={isSaving}>
          <Text style={styles.cancelBtnText}>{t("Cancel", "キャンセル")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving || !title.trim()}>
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{t("Save", "保存")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  displayContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  displayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  displayTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  editHint: {
    fontSize: 11,
    color: "#007AFF",
    marginLeft: 8,
    marginTop: 4,
  },
  displayCategory: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  displayDescription: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  editContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  descInput: {
    minHeight: 60,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    color: "#888",
  },
  saveBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
