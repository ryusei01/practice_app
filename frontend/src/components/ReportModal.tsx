import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { reportsApi, ReportReason } from '../api/reports';

interface Props {
  visible: boolean;
  questionSetId: string;
  questionSetTitle: string;
  onClose: () => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'copyright', label: '著作権侵害（他の書籍・教材からのコピーなど）' },
  { value: 'spam', label: 'スパム・広告' },
  { value: 'inappropriate', label: '不適切なコンテンツ' },
  { value: 'other', label: 'その他' },
];

export default function ReportModal({
  visible,
  questionSetId,
  questionSetTitle,
  onClose,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('エラー', '通報理由を選択してください');
      return;
    }

    setIsSubmitting(true);
    try {
      await reportsApi.create({
        question_set_id: questionSetId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });
      Alert.alert(
        '通報を受け付けました',
        '内容を確認の上、適切に対処いたします。ご協力ありがとうございます。',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail || '通報の送信に失敗しました。時間をおいて再試行してください。';
      Alert.alert('エラー', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>問題集を通報</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {questionSetTitle}
            </Text>

            <Text style={styles.sectionLabel}>通報理由 *</Text>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.reasonItem,
                  selectedReason === r.value && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(r.value)}
              >
                <View
                  style={[
                    styles.radio,
                    selectedReason === r.value && styles.radioSelected,
                  ]}
                />
                <Text style={styles.reasonLabel}>{r.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.sectionLabel}>詳細（任意）</Text>
            <TextInput
              style={styles.textInput}
              placeholder="具体的な内容があればご記入ください"
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>通報する</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  reasonItemSelected: {
    borderColor: '#e53e3e',
    backgroundColor: '#fff5f5',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: '#e53e3e',
    backgroundColor: '#e53e3e',
  },
  reasonLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e53e3e',
    alignItems: 'center',
  },
  submitText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
