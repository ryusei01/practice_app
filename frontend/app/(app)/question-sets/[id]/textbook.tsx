import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import Markdown from 'react-native-markdown-display';
import { questionSetsApi } from '../../../../src/api/questionSets';
import { useLanguage } from '../../../../src/contexts/LanguageContext';
import { getTextbookApiOrigin } from '../../../../src/services/textbookService';

export default function TextbookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [textbookType, setTextbookType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTextbook();
  }, [id]);

  const loadTextbook = async () => {
    try {
      setLoading(true);
      setError(null);

      const questionSet = await questionSetsApi.getById(id);

      // インラインコンテンツ（エディターで作成）の場合
      if (questionSet.textbook_type === 'inline') {
        if (questionSet.textbook_content) {
          setContent(questionSet.textbook_content);
          setTextbookType('inline');
        } else {
          setError(t('No textbook available', '教科書が設定されていません'));
        }
        setLoading(false);
        return;
      }

      if (!questionSet.textbook_path) {
        setError(t('No textbook available', '教科書が設定されていません'));
        setLoading(false);
        return;
      }

      setTextbookType(questionSet.textbook_type);

      if (questionSet.textbook_type === 'markdown') {
        // Markdownファイルを読み込む
        await loadMarkdown(questionSet.textbook_path);
      } else if (questionSet.textbook_type === 'pdf') {
        // PDFファイルのパスを設定
        setContent(questionSet.textbook_path);
      } else {
        setError(t('Unsupported textbook type', 'サポートされていない教科書形式です'));
      }
    } catch (err) {
      console.error('Failed to load textbook:', err);
      setError(t('Failed to load textbook', '教科書の読み込みに失敗しました'));
    } finally {
      setLoading(false);
    }
  };

  const loadMarkdown = async (path: string) => {
    try {
      // パスがURLの場合
      if (path.startsWith('http://') || path.startsWith('https://')) {
        const response = await fetch(path);
        const contentType = response.headers.get('Content-Type') || '';
        const text = await response.text();
        if (
          contentType.includes('text/html') ||
          text.trim().startsWith('<!DOCTYPE') ||
          text.trim().startsWith('<html')
        ) {
          setError(t('Textbook file not found', '教科書ファイルが見つかりません'));
          return;
        }
        setContent(text);
        return;
      }

      // ローカルファイルの場合
      if (path.startsWith('file://')) {
        const fileContent = await FileSystem.readAsStringAsync(path);
        setContent(fileContent);
        return;
      }

      // 相対パスの場合（docs/textbook/など）
      // バックエンドAPIからファイルを取得
      const apiBaseUrl = getTextbookApiOrigin();
      const fileUrl = `${apiBaseUrl}/api/v1/textbooks/${encodeURIComponent(path)}`;
      
      const isHtmlContent = (text: string, ct: string) =>
        ct.includes('text/html') ||
        text.trim().startsWith('<!DOCTYPE') ||
        text.trim().startsWith('<html');

      try {
        const response = await fetch(fileUrl);
        if (response.ok) {
          const contentType = response.headers.get('Content-Type') || '';
          const text = await response.text();
          if (isHtmlContent(text, contentType)) {
            console.log('[Textbook] API returned HTML (SPA fallback), skipping');
          } else {
            setContent(text);
            return;
          }
        }
        // フォールバック: 直接パスから読み込む（開発環境用）
        if (Platform.OS === 'web') {
          const fallbackResponse = await fetch(`/${path}`);
          if (fallbackResponse.ok) {
            const contentType = fallbackResponse.headers.get('Content-Type') || '';
            const text = await fallbackResponse.text();
            if (isHtmlContent(text, contentType)) {
              setError(t('Textbook file not found', '教科書ファイルが見つかりません'));
            } else {
              setContent(text);
            }
          } else {
            setError(t('Textbook file not found', '教科書ファイルが見つかりません'));
          }
        } else {
          setError(t('Please configure textbook path', '教科書のパスを設定してください'));
        }
      } catch (fetchErr) {
        console.error('Failed to fetch from API:', fetchErr);
        setError(t('Failed to load markdown file', 'Markdownファイルの読み込みに失敗しました'));
      }
    } catch (err) {
      console.error('Failed to load markdown:', err);
      setError(t('Failed to load markdown file', 'Markdownファイルの読み込みに失敗しました'));
    }
  };

  const renderMarkdown = () => {
    return (
      <ScrollView style={styles.contentContainer}>
        <Markdown style={markdownStyles}>
          {content}
        </Markdown>
      </ScrollView>
    );
  };

  const renderPDF = () => {
    // PDF表示
    if (content.startsWith('http://') || content.startsWith('https://')) {
      // WebViewでPDFを表示
      return (
        <WebView
          source={{ uri: content }}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}
        />
      );
    } else {
      // ローカルPDFファイルの場合
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {t('PDF viewer not available for local files', 'ローカルPDFファイルの表示はサポートされていません')}
          </Text>
          <Text style={styles.errorSubtext}>{content}</Text>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {t('Loading textbook...', '教科書を読み込んでいます...')}
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {textbookType === 'inline' || textbookType === 'markdown'
        ? renderMarkdown()
        : renderPDF()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  webView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

const markdownStyles = StyleSheet.create({
  // 見出し
  heading1: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    color: '#333',
  },
  heading2: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    color: '#333',
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  heading4: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    color: '#333',
  },
  heading5: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#333',
  },
  heading6: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    color: '#333',
  },
  // 段落
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: '#333',
  },
  // リスト
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
    color: '#333',
  },
  // コードブロック
  code_inline: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#d63384',
  },
  code_block: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    overflow: 'hidden',
  },
  fence: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    overflow: 'hidden',
  },
  // 引用
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    marginLeft: 0,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
  },
  // テーブル
  table: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  thead: {
    backgroundColor: '#f5f5f5',
  },
  tbody: {},
  th: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  td: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    fontSize: 16,
    color: '#333',
  },
  tr: {},
  // 水平線
  hr: {
    backgroundColor: '#ddd',
    height: 1,
    marginVertical: 16,
  },
  // リンク
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  // 強調
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  // 画像
  image: {
    marginVertical: 12,
    borderRadius: 4,
  },
});

