import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { questionSetsApi } from '../../../../src/api/questionSets';

export default function TextbookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const router = useRouter();
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
        const text = await response.text();
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
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
      const fileUrl = `${apiBaseUrl}/api/v1/textbooks/${encodeURIComponent(path)}`;
      
      try {
        const response = await fetch(fileUrl);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          // フォールバック: 直接パスから読み込む（開発環境用）
          if (Platform.OS === 'web') {
            // Web版の場合、相対パスから直接読み込む
            const response = await fetch(`/${path}`);
            if (response.ok) {
              const text = await response.text();
              setContent(text);
            } else {
              setError(t('Textbook file not found', '教科書ファイルが見つかりません'));
            }
          } else {
            setError(t('Please configure textbook path', '教科書のパスを設定してください'));
          }
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
    // 簡易的なMarkdownレンダリング
    // 実際の実装では、react-native-markdown-displayなどのライブラリを使用
    const lines = content.split('\n');
    return (
      <ScrollView style={styles.contentContainer}>
        {lines.map((line, index) => {
          // 見出し
          if (line.startsWith('# ')) {
            return (
              <Text key={index} style={styles.h1}>
                {line.substring(2)}
              </Text>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <Text key={index} style={styles.h2}>
                {line.substring(3)}
              </Text>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <Text key={index} style={styles.h3}>
                {line.substring(4)}
              </Text>
            );
          }
          // コードブロック
          if (line.startsWith('```')) {
            return null; // コードブロックは簡易実装ではスキップ
          }
          // 通常のテキスト
          if (line.trim()) {
            return (
              <Text key={index} style={styles.paragraph}>
                {line}
              </Text>
            );
          }
          return <Text key={index}>{'\n'}</Text>;
        })}
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
      {textbookType === 'markdown' ? renderMarkdown() : renderPDF()}
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
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    color: '#333',
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
    color: '#333',
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: '#333',
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

