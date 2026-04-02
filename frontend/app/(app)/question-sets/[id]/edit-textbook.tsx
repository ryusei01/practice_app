import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import { questionSetsApi } from '../../../../src/api/questionSets';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useLanguage } from '../../../../src/contexts/LanguageContext';

type EditorMode = 'edit' | 'preview';

const DRAFT_KEY_PREFIX = 'textbook_draft_';

const TOOLBAR_ACTIONS = [
  { label: 'H1', syntax: '# ', block: true },
  { label: 'H2', syntax: '## ', block: true },
  { label: 'H3', syntax: '### ', block: true },
  { label: 'B', syntax: '**', wrap: true },
  { label: 'I', syntax: '_', wrap: true },
  { label: '―', syntax: '\n---\n', block: true },
  { label: '• リスト', syntax: '- ', block: true },
  { label: '1. リスト', syntax: '1. ', block: true },
  { label: '> 引用', syntax: '> ', block: true },
  { label: '`コード`', syntax: '`', wrap: true },
  { label: '```\nブロック', syntax: '```\n', wrapBlock: true },
] as const;

type ToolbarAction = typeof TOOLBAR_ACTIONS[number];

export default function EditTextbookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [content, setContent] = useState('');
  const [mode, setMode] = useState<EditorMode>('edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftKey = `${DRAFT_KEY_PREFIX}${id}`;

  useEffect(() => {
    loadContent();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [id]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [draft, questionSet] = await Promise.all([
        AsyncStorage.getItem(draftKey),
        questionSetsApi.getById(id),
      ]);

      if (questionSet.creator_id !== user?.id) {
        Alert.alert(
          t('Error', 'エラー'),
          t('You do not have permission to edit this textbook', 'この教科書を編集する権限がありません')
        );
        router.back();
        return;
      }

      setIsPublished(questionSet.textbook_type === 'inline' && !!questionSet.textbook_content);

      if (draft !== null) {
        setContent(draft);
        setHasDraft(true);
      } else if (questionSet.textbook_type === 'inline' && questionSet.textbook_content) {
        setContent(questionSet.textbook_content);
      } else {
        setContent('');
      }
    } catch (err) {
      console.error('Failed to load textbook content:', err);
      Alert.alert(t('Error', 'エラー'), t('Failed to load content', 'コンテンツの読み込みに失敗しました'));
    } finally {
      setLoading(false);
    }
  };

  const scheduleAutoSave = useCallback((text: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(draftKey, text);
        setHasDraft(true);
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 1500);
  }, [draftKey]);

  const handleContentChange = (text: string) => {
    setContent(text);
    scheduleAutoSave(text);
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      await AsyncStorage.setItem(draftKey, content);
      setHasDraft(true);
      Alert.alert(t('Saved', '保存完了'), t('Draft saved to device', '下書きを端末に保存しました'));
    } catch (err) {
      Alert.alert(t('Error', 'エラー'), t('Failed to save draft', '下書きの保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      Alert.alert(t('Error', 'エラー'), t('Content is empty', 'コンテンツが空です'));
      return;
    }

    Alert.alert(
      t('Publish Textbook', '教科書を公開'),
      t(
        'This will make the textbook available to all users who purchased this question set.',
        'この問題集を購入したユーザーが教科書を閲覧できるようになります。'
      ),
      [
        { text: t('Cancel', 'キャンセル'), style: 'cancel' },
        {
          text: t('Publish', '公開する'),
          onPress: async () => {
            try {
              setPublishing(true);
              await questionSetsApi.update(id, {
                textbook_content: content,
                textbook_type: 'inline',
              });
              await AsyncStorage.removeItem(draftKey);
              setHasDraft(false);
              setIsPublished(true);
              Alert.alert(
                t('Published', '公開完了'),
                t('Textbook has been published successfully.', '教科書を公開しました。')
              );
            } catch (err) {
              console.error('Failed to publish:', err);
              Alert.alert(t('Error', 'エラー'), t('Failed to publish textbook', '教科書の公開に失敗しました'));
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  };

  const handleDiscardDraft = () => {
    Alert.alert(
      t('Discard Draft', '下書きを破棄'),
      t('Discard local draft and restore published version?', 'ローカルの下書きを破棄して公開済みバージョンに戻しますか？'),
      [
        { text: t('Cancel', 'キャンセル'), style: 'cancel' },
        {
          text: t('Discard', '破棄'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(draftKey);
            setHasDraft(false);
            await loadContent();
          },
        },
      ]
    );
  };

  const insertFormatting = (action: ToolbarAction) => {
    const { start, end } = selection;
    const selected = content.slice(start, end);

    let newContent = content;
    let newCursorPos = start;

    if ('wrap' in action && action.wrap) {
      const s = action.syntax as string;
      if (selected) {
        newContent = content.slice(0, start) + s + selected + s + content.slice(end);
        newCursorPos = end + s.length * 2;
      } else {
        newContent = content.slice(0, start) + s + s + content.slice(end);
        newCursorPos = start + s.length;
      }
    } else if ('wrapBlock' in action && action.wrapBlock) {
      const s = action.syntax as string;
      if (selected) {
        newContent = content.slice(0, start) + s + selected + '\n```' + content.slice(end);
        newCursorPos = end + s.length + 4;
      } else {
        newContent = content.slice(0, start) + s + '\n```' + content.slice(end);
        newCursorPos = start + s.length;
      }
    } else if ('block' in action && action.block) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const s = action.syntax as string;
      newContent = content.slice(0, lineStart) + s + content.slice(lineStart);
      newCursorPos = lineStart + s.length + (start - lineStart);
    }

    setContent(newContent);
    scheduleAutoSave(newContent);

    setTimeout(() => {
      inputRef.current?.focus();
      setSelection({ start: newCursorPos, end: newCursorPos });
    }, 50);
  };

  const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(e.nativeEvent.selection);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* ヘッダーバー */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          {hasDraft && (
            <View style={styles.draftBadge}>
              <Text style={styles.draftBadgeText}>{t('Draft', '下書き')}</Text>
            </View>
          )}
          {isPublished && !hasDraft && (
            <View style={styles.publishedBadge}>
              <Text style={styles.publishedBadgeText}>{t('Published', '公開済み')}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {hasDraft && (
            <TouchableOpacity onPress={handleDiscardDraft} style={styles.discardButton}>
              <Text style={styles.discardButtonText}>{t('Discard', '破棄')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSaveDraft} style={styles.saveDraftButton} disabled={saving}>
            <Text style={styles.saveDraftButtonText}>
              {saving ? t('Saving...', '保存中...') : t('Save Draft', '下書き保存')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePublish} style={styles.publishButton} disabled={publishing}>
            {publishing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.publishButtonText}>{t('Publish', '公開する')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* モード切り替えタブ */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, mode === 'edit' && styles.tabActive]}
          onPress={() => setMode('edit')}
        >
          <Text style={[styles.tabText, mode === 'edit' && styles.tabTextActive]}>
            {t('Edit', '編集')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'preview' && styles.tabActive]}
          onPress={() => setMode('preview')}
        >
          <Text style={[styles.tabText, mode === 'preview' && styles.tabTextActive]}>
            {t('Preview', 'プレビュー')}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'edit' ? (
        <>
          {/* ツールバー */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.toolbar}
            contentContainerStyle={styles.toolbarContent}
            keyboardShouldPersistTaps="always"
          >
            {TOOLBAR_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.toolbarButton}
                onPress={() => insertFormatting(action)}
              >
                <Text style={styles.toolbarButtonText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* テキスト入力エリア */}
          <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled">
            <TextInput
              ref={inputRef}
              style={styles.editor}
              value={content}
              onChangeText={handleContentChange}
              onSelectionChange={handleSelectionChange}
              multiline
              textAlignVertical="top"
              placeholder={t(
                'Start writing your textbook here...\n\nTip: Use the toolbar above to format text.\n# Heading 1\n## Heading 2\n**Bold** / _Italic_',
                '教科書の内容をここに書いてください...\n\nヒント：上のツールバーでテキストを装飾できます。\n# 見出し1\n## 見出し2\n**太字** / _斜体_'
              )}
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </ScrollView>
        </>
      ) : (
        <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
          {content.trim() ? (
            <Markdown style={markdownStyles}>{content}</Markdown>
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewText}>
                {t('Nothing to preview yet.', 'まだ内容がありません。')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fafafa',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  draftBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  publishedBadge: {
    backgroundColor: '#34C759',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  publishedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  discardButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discardButtonText: {
    color: '#FF3B30',
    fontSize: 13,
  },
  saveDraftButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveDraftButtonText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
  publishButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  toolbar: {
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#f5f5f5',
    maxHeight: 44,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  toolbarButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  editorScroll: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: '#222',
    padding: 16,
    minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 16,
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyPreviewText: {
    color: '#aaa',
    fontSize: 15,
  },
});

const markdownStyles = StyleSheet.create({
  heading1: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    color: '#111',
  },
  heading2: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    color: '#222',
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: '#333',
    marginBottom: 12,
  },
  strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { fontSize: 16, lineHeight: 26, color: '#333', marginBottom: 4 },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    paddingVertical: 4,
    backgroundColor: '#f0f6ff',
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: '#d63384',
  },
  fence: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  hr: {
    backgroundColor: '#ddd',
    height: 1,
    marginVertical: 16,
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
